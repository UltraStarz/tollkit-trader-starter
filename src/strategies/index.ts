import { dca } from "./dca.js";
import { dipBuyer } from "./dip-buyer.js";
import { momentum } from "./momentum.js";
import { rebalance } from "./rebalance.js";
import type { Strategy } from "./types.js";

/** Add your own strategy here (copy one of these files to start). */
export const STRATEGIES: Record<string, Strategy> = { dca, "dip-buyer": dipBuyer, momentum, rebalance };
export type { Strategy } from "./types.js";
