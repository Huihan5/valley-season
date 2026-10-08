/**
 * Plays whole seasons with simulated stewards and reports where they end up.
 *
 *   npm run sim                      100 seeds per steward, all plans
 *   npm run sim -- --seeds 300       more seeds
 *   npm run sim -- --plan quota      one plan only
 *   npm run sim -- --rows            one line per season, for digging into a result
 *
 * The seasons are the real engine run from a seed (systems/GameEngine.ts), so the
 * numbers move when the rules move. Use it to calibrate the ending thresholds in
 * data/config.ts and as a regression check after touching the economy.
 */
import { PLANS, playSeason, SeasonReport } from '../tests/helpers/simulation';
import { ENDING_IDS } from '../src/systems/EndingSystem';

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const seeds = Number(arg('seeds') ?? 100);
const only = arg('plan');
const rows = argv.includes('--rows');

const pct = (n: number, d: number) => `${((100 * n) / d).toFixed(0).padStart(3)}%`;

function quantile(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

function spread(values: number[]): string {
  const v = [...values].sort((a, b) => a - b);
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  return `${quantile(v, 0.1)} / ${quantile(v, 0.5)} / ${quantile(v, 0.9)}  (mean ${mean.toFixed(1)})`;
}

function report(name: string, about: string, runs: SeasonReport[]) {
  const n = runs.length;
  console.log(`\n── ${name} — ${about}`);
  console.log(
    '   endings  ' + ENDING_IDS.map(id => `${id.replace('ending', '')}: ${pct(runs.filter(r => r.ending === id).length, n)}`).join('   '),
  );
  console.log(`   grain    p10/p50/p90  ${spread(runs.map(r => r.grain))}`);
  console.log(`   gold     p10/p50/p90  ${spread(runs.map(r => r.gold))}`);
  console.log(`   timber   p10/p50/p90  ${spread(runs.map(r => r.timber))}`);
  console.log(`   renown   p10/p50/p90  ${spread(runs.map(r => r.renown))}`);
  const has = (f: (r: SeasonReport) => boolean) => pct(runs.filter(f).length, n);
  console.log(
    `   lines    grain≥60 ${has(r => r.grain >= 60)}  ≥75 ${has(r => r.grain >= 75)}  ≥90 ${has(r => r.grain >= 90)}`
    + `   gold≥60 ${has(r => r.gold >= 60)}   timber≥15 ${has(r => r.timber >= 15)}`
    + `   renown≥3 ${has(r => r.renown >= 3)}  ≥5 ${has(r => r.renown >= 5)}`,
  );
  const avg = (f: (r: SeasonReport) => number) => (runs.reduce((a, r) => a + f(r), 0) / n).toFixed(1);
  console.log(`   clues    estate ${avg(r => r.clues.estate)}/4   officer ${avg(r => r.clues.officer)}/3   noble ${avg(r => r.clues.noble)}/1   position ${avg(r => r.clues.position)}/4   (mean held)`);
  console.log(
    `   truth    three groups ${has(r => r.threeGroups)}   position line ${has(r => r.positionLine)}   valley test ${has(r => r.valleyTest)}`
    + `   dismissed early ${has(r => r.dismissedEarly)}`,
  );
}

const plans = PLANS.filter(p => !only || p.name === only);
if (plans.length === 0) {
  console.error(`no plan called "${only}". Plans: ${PLANS.map(p => p.name).join(', ')}`);
  process.exit(1);
}

const t0 = Date.now();
for (const plan of plans) {
  const runs: SeasonReport[] = [];
  for (let seed = 1; seed <= seeds; seed++) runs.push(playSeason(plan, seed * 7919));
  report(plan.name, plan.about, runs);
  if (rows) {
    for (const r of runs) {
      console.log(
        `   seed ${String(r.seed).padStart(7)}  ${r.ending}  grain ${r.grain} gold ${r.gold} timber ${r.timber} renown ${r.renown}`
        + `  noble ${r.nobleTrust} impr ${r.lordImpression} felled ${r.felled}  actions ${r.actions}`,
      );
    }
  }
}
console.log(`\n${seeds} seeds × ${plans.length} plans in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
