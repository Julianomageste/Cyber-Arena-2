import { runSimulation, type BuildArchetype, type LabTier, type SimResult } from './sim';
import { LAB_UPGRADES, labCost } from './balance';

const BUILDS: BuildArchetype[] = ['cadencia', 'cadeia', 'drones', 'defensiva', 'equilibrada'];
const LAB_TIERS: LabTier[] = ['lab0', 'labMid', 'labMax'];
const SEEDS = [101, 202];

function avg(nums: (number | null)[]): number {
    const valid = nums.filter((n): n is number => n !== null);
    if (!valid.length) return 0;
    return Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2));
}

function summarizeGroup(results: SimResult[]) {
    const cheapestLab = Math.min(...LAB_UPGRADES.map(u => labCost(u, 0)));
    const avgScrap = avg(results.map(r => r.scrapEarned));
    const avgTime = avg(results.map(r => r.survivalTime));
    const runsForFirstUpgrade = avgScrap > 0 ? Number((cheapestLab / avgScrap).toFixed(2)) : Infinity;
    const minToFirstLab = avgScrap > 0 ? Number(((runsForFirstUpgrade * avgTime) / 60).toFixed(2)) : Infinity;
    return {
        avgWave: avg(results.map(r => r.deathWave)),
        avgTimeSec: avgTime,
        avgScrap,
        avgLv: avg(results.map(r => r.finalLevel)),
        avgFirstXpSec: avg(results.map(r => r.firstUpgradeTime)),
        avgSecondXpSec: avg(results.map(r => r.secondUpgradeTime)),
        avgThirdXpSec: avg(results.map(r => r.thirdUpgradeTime)),
        avgDmgDealt: Math.round(avg(results.map(r => r.damageDealt))),
        avgDmgRecv: Math.round(avg(results.map(r => r.damageReceived))),
        runsForFirstLab: runsForFirstUpgrade,
        minToFirstLab
    };
}

console.log('=== CYBER ARENA SIMULATION MATRIX ===');
console.log(`Cheapest Lab Lv1: ${Math.min(...LAB_UPGRADES.map(u => labCost(u, 0)))} scrap`);

for (const tier of LAB_TIERS) {
    console.log(`\n--- ${tier.toUpperCase()} (kiting) ---`);
    const tierRows: SimResult[] = [];
    for (const build of BUILDS) {
        const runs = SEEDS.map(seed => runSimulation({ build, labTier: tier, playStyle: 'kiting', seed }));
        tierRows.push(...runs);
        const s = summarizeGroup(runs);
        const evos = [...new Set(runs.flatMap(r => r.evosUnlocked))].join(', ') || 'none';
        const refWaves = [7, 10, 15, 20, 30]
            .map(w => {
                const snap = runs.find(r => r.waveSnapshots[w])?.waveSnapshots[w];
                return snap ? `W${w}(HP ${snap.hp}/${snap.maxHp},Lv${snap.lv})` : null;
            })
            .filter(Boolean).join(' ');
        console.log(
            `${build.padEnd(12)} | Wave ${String(s.avgWave).padStart(5)} | Time ${String(s.avgTimeSec).padStart(5)}s | Scrap ${String(s.avgScrap).padStart(5)} | Lv ${String(s.avgLv).padStart(4)} | XP1/2/3 ${s.avgFirstXpSec}/${s.avgSecondXpSec}/${s.avgThirdXpSec}s | Dmg ${s.avgDmgDealt}/${s.avgDmgRecv} | 1stLab ${s.runsForFirstLab}r (${s.minToFirstLab}m) | Evos: ${evos}`
        );
        if (refWaves) console.log(`   RefWaves: ${refWaves}`);
    }
    const ts = summarizeGroup(tierRows);
    console.log(`AVG ${tier.padEnd(8)} | Wave ${String(ts.avgWave).padStart(5)} | Time ${String(ts.avgTimeSec).padStart(5)}s | Scrap ${String(ts.avgScrap).padStart(5)} | Lv ${String(ts.avgLv).padStart(4)} | 1stLab ${ts.runsForFirstLab}r (${ts.minToFirstLab}m)`);
}

console.log('\n--- CHECKPOINT W26->30+ (LABMAX, kiting) ---');
for (const build of BUILDS) {
    const runs = SEEDS.map(seed => runSimulation({ build, labTier: 'labMax', playStyle: 'kiting', startWave: 26, maxTimeSec: 660, seed }));
    const s = summarizeGroup(runs);
    const w30 = runs.map(r => r.waveSnapshots[30]).filter(Boolean);
    const w30Txt = w30.length
        ? `W30(HP ${Math.round(avg(w30.map(x => x.hp)))}/${Math.round(avg(w30.map(x => x.maxHp)))}, Lv${avg(w30.map(x => x.lv))}, Scrap ${avg(w30.map(x => x.scrapEarned))})`
        : 'did not reach W30';
    console.log(
        `CP26 ${build.padEnd(12)} | Wave ${String(s.avgWave).padStart(5)} | Scrap ${String(s.avgScrap).padStart(5)} | Lv ${String(s.avgLv).padStart(4)} | Dmg ${s.avgDmgDealt}/${s.avgDmgRecv} | ${w30Txt}`
    );
}

console.log('\n--- STATIONARY (AFK) SURVIVAL CHECK ---');
for (const tier of ['lab0', 'labMax'] as LabTier[]) {
    for (const build of ['defensiva', 'cadencia', 'equilibrada'] as BuildArchetype[]) {
        const r = runSimulation({ build, labTier: tier, playStyle: 'stationary', seed: 101 });
        console.log(
            `AFK ${tier.padEnd(6)} ${build.padEnd(12)} | Wave ${r.deathWave} | Time ${r.survivalTime}s | Scrap ${r.scrapEarned} | Lv ${r.finalLevel} | DmgRecv ${r.damageReceived}`
        );
    }
}
