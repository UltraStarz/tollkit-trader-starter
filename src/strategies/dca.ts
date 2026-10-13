import type { Strategy } from "./types.js";

/** Recurring buy: a fixed dollar amount every N hours, whatever the price. */
export const dca: Strategy<{ amount_usd: number; every_hours: number }> = {
  name: "dca",
  describe: (p) => `Buy $${p.amount_usd} every ${p.every_hours} hour(s), whatever the price.`,
  decide: ({ now, params, state }) => {
    const due = !state.lastBuy || now - state.lastBuy >= params.every_hours * 3600_000;
    return due ? { side: "buy", usd: params.amount_usd, why: "scheduled buy" } : null;
  },
  filled: ({ now, state }) => { state.lastBuy = now; },
};
