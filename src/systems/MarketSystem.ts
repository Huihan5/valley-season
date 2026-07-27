import { GameState } from '../types/game';
import {
  MARKET_GRAIN_PRICE,
  MARKET_TIMBER_PRICE,
  MARKET_TIMBER_PRICE_MILLRIDGE,
  MARKET_TRANSPORT_CAP,
  MARKET_LOT_SIZES,
} from '../data/config';

/**
 * v3 market rules (GDD ch.5.4). Four Saturdays instead of eight market days, but
 * quantity per trip is open up to the cart's capacity — anything beyond 20 units
 * of stock needs a second trip, which is what makes hoarding cost time.
 */

export function marketSoldKey(day: number): string {
  return `marketUnitsSold_day${day}`;
}

/** Units already carted off today, grain and timber together. */
export function getUnitsSoldToday(state: GameState): number {
  return Number(state.flags[marketSoldKey(state.day)] ?? 0);
}

export function getCapacityLeft(state: GameState): number {
  return Math.max(0, MARKET_TRANSPORT_CAP - getUnitsSoldToday(state));
}

export function getGrainRevenue(units: number): number {
  return Math.floor(units * MARKET_GRAIN_PRICE);
}

/** 亨克's agreement raises the timber rate; it does not touch grain. */
export function getTimberUnitPrice(state: GameState): number {
  return state.flags.millridgeDealSigned ? MARKET_TIMBER_PRICE_MILLRIDGE : MARKET_TIMBER_PRICE;
}

export function getTimberRevenue(state: GameState, units: number): number {
  return units * getTimberUnitPrice(state);
}

/**
 * Lot sizes worth offering: the fixed lots that fit, plus a sell-max option when
 * it differs from them. Returns ascending, no duplicates, never above capacity.
 */
export function getSellLots(available: number, capacityLeft: number): number[] {
  const ceiling = Math.min(available, capacityLeft);
  if (ceiling <= 0) return [];

  const lots = MARKET_LOT_SIZES.filter(lot => lot < ceiling);
  lots.push(ceiling);
  return lots;
}
