import type { Strategy } from "./types.js";

/** Keeps the token at a target share of (token + USDC), trading only when it drifts outside a band. */
export const rebalance: Strategy<{ target_token_pct: number; band_pct: number; max_trade_usd: number }> = {
  name: "rebalance",
  describe: (p) => `Keep the token at ${p.target_token_pct}% of the portfolio (token + USDC), trading when it drifts more than ${p.band_pct} points, at most $${p.max_trade_usd} a trade.`,
  decide({ market, params, holdings }) {
    const tokenUsd = holdings.units * market.price, total = tokenUsd + holdings.usdc;
    if (total < 1) return null;
    const pct = (tokenUsd / total) * 100, target = params.target_token_pct;
    if (Math.abs(pct - target) <= params.band_pct) return null;
    const diffUsd = Math.min(params.max_trade_usd, Math.abs((target / 100) * total - tokenUsd));
    if (diffUsd < 1) return null;
    return pct < target
      ? { side: "buy", usd: +diffUsd.toFixed(2), why: `token is ${pct.toFixed(1)}% of the portfolio, under the ${target}% target` }
      : { side: "sell", units: diffUsd / market.price, why: `token is ${pct.toFixed(1)}% of the portfolio, over the ${target}% target` };
  },
};
