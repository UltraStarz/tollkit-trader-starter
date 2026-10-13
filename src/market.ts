/**
 * Prices for strategies: spot price and 24h change from tollkit-wallet's
 * PriceFeed, and candles from Coinbase Exchange's public candles endpoint
 * (no key; [time, low, high, open, close, volume]; at most 300 per request).
 */
import { PriceFeed } from "tollkit-wallet";
import type { Candle, Market } from "./strategies/types.js";

const PRODUCT: Record<string, string> = { ETH: "ETH-USD", WETH: "ETH-USD", SOL: "SOL-USD" };

export function productFor(token: string): string {
  const p = PRODUCT[token.toUpperCase()];
  if (!p) throw new Error(`The starter bot prices ETH and SOL from Coinbase; ${token} isn't supported yet. Add its product to PRODUCT in src/market.ts.`);
  return p;
}

export async function candles(product: string, seconds: number, f: typeof fetch = fetch): Promise<Candle[]> {
  const r = await f(`https://api.exchange.coinbase.com/products/${product}/candles?granularity=${seconds}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`candles: HTTP ${r.status}`);
  const rows = (await r.json()) as number[][];
  return rows.map(([t, low, high, open, close]) => ({ t: t!, low: low!, high: high!, open: open!, close: close! })).sort((a, b) => a.t - b.t);
}

export async function market(token: string, feed: PriceFeed): Promise<Market> {
  const product = productFor(token);
  await feed.refresh();
  const p = feed.snapshot().prices[token.toUpperCase() === "WETH" ? "ETH" : token.toUpperCase()];
  if (!p?.usd) throw new Error(`No price for ${token} right now.`);
  const cache = new Map<number, Candle[]>();
  return {
    price: p.usd, change24h: p.change_24h,
    candles: async (s) => { if (!cache.has(s)) cache.set(s, await candles(product, s)); return cache.get(s)!; },
  };
}
