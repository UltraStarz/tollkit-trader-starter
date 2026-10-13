import type { Candle, Strategy } from "./types.js";

export const sma = (cs: Candle[], n: number) => cs.slice(-n).reduce((s, c) => s + c.close, 0) / Math.min(n, cs.length);

/**
 * Trend following: holds the token while the fast moving average is above the
 * slow one, and steps back to USDC when it crosses below.
 */
export const momentum: Strategy<{ amount_usd: number; fast: number; slow: number; candle_seconds: 3600 | 21600 | 86400 }> = {
  name: "momentum",
  describe: (p) => `Buy $${p.amount_usd} when the ${p.fast}-candle average crosses above the ${p.slow}-candle average; sell those buys when it crosses back below.`,
  async decide({ market, params, state, holdings }) {
    const cs = await market.candles(params.candle_seconds);
    if (cs.length < params.slow + 1) return null;
    const fastNow = sma(cs, params.fast), slowNow = sma(cs, params.slow);
    const prev = cs.slice(0, -1), fastPrev = sma(prev, params.fast), slowPrev = sma(prev, params.slow);
    const held = (state.units as number | undefined) ?? 0;
    if (fastPrev <= slowPrev && fastNow > slowNow && held === 0) return { side: "buy", usd: params.amount_usd, why: `fast average $${fastNow.toFixed(2)} crossed above slow $${slowNow.toFixed(2)}` };
    if (fastPrev >= slowPrev && fastNow < slowNow && held > 0) return { side: "sell", units: Math.min(held, holdings.units), why: `fast average $${fastNow.toFixed(2)} crossed below slow $${slowNow.toFixed(2)}` };
    return null;
  },
  filled({ state }, d, fill) { state.units = d.side === "buy" ? ((state.units ?? 0) + fill.units) : Math.max(0, (state.units ?? 0) - fill.units); },
};
