import type { Strategy } from "./types.js";

/**
 * Buy dips, sell the bounce: buys when the price is dip_pct below the last
 * 24 hours' high (at most once per cooldown), and sells what it bought once
 * the price is take_profit_pct above its average cost.
 */
export const dipBuyer: Strategy<{ amount_usd: number; dip_pct: number; cooldown_hours: number; take_profit_pct: number }> = {
  name: "dip-buyer",
  describe: (p) => `Buy $${p.amount_usd} when the price is ${p.dip_pct}% under its 24h high (at most every ${p.cooldown_hours}h); sell those buys at +${p.take_profit_pct}%.`,
  async decide({ now, market, params, state, holdings }) {
    const pos = state.pos as { units: number; cost: number } | undefined;
    if (pos && pos.units > 0) {
      const avg = pos.cost / pos.units;
      if (market.price >= avg * (1 + params.take_profit_pct / 100)) {
        return { side: "sell", units: Math.min(pos.units, holdings.units), why: `price $${market.price.toFixed(2)} is ${params.take_profit_pct}%+ over the $${avg.toFixed(2)} average buy` };
      }
    }
    const day = (await market.candles(3600)).slice(-24);
    if (!day.length) return null;
    const high = Math.max(...day.map((c) => c.high));
    const cooled = !state.lastBuy || now - state.lastBuy >= params.cooldown_hours * 3600_000;
    if (cooled && market.price <= high * (1 - params.dip_pct / 100)) {
      return { side: "buy", usd: params.amount_usd, why: `price $${market.price.toFixed(2)} is ${(((high - market.price) / high) * 100).toFixed(1)}% under the 24h high of $${high.toFixed(2)}` };
    }
    return null;
  },
  filled({ now, state }, d, fill) {
    const pos = (state.pos ??= { units: 0, cost: 0 });
    if (d.side === "buy") { pos.units += fill.units; pos.cost += fill.usd; state.lastBuy = now; }
    else { const share = pos.units ? Math.min(1, fill.units / pos.units) : 1; pos.cost *= 1 - share; pos.units = Math.max(0, pos.units - fill.units); }
  },
};
