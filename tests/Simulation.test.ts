import { describe, it, expect } from 'vitest';
import { PLANS, playSeason, SeasonReport } from './helpers/simulation';
import { ENDING_IDS } from '../src/systems/EndingSystem';

/**
 * Whole seasons, played by simulated stewards on the real engine (tests/helpers/
 * simulation.ts). The ending rules are unit-tested state by state in EndingSystem.test.ts;
 * these tests ask the questions that only a played season can answer: can each ending
 * actually be reached by someone playing, and does the economy still make a competent
 * season something a steward who simply does the work gets? `npm run sim` prints the
 * same seasons as a report, for calibrating the numbers in data/config.ts.
 */

const SEEDS = 100;
const seedOf = (i: number) => i * 7919;

const plan = (name: string) => PLANS.find(p => p.name === name)!;
const run = (name: string, seeds = SEEDS): SeasonReport[] =>
  Array.from({ length: seeds }, (_, i) => playSeason(plan(name), seedOf(i + 1)));
const share = (reports: SeasonReport[], ending: string) =>
  reports.filter(r => r.ending === ending).length / reports.length;

describe('every simulated steward gets through a season', () => {
  it('reaches an ending, without getting stuck', () => {
    for (const p of PLANS) {
      for (let i = 1; i <= 20; i++) {
        const r = playSeason(p, seedOf(i));
        expect(r.ending, `${p.name} #${i}`).toMatch(/^ending/);
      }
    }
  });

  it('plays the same season twice from the same seed', () => {
    for (const p of PLANS) {
      expect(playSeason(p, seedOf(3))).toEqual(playSeason(p, seedOf(3)));
    }
  });
});

describe('every ending can be reached by somebody playing', () => {
  const seen = new Set<string>();
  for (const p of PLANS) for (const r of run(p.name)) seen.add(r.ending);
  // 河谷的人 asks for the grain, the standing, the people and some coin and wood all at once;
  // a heuristic steward who is paying for the people has no coin left. Funded, the same steward
  // gets there, which shows the way through the people is open and the purse is the obstacle.
  for (let i = 1; i <= SEEDS; i++) {
    seen.add(playSeason(plan('valley'), seedOf(i), { endowment: { guldmark: 120, timber: 20 } }).ending);
  }

  it.each([...ENDING_IDS])('%s', (id) => {
    expect(seen.has(id), `${id} was never reached in ${SEEDS} seasons of every plan`).toBe(true);
  });
});

// The shape of the economy, as the thresholds in config.ts meet it. These are guard
// rails, not targets: wide margins, so a retuned number only fails them when it has
// changed what kind of player each ending is for.
describe('what kind of steward each ending is for', () => {
  it('dismisses a steward who does nothing', () => {
    expect(share(run('idle'), 'ending1')).toBe(1);
  });

  it('does not count a full barn alone as a competent season', () => {
    const reports = run('harvest-only');
    expect(share(reports, 'ending2')).toBe(0);
    expect(Math.min(...reports.map(r => r.grain))).toBeGreaterThan(100);
  });

  it('gives 称职的外来者 to a steward who simply does the work', () => {
    expect(share(run('quota'), 'ending2')).toBeGreaterThan(0.9);
  });

  it('still gives it to one who gives a day in three to the people', () => {
    expect(share(run('balanced'), 'ending2')).toBeGreaterThan(0.9);
  });

  it('does not hand it to a steward who spends the season on the valley, and the stock shows why', () => {
    const reports = run('valley');
    expect(share(reports, 'ending2')).toBe(0);
    const poor = reports.filter(r => r.gold < 60 || r.timber < 15).length / reports.length;
    expect(poor).toBeGreaterThan(0.9);
  });

  it('gives the truth endings to a steward who chased the fragments and kept the estate standing', () => {
    const reports = run('detective');
    const truth = share(reports, 'ending4a') + share(reports, 'ending4b');
    expect(truth).toBeGreaterThan(0.4);
    // And they did it without the books the competent ending asks for.
    const lean = reports.filter(r => r.ending.startsWith('ending4') && (r.gold < 60 || r.timber < 15));
    expect(lean.length).toBeGreaterThan(0);
  });

  it('keeps the truth out of reach of a steward who never looked', () => {
    for (const name of ['idle', 'harvest-only', 'quota', 'timber-rush']) {
      const reports = run(name, 30);
      expect(share(reports, 'ending4a') + share(reports, 'ending4b'), name).toBe(0);
    }
  });

  it('never finds a steward in the truth endings under the grain floor', () => {
    for (const p of PLANS) {
      for (const r of run(p.name, 30)) {
        if (r.ending.startsWith('ending4')) expect(r.grain, `${p.name} ${r.seed}`).toBeGreaterThanOrEqual(60);
      }
    }
  });
});
