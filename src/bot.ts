/**
 * The bot: every few minutes it asks your strategy what to do and, if
 * anything, trades through Tollkit Wallet. In paper mode (the default) it
 * uses pretend money at live prices; in live mode, real trades, still inside
 * the limits and approvals you set in the wallet.
 *
 *   npm run paper        # practise
 *   npm start            # BOT_MODE from .env (paper unless you change it)
 *   npm run once         # one decision, then exit (good for cron)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { TollkitWallet, KNOWN_TOKENS, PriceFeed, liveBalance, resolveToken, toAtomic, type Chain } from "tollkit-wallet";
import { STRATEGIES } from "./strategies/index.js";
import { market } from "./market.js";
import type { Decision } from "./strategies/types.js";

// Minimal .env loader (no dependency).
if (existsSync(".env")) for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line); if (m && !(m[1]! in process.env)) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}

const cfg = JSON.parse(readFileSync(process.env.BOT_CONFIG ?? "config.json", "utf8"));
const MODE = (process.env.BOT_MODE ?? "paper") === "live" ? "live" : "paper";
const STATE_FILE = "bot-state.json";
const chain = cfg.chain as Chain;

function password(): string {
  const f = process.env.TOLLKIT_WALLET_PASSWORD_FILE;
  if (f) return readFileSync(f, "utf8").replace(/\r?\n$/, "");
  if (process.env.TOLLKIT_WALLET_PASSWORD) return process.env.TOLLKIT_WALLET_PASSWORD;
  throw new Error("Set TOLLKIT_WALLET_PASSWORD_FILE (see .env.example).");
}
const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

async function main() {
  const strategy = STRATEGIES[cfg.strategy];
  if (!strategy) throw new Error(`Unknown strategy "${cfg.strategy}". Options: ${Object.keys(STRATEGIES).join(", ")}`);
  const params = cfg.strategies?.[cfg.strategy] ?? {};
  const w = await TollkitWallet.open(password(), { dir: process.env.TOLLKIT_WALLET_HOME });
  const token = await resolveToken(chain, cfg.token);
  const usdc = KNOWN_TOKENS[chain].USDC!;
  const feed = new PriceFeed();
  const state: Record<string, any> = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : {};
  const save = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  log(`${MODE === "paper" ? "PAPER" : "LIVE"} · ${strategy.name} · ${cfg.token} on ${chain}: ${strategy.describe(params)}`);
  if (MODE === "live") log(`Limits from your wallet apply: $${w.policy.per_trade_usd}/trade, $${w.policy.daily_trades_usd}/day; approval above $${w.policy.approval_above_usd}.`);

  const balances = async () => {
    const units = MODE === "paper" ? w.paper().balance(chain, token) : await liveBalance(w.addresses, chain, token);
    const usd = MODE === "paper" ? w.paper().balance(chain, usdc) : await liveBalance(w.addresses, chain, usdc);
    return { units: Number(units) / 10 ** token.decimals, usdc: Number(usd) / 1e6 };
  };

  const act = async (d: Decision) => {
    const req = d.side === "buy"
      ? { chain, sell_token: usdc.address, buy_token: token.address, sell_amount: toAtomic(d.usd.toFixed(6), 6), slippage_bps: Math.min(50, w.policy.max_slippage_bps) }
      : { chain, sell_token: token.address, buy_token: usdc.address, sell_amount: toAtomic(d.units.toFixed(Math.min(token.decimals, 9)), token.decimals), slippage_bps: Math.min(50, w.policy.max_slippage_bps) };
    const r = MODE === "paper" ? await w.paper().swap(req) : await w.swap(req);
    if (!r.ok || !r.quote) { log(`  not traded: ${r.refused?.reason ?? "unknown"}`); return null; }
    const units = d.side === "buy" ? Number(r.quote.buy_amount) / 10 ** token.decimals : Number(req.sell_amount) / 10 ** token.decimals;
    const usd = r.quote.usd_value ?? 0;
    log(`  ${d.side === "buy" ? "bought" : "sold"} ${units.toPrecision(6)} ${cfg.token} for ~$${usd.toFixed(2)} (fee ~$${(r.quote.fee_usd ?? 0).toFixed(3)}) ${r.tx ?? ""}`);
    return { units, usd };
  };

  const step = async () => {
    const ctx = { now: Date.now(), market: await market(cfg.token, feed), holdings: await balances(), params, state };
    const d = await strategy.decide(ctx);
    if (!d) { log(`$${ctx.market.price.toFixed(2)} · holding (${ctx.holdings.units.toPrecision(4)} ${cfg.token}, $${ctx.holdings.usdc.toFixed(2)} USDC) · nothing to do`); return; }
    log(`$${ctx.market.price.toFixed(2)} · ${d.side.toUpperCase()}: ${d.why}`);
    const fill = await act(d);
    if (fill) { strategy.filled?.(ctx, d, fill); save(); }
  };

  if (process.env.BOT_ONCE) { await step(); return; }
  for (;;) {
    try { await step(); } catch (e) { log(`error: ${(e as Error).message}`); }
    await new Promise((r) => setTimeout(r, (cfg.interval_minutes ?? 5) * 60_000));
  }
}

main().catch((e) => { console.error(`Error: ${(e as Error).message}`); process.exit(1); });
