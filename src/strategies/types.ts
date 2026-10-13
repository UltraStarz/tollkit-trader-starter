/** What every strategy gets, and what it can ask the bot to do. */
export interface Candle { t: number; low: number; high: number; open: number; close: number }
export interface Market {
  price: number;                 // USD, now
  change24h: number | null;      // e.g. -0.012 = -1.2%
  candles(seconds: 3600 | 21600 | 86400 | 900 | 300 | 60): Promise<Candle[]>; // oldest first
}
export interface Holdings { units: number; usdc: number }
export interface Context<P = any> {
  now: number;
  market: Market;
  holdings: Holdings;
  params: P;
  /** Saved between runs (bot-state.json). Strategies keep their own notes here. */
  state: Record<string, any>;
}
export type Decision =
  | { side: "buy"; usd: number; why: string }
  | { side: "sell"; units: number; why: string };

export interface Strategy<P = any> {
  name: string;
  /** One line, shown at start-up, so it's clear what the bot will do. */
  describe(params: P): string;
  decide(ctx: Context<P>): Promise<Decision | null> | Decision | null;
  /** Called after a trade fills, to update the strategy's notes. */
  filled?(ctx: Context<P>, d: Decision, fill: { units: number; usd: number }): void;
}
