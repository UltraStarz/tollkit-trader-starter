/** Strategy decisions on made-up prices: no wallet, no network. */
import { dca } from "../src/strategies/dca.js";
import { dipBuyer } from "../src/strategies/dip-buyer.js";
import { momentum } from "../src/strategies/momentum.js";
import { rebalance } from "../src/strategies/rebalance.js";
import type { Candle, Context } from "../src/strategies/types.js";

let pass = 0, fail = 0;
const check = (c: boolean, l: string, d?: unknown) => { if (c) { pass++; console.log("  ok  ", l); } else { fail++; console.log("  FAIL", l, d ?? ""); } };
const cs = (closes: number[], highs?: number[]): Candle[] => closes.map((c, i) => ({ t: i * 3600, low: c, high: highs?.[i] ?? c, open: c, close: c }));
const ctx = (o: Partial<Context> & { price: number; candles?: Candle[] }): Context => ({
  now: o.now ?? 1_000_000_000_000, params: o.params, state: o.state ?? {}, holdings: o.holdings ?? { units: 0, usdc: 100 },
  market: { price: o.price, change24h: null, candles: async () => o.candles ?? [] },
});

{ // DCA
  const p = { amount_usd: 10, every_hours: 24 }, state: any = {};
  const c = ctx({ price: 2500, params: p, state });
  const d = await dca.decide(c);
  check(d?.side === "buy" && d.usd === 10, "DCA buys at the start");
  dca.filled!(c, d!, { units: 0.004, usd: 10 });
  check((await dca.decide({ ...c, now: c.now + 3600_000 })) === null, "and not again within 24h");
  check((await dca.decide({ ...c, now: c.now + 24 * 3600_000 }))?.side === "buy", "then again after 24h");
}
{ // Dip buyer
  const p = { amount_usd: 20, dip_pct: 4, cooldown_hours: 12, take_profit_pct: 6 }, state: any = {};
  const day = cs(Array(24).fill(2500), Array(24).fill(2600));
  check((await dipBuyer.decide(ctx({ price: 2550, params: p, state, candles: day }))) === null, "no buy 2% under the high");
  const c = ctx({ price: 2490, params: p, state, candles: day });
  const d = await dipBuyer.decide(c);
  check(d?.side === "buy" && d.usd === 20, "buys 4.2% under the 24h high", d);
  dipBuyer.filled!(c, d!, { units: 0.008, usd: 20 });
  check((await dipBuyer.decide({ ...c, now: c.now + 3600_000 })) === null, "cooldown: no second buy within 12h");
  const tp = await dipBuyer.decide(ctx({ price: 2660, params: p, state, holdings: { units: 0.008, usdc: 80 }, candles: day }));
  check(tp?.side === "sell" && tp.units === 0.008, "sells its buys at +6% over average cost", tp);
}
{ // Momentum
  const p = { amount_usd: 25, fast: 3, slow: 6, candle_seconds: 3600 as const }, state: any = {};
  const up = cs([10, 10, 10, 10, 10, 10, 9, 9, 9, 12]);
  const d = await momentum.decide(ctx({ price: 12, params: p, state, candles: up }));
  check(d?.side === "buy", "buys when the fast average crosses above the slow one", d);
  momentum.filled!(ctx({ price: 12, params: p, state }), d!, { units: 2, usd: 25 });
  const down = cs([10, 10, 10, 10, 10, 10, 11, 11, 11, 8]);
  const s = await momentum.decide(ctx({ price: 8, params: p, state, holdings: { units: 2, usdc: 0 }, candles: down }));
  check(s?.side === "sell" && s.units === 2, "sells what it bought when it crosses back below", s);
  check((await momentum.decide(ctx({ price: 10, params: p, state, candles: cs([1, 2]) }))) === null, "waits for enough candles");
}
{ // Rebalance
  const p = { target_token_pct: 50, band_pct: 5, max_trade_usd: 50 };
  const d = await rebalance.decide(ctx({ price: 100, params: p, holdings: { units: 0.2, usdc: 80 } })); // 20% token
  check(d?.side === "buy" && d.usd === 30, "buys back up to 50%", d);
  const s = await rebalance.decide(ctx({ price: 100, params: p, holdings: { units: 2, usdc: 0 } }));
  check(s?.side === "sell" && Math.abs(s.units - 0.5) < 1e-9, "sells down to 50%, capped at $50", s);
  check((await rebalance.decide(ctx({ price: 100, params: p, holdings: { units: 0.52, usdc: 48 } }))) === null, "inside the band: no trade");
}
console.log(`\nstrategies: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
