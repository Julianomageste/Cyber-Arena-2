import fs from 'node:fs';
import path from 'node:path';
import {
    CARDS, FALLBACK_CARDS, EVOLUTIONS, LAB_UPGRADES, CHASSIS_DATA, ECONOMY_TUNING, XP_CURVE, COMBAT_TUNING,
    computeFixedBonus, labCost, nextMaxXp, getWaveCaps,
    type ChassisId
} from './balance';
import { runSimulation, buildHangarForTier, type BuildArchetype, type LabTier, type PlayStyle, type SimResult } from './sim';

const BUILDS: BuildArchetype[] = ['cadencia', 'cadeia', 'drones', 'defensiva', 'equilibrada'];
const LAB_TIERS: LabTier[] = ['lab0', 'labMid', 'labMax'];
const CHASSIS_IDS: ChassisId[] = ['interceptor', 'guardiao', 'tesla', 'sombra'];
const REF_WAVES = [7, 10, 15, 20, 30];

const ARTIFACT_DIR = path.resolve(process.cwd(), '.aistudio/artifacts/brain/539452c0-c1ff-4de1-88f5-6dc2025a7838');

interface StatSummary {
    n: number;
    mean: number;
    median: number;
    sd: number;
    min: number;
    max: number;
    p25: number;
    p75: number;
    ci95: number;
}

function r2(v: number): number {
    return Number.isFinite(v) ? Number(v.toFixed(2)) : 0;
}

function summarize(values: number[]): StatSummary {
    if (!values.length) {
        return { n: 0, mean: 0, median: 0, sd: 0, min: 0, max: 0, p25: 0, p75: 0, ci95: 0 };
    }
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const mean = sorted.reduce((s, v) => s + v, 0) / n;
    const mid = Math.floor(n / 2);
    const median = n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    const quantile = (q: number) => {
        const pos = (n - 1) * q;
        const lo = Math.floor(pos);
        const hi = Math.ceil(pos);
        return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
    };
    const variance = n > 1 ? sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
    const sd = Math.sqrt(variance);
    const ci95 = n > 0 ? 1.96 * (sd / Math.sqrt(n)) : 0;
    return {
        n,
        mean: r2(mean),
        median: r2(median),
        sd: r2(sd),
        min: r2(sorted[0]),
        max: r2(sorted[n - 1]),
        p25: r2(quantile(0.25)),
        p75: r2(quantile(0.75)),
        ci95: r2(ci95)
    };
}

function summarizeRuns(label: string, runs: SimResult[], startWave = 1) {
    const wave = summarize(runs.map(r => r.deathWave));
    const time = summarize(runs.map(r => r.survivalTime - (startWave - 1) * 20));
    const scrap = summarize(runs.map(r => r.scrapEarned));
    const scrapPerMin = summarize(runs.map(r => {
        const activeTime = Math.max(1, r.survivalTime - (startWave - 1) * 20);
        return (r.scrapEarned / activeTime) * 60;
    }));
    const scrapPerWave = summarize(runs.map(r => {
        const wavesDone = Math.max(1, r.deathWave - startWave + 1);
        return r.scrapEarned / wavesDone;
    }));
    const level = summarize(runs.map(r => r.finalLevel));
    const dmgDealt = summarize(runs.map(r => r.damageDealt));
    const dmgRecv = summarize(runs.map(r => r.damageReceived));
    const dps = summarize(runs.map(r => {
        const activeTime = Math.max(1, r.survivalTime - (startWave - 1) * 20);
        return r.damageDealt / activeTime;
    }));
    const dtps = summarize(runs.map(r => {
        const activeTime = Math.max(1, r.survivalTime - (startWave - 1) * 20);
        return r.damageReceived / activeTime;
    }));
    const xp1 = summarize(runs.map(r => r.firstUpgradeTime).filter((v): v is number => v !== null));
    const xp2 = summarize(runs.map(r => r.secondUpgradeTime).filter((v): v is number => v !== null));
    const xp3 = summarize(runs.map(r => r.thirdUpgradeTime).filter((v): v is number => v !== null));
    const upgradesPerMin = summarize(runs.map(r => {
        const activeTime = Math.max(1, r.survivalTime - (startWave - 1) * 20);
        return (r.upgradeTimes.length / activeTime) * 60;
    }));
    const fallbackRate = summarize(runs.map(r => r.upgradeTimes.length > 0 ? (r.fallbackPicks / r.upgradeTimes.length) * 100 : 0));
    const overflowLost = summarize(runs.map(r => r.xpOverflowLost));
    const survivalEndRate = r2((runs.filter(r => r.survivedToEnd).length / runs.length) * 100);

    const waveReachPct: Record<number, number> = {};
    const waveSnapAvg: Record<number, { n: number; hp: number; maxHp: number; lv: number; scrap: number }> = {};
    for (const w of REF_WAVES) {
        const reached = runs.filter(r => r.deathWave >= w);
        waveReachPct[w] = r2((reached.length / runs.length) * 100);
        const snaps = runs.map(r => r.waveSnapshots[w]).filter(Boolean);
        if (snaps.length) {
            waveSnapAvg[w] = {
                n: snaps.length,
                hp: Math.round(snaps.reduce((s, x) => s + x.hp, 0) / snaps.length),
                maxHp: Math.round(snaps.reduce((s, x) => s + x.maxHp, 0) / snaps.length),
                lv: r2(snaps.reduce((s, x) => s + x.lv, 0) / snaps.length),
                scrap: r2(snaps.reduce((s, x) => s + x.scrapEarned, 0) / snaps.length)
            };
        }
    }

    const totalDmgRecv = runs.reduce((s, r) => s + r.damageReceived, 0);
    const dmgBySourcePct: Record<string, number> = {};
    for (const r of runs) {
        for (const [k, v] of Object.entries(r.damageBySource)) {
            dmgBySourcePct[k] = (dmgBySourcePct[k] || 0) + v;
        }
    }
    for (const k of Object.keys(dmgBySourcePct)) {
        dmgBySourcePct[k] = totalDmgRecv > 0 ? r2((dmgBySourcePct[k] / totalDmgRecv) * 100) : 0;
    }

    const bossAgg = runs.reduce((acc, r) => {
        acc.fireCount += r.bossAttacks.fireCount;
        acc.laserCount += r.bossAttacks.laserCount;
        acc.missilesLaunched += r.bossAttacks.missilesLaunched;
        acc.missilesIntercepted += r.bossAttacks.missilesIntercepted;
        acc.bombsDropped += r.bossAttacks.bombsDropped;
        acc.bombsHit += r.bossAttacks.bombsHit;
        return acc;
    }, { fireCount: 0, laserCount: 0, missilesLaunched: 0, missilesIntercepted: 0, bombsDropped: 0, bombsHit: 0 });

    const evoFreq: Record<string, number> = {};
    const cardFreq: Record<string, number> = {};
    for (const r of runs) {
        for (const e of r.evosUnlocked) evoFreq[e] = (evoFreq[e] || 0) + 1;
        for (const [c, cnt] of Object.entries(r.upgradesPicked)) {
            cardFreq[c] = (cardFreq[c] || 0) + cnt;
        }
    }

    return {
        label,
        n: runs.length,
        survivalEndRate,
        wave,
        time,
        scrap,
        scrapPerMin,
        scrapPerWave,
        level,
        dmgDealt,
        dmgRecv,
        dps,
        dtps,
        xp1,
        xp2,
        xp3,
        upgradesPerMin,
        fallbackRate,
        overflowLost,
        waveReachPct,
        waveSnapAvg,
        dmgBySourcePct,
        bossAgg: {
            ...bossAgg,
            missileInterceptPct: bossAgg.missilesLaunched > 0 ? r2((bossAgg.missilesIntercepted / bossAgg.missilesLaunched) * 100) : 0,
            bombHitPct: bossAgg.bombsDropped > 0 ? r2((bossAgg.bombsHit / bossAgg.bombsDropped) * 100) : 0
        },
        evoPct: Object.fromEntries(Object.entries(evoFreq).map(([k, v]) => [k, r2((v / runs.length) * 100)])),
        topCards: Object.entries(cardFreq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ id: k, avgLv: r2(v / runs.length) }))
    };
}

function makeSeeds(start: number, count: number, step = 17): number[] {
    return Array.from({ length: count }, (_, i) => start + i * step);
}

console.log('=== CYBER ARENA: AUDITORIA AVANÇADA DE BALANCEAMENTO (READ-ONLY) ===\n');

// 1. Theoretical Math Diagnostics
const xpTable: { lv: number; maxXp: number; cumXp: number }[] = [];
{
    let req = XP_CURVE.initialMaxXp;
    let cum = 0;
    for (let lv = 1; lv <= 30; lv++) {
        xpTable.push({ lv, maxXp: req, cumXp: cum });
        cum += req;
        req = nextMaxXp(req, lv + 1, XP_CURVE);
    }
}

const labMath = LAB_UPGRADES.map(u => {
    const levelCosts = Array.from({ length: u.maxLv }, (_, i) => labCost(u, i));
    return {
        id: u.id,
        namePt: u.namePt,
        maxLv: u.maxLv,
        lv1Cost: levelCosts[0],
        maxLvCost: levelCosts[levelCosts.length - 1],
        totalCost: levelCosts.reduce((a, b) => a + b, 0),
        levelCosts
    };
});
const totalLabCostAll = labMath.reduce((s, u) => s + u.totalCost, 0);
const tier1LabCostAll = labMath.reduce((s, u) => s + u.lv1Cost, 0);
const totalChassisCost = CHASSIS_DATA.reduce((s, c) => s + c.cost, 0);

const waveMath = [1, 2, 3, 5, 7, 10, 15, 20, 25, 30].map(w => {
    const c = getWaveCaps(w);
    return {
        wave: w,
        hpMult: r2(c.hpMult),
        dmgMult: r2(c.dmgMult),
        maxEnemies: c.maxEnemies,
        dronesPerSec: r2(c.dronesPerSec),
        droneHp: r2(10 * c.hpMult),
        tankBossHp: r2(46 * c.hpMult),
        bastionBossHp: r2(58 * c.hpMult),
        megaBossHp: w >= 8 ? r2(340 * (1 + Math.max(0, w - 8) * 0.18)) : 0,
        titanDmg: Math.round(14 * c.dmgMult),
        kamikazeBossDmg: Math.round(18 * c.dmgMult),
        sniperDmg: Math.round(14 * c.dmgMult),
        megaBossDmg: Math.round(21 * c.dmgMult)
    };
});

const tierBaselines = LAB_TIERS.map(tier => {
    const h = buildHangarForTier(tier, 'equilibrada', 'interceptor');
    const b = computeFixedBonus(h);
    return { tier, hp: b.hp, ehp: r2(b.hp / (1 - b.ch.armor)), dmg: b.dmg, rate: r2(b.rate), dps: r2(b.dmg / b.rate), spd: b.spd, mag: b.mag, empCd: r2(b.empCd), scrapMult: b.scrapMult };
});

console.log('--- TEORIA: LABORATÓRIO E CHASSIS ---');
console.log(`Cheapest Lab Lv1: ${Math.min(...labMath.map(l => l.lv1Cost))} | All Lv1 sum: ${tier1LabCostAll} | Full Lab (${labMath.reduce((s, l) => s + l.maxLv, 0)} levels): ${totalLabCostAll} | Chassis total: ${totalChassisCost} | Grand Total Meta: ${totalLabCostAll + totalChassisCost}`);
console.table(labMath.map(l => ({ id: l.id, maxLv: l.maxLv, lv1: l.lv1Cost, lastLv: l.maxLvCost, total: l.totalCost })));

console.log('--- TEORIA: STATUS BASE POR TIER (INTERCEPTOR) ---');
console.table(tierBaselines);

console.log('--- TEORIA: ESCALONAMENTO DE ONDAS ---');
console.table(waveMath);

console.log('--- TEORIA: CURVA DE XP (amostra) ---');
console.table(xpTable.filter(x => [1, 2, 3, 5, 8, 10, 15, 20, 25, 30].includes(x.lv)));

const tStart = Date.now();
const allRuns: { suite: string; result: SimResult }[] = [];
const csvRows: string[] = [
    'suite,group,n,wave_mean,wave_med,wave_sd,wave_p25,wave_p75,wave_ci95,time_mean,scrap_mean,scrap_med,scrap_sd,scrap_per_min,lv_mean,xp1_mean,upgrades_per_min,fallback_pct,dps_mean,dtps_mean,w7_pct,w10_pct,w15_pct,w20_pct,w30_pct'
];

function pushSummaryCsv(suite: string, s: ReturnType<typeof summarizeRuns>) {
    csvRows.push([
        suite, s.label, s.n, s.wave.mean, s.wave.median, s.wave.sd, s.wave.p25, s.wave.p75, s.wave.ci95,
        s.time.mean, s.scrap.mean, s.scrap.median, s.scrap.sd, s.scrapPerMin.mean, s.level.mean,
        s.xp1.mean, s.upgradesPerMin.mean, s.fallbackRate.mean, s.dps.mean, s.dtps.mean,
        s.waveReachPct[7], s.waveReachPct[10], s.waveReachPct[15], s.waveReachPct[20], s.waveReachPct[30]
    ].join(','));
}

// 2. Matrix 1: 5 Builds x 3 Lab Tiers x 15 Seeds (kiting, 720s cap)
const seeds15 = makeSeeds(101, 15, 17);
const matrix1Summaries: Record<string, ReturnType<typeof summarizeRuns>> = {};
const tierAggRuns: Record<LabTier, SimResult[]> = { lab0: [], labMid: [], labMax: [] };

for (const tier of LAB_TIERS) {
    console.log(`\n=== MATRIX 1: ${tier.toUpperCase()} (kiting, 15 seeds/build, cap 720s / W36) ===`);
    for (const build of BUILDS) {
        const runs = seeds15.map(seed => runSimulation({ build, labTier: tier, playStyle: 'kiting', maxTimeSec: 720, seed }));
        runs.forEach(r => { allRuns.push({ suite: 'matrix1', result: r }); tierAggRuns[tier].push(r); });
        const s = summarizeRuns(`${tier}_${build}`, runs);
        matrix1Summaries[s.label] = s;
        pushSummaryCsv('matrix1', s);
        console.log(
            `${build.padEnd(11)} | W ${s.wave.mean} (med ${s.wave.median}, sd ${s.wave.sd}, CI±${s.wave.ci95}, [${s.wave.min}..${s.wave.max}]) | ` +
            `T ${s.time.mean}s | Scrap ${s.scrap.mean} (${s.scrapPerMin.mean}/m) | Lv ${s.level.mean} | XP1 ${s.xp1.mean}s | ` +
            `Upg/m ${s.upgradesPerMin.mean} (FB ${s.fallbackRate.mean}%) | Reach W7/10/15/20/30: ${s.waveReachPct[7]}/${s.waveReachPct[10]}/${s.waveReachPct[15]}/${s.waveReachPct[20]}/${s.waveReachPct[30]}%`
        );
        console.log(
            `   DmgSrc%: fire=${s.dmgBySourcePct.fire_flame || 0}% laser=${s.dmgBySourcePct.boss_laser || 0}% missile=${s.dmgBySourcePct.homing_missile || 0}% bomb=${s.dmgBySourcePct.boss_bomb || 0}% smg=${s.dmgBySourcePct.smg_round || 0}% sniper=${s.dmgBySourcePct.sniper_bolt || 0}% contact=${r2(Object.entries(s.dmgBySourcePct).filter(([k]) => k.startsWith('contact_')).reduce((a, [, v]) => a + v, 0))}% evt=${r2(Object.entries(s.dmgBySourcePct).filter(([k]) => k.startsWith('event_')).reduce((a, [, v]) => a + v, 0))}% | ` +
            `BossMissiles ${s.bossAgg.missilesIntercepted}/${s.bossAgg.missilesLaunched} (${s.bossAgg.missileInterceptPct}%) | BombsHit ${s.bossAgg.bombsHit}/${s.bossAgg.bombsDropped} (${s.bossAgg.bombHitPct}%)`
        );
    }
    const ts = summarizeRuns(`${tier}_ALL`, tierAggRuns[tier]);
    matrix1Summaries[ts.label] = ts;
    pushSummaryCsv('matrix1_tier', ts);
    console.log(`>> TIER ${tier}: Wave ${ts.wave.mean}±${ts.wave.ci95} | Time ${ts.time.mean}s | Scrap ${ts.scrap.mean} (${ts.scrapPerMin.mean}/m) | Reach W7=${ts.waveReachPct[7]}% W10=${ts.waveReachPct[10]}% W15=${ts.waveReachPct[15]}% W20=${ts.waveReachPct[20]}% W30=${ts.waveReachPct[30]}%`);
}

// 3. Matrix 2: Chassis Isolation (LabMid 6 seeds & LabMax 8 seeds x 5 builds x 4 chassis)
const seeds6 = makeSeeds(301, 6, 23);
const seeds8 = makeSeeds(301, 8, 23);
const chassisSummaries: Record<string, ReturnType<typeof summarizeRuns>> = {};
for (const tier of ['labMid', 'labMax'] as LabTier[]) {
    const chSeeds = tier === 'labMax' ? seeds8 : seeds6;
    console.log(`\n=== MATRIX 2: CHASSIS ISOLATION (${tier.toUpperCase()}, ${chSeeds.length} seeds/combo) ===`);
    for (const chassis of CHASSIS_IDS) {
        const chRuns: SimResult[] = [];
        for (const build of BUILDS) {
            const runs = chSeeds.map(seed => runSimulation({ build, labTier: tier, chassisOverride: chassis, playStyle: 'kiting', maxTimeSec: 720, seed }));
            runs.forEach(r => { allRuns.push({ suite: 'chassis', result: r }); chRuns.push(r); });
            const bs = summarizeRuns(`${tier}_${chassis}_${build}`, runs);
            chassisSummaries[bs.label] = bs;
            pushSummaryCsv('chassis_combo', bs);
        }
        const cs = summarizeRuns(`${tier}_CHASSIS_${chassis}`, chRuns);
        chassisSummaries[cs.label] = cs;
        pushSummaryCsv('chassis_agg', cs);
        console.log(`${chassis.padEnd(12)} | W ${cs.wave.mean} (med ${cs.wave.median}, sd ${cs.wave.sd}) | Scrap ${cs.scrap.mean} | Lv ${cs.level.mean} | DPS ${cs.dps.mean} | DTPS ${cs.dtps.mean} | W15=${cs.waveReachPct[15]}% W20=${cs.waveReachPct[20]}% W30=${cs.waveReachPct[30]}%`);
    }
}

// Print key suboptimal / optimal pairings at labMax
console.log('\n--- LABMAX CHASSIS x BUILD WAVE MATRIX ---');
for (const build of BUILDS) {
    const row = CHASSIS_IDS.map(ch => {
        const s = chassisSummaries[`labMax_${ch}_${build}`];
        return `${ch}:${s.wave.mean}(W30:${s.waveReachPct[30]}%)`;
    }).join(' | ');
    console.log(`${build.padEnd(11)} => ${row}`);
}

// 4. Matrix 3: Playstyle & Skill Sensitivity (stationary, moderate, evasive vs kiting)
const playstyleSummaries: Record<string, ReturnType<typeof summarizeRuns>> = {};
for (const style of ['stationary', 'moderate', 'evasive'] as PlayStyle[]) {
    console.log(`\n=== MATRIX 3: PLAYSTYLE ${style.toUpperCase()} (6 seeds/build x 3 tiers) ===`);
    for (const tier of LAB_TIERS) {
        const tierRuns: SimResult[] = [];
        for (const build of BUILDS) {
            const runs = seeds6.map(seed => runSimulation({ build, labTier: tier, playStyle: style, maxTimeSec: 720, seed }));
            runs.forEach(r => { allRuns.push({ suite: `style_${style}`, result: r }); tierRuns.push(r); });
            const s = summarizeRuns(`${style}_${tier}_${build}`, runs);
            playstyleSummaries[s.label] = s;
            pushSummaryCsv(`style_${style}`, s);
        }
        const ts = summarizeRuns(`${style}_${tier}_ALL`, tierRuns);
        playstyleSummaries[ts.label] = ts;
        pushSummaryCsv(`style_${style}_tier`, ts);
        console.log(`${style.padEnd(10)} ${tier.padEnd(6)} | W ${ts.wave.mean} (max ${ts.wave.max}) | T ${ts.time.mean}s | Scrap ${ts.scrap.mean} | DTPS ${ts.dtps.mean} | W7=${ts.waveReachPct[7]}% W15=${ts.waveReachPct[15]}%`);
    }
}

// 5. Matrix 4: Random Choices & Checkpoint W26
console.log('\n=== MATRIX 4A: RANDOM CARD CHOICES (8 seeds/build x 3 tiers) ===');
const randomSummaries: Record<string, ReturnType<typeof summarizeRuns>> = {};
for (const tier of LAB_TIERS) {
    const tierRuns: SimResult[] = [];
    for (const build of BUILDS) {
        const runs = seeds8.map(seed => runSimulation({ build, labTier: tier, playStyle: 'kiting', useRandomChoices: true, maxTimeSec: 720, seed }));
        runs.forEach(r => { allRuns.push({ suite: 'random_picks', result: r }); tierRuns.push(r); });
    }
    const ts = summarizeRuns(`random_${tier}_ALL`, tierRuns);
    randomSummaries[ts.label] = ts;
    pushSummaryCsv('random_picks', ts);
    const smart = matrix1Summaries[`${tier}_ALL`];
    console.log(`${tier.padEnd(6)} | Random W ${ts.wave.mean} (Scrap ${ts.scrap.mean}) vs Smart W ${smart.wave.mean} (Scrap ${smart.scrap.mean}) | ΔWave ${r2(smart.wave.mean - ts.wave.mean)}`);
}

console.log('\n=== MATRIX 4C: CHECKPOINT W26 (LABMAX, 10 seeds/build, cap W38) ===');
const seeds10 = makeSeeds(701, 10, 29);
const cp26Summaries: Record<string, ReturnType<typeof summarizeRuns>> = {};
for (const build of BUILDS) {
    const runs = seeds10.map(seed => runSimulation({ build, labTier: 'labMax', playStyle: 'kiting', startWave: 26, maxTimeSec: 760, seed }));
    runs.forEach(r => allRuns.push({ suite: 'cp26', result: r }));
    const s = summarizeRuns(`cp26_labMax_${build}`, runs, 26);
    cp26Summaries[s.label] = s;
    pushSummaryCsv('cp26', s);
    console.log(`CP26 ${build.padEnd(11)} | W ${s.wave.mean} (med ${s.wave.median}, max ${s.wave.max}) | Scrap ${s.scrap.mean} (${s.scrapPerMin.mean}/m) | Lv ${s.level.mean} | W30=${s.waveReachPct[30]}% | SurvdCap=${s.survivalEndRate}%`);
}

// 6. Card & Evolution Pick Analysis + Economy Progression Projections
console.log('\n=== CARD & EVO FREQUENCY (MATRIX 1 LABMAX) ===');
for (const build of BUILDS) {
    const s = matrix1Summaries[`labMax_${build}`];
    console.log(`${build.padEnd(11)} | Evos: ${JSON.stringify(s.evoPct)} | TopCards: ${s.topCards.map(c => `${c.id}(${c.avgLv})`).join(', ')}`);
}

console.log('\n=== ECONOMY CADENCE PROJECTIONS (KITING BASELINE) ===');
for (const tier of LAB_TIERS) {
    const s = matrix1Summaries[`${tier}_ALL`];
    const avgScrap = s.scrap.mean;
    const avgMin = s.time.mean / 60;
    const scrapHr = s.scrapPerMin.mean * 60;
    const runsForLv1 = r2(45 / Math.max(0.01, avgScrap));
    const runsForGuardiao = r2(240 / Math.max(0.01, avgScrap));
    const runsForTesla = r2(480 / Math.max(0.01, avgScrap));
    const runsForSombra = r2(900 / Math.max(0.01, avgScrap));
    console.log(
        `${tier.padEnd(6)} | AvgScrap ${avgScrap} (P25=${s.scrap.p25}, P75=${s.scrap.p75}, min=${s.scrap.min}, max=${s.scrap.max}) | ` +
        `${s.scrapPerMin.mean}/min (${r2(scrapHr)}/h) | AvgTime ${r2(avgMin)}m | ` +
        `1stLab(45)=${runsForLv1}r | Guardiao(240)=${runsForGuardiao}r | Tesla(480)=${runsForTesla}r | Sombra(900)=${runsForSombra}r | FullMeta(${totalLabCostAll + totalChassisCost})=${r2((totalLabCostAll + totalChassisCost) / Math.max(1, scrapHr))}h`
    );
}

// Check Seed-level extremes in Matrix 1
const m1Runs = allRuns.filter(x => x.suite === 'matrix1').map(x => x.result);
const topRun = [...m1Runs].sort((a, b) => b.deathWave - a.deathWave || b.survivalTime - a.survivalTime)[0];
const worstLab0 = [...m1Runs.filter(r => r.labTier === 'lab0')].sort((a, b) => a.survivalTime - b.survivalTime)[0];
const worstLabMax = [...m1Runs.filter(r => r.labTier === 'labMax')].sort((a, b) => a.deathWave - b.deathWave || a.survivalTime - b.survivalTime)[0];

// Also run an isolated XP overflow test under hypothetical 0.45 cap just to prove formula accuracy
const overflowCheck = runSimulation({
    build: 'equilibrada',
    labTier: 'labMax',
    playStyle: 'kiting',
    seed: 101,
    xpCurve: { ...XP_CURVE, overflowCapRatio: 0.45 }
});

fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
fs.writeFileSync(path.join(ARTIFACT_DIR, 'balance_audit_summary.csv'), csvRows.join('\n'), 'utf8');
fs.writeFileSync(path.join(ARTIFACT_DIR, 'balance_audit_raw.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalSimulations: allRuns.length,
    elapsedMs: Date.now() - tStart,
    meta: {
        labMath,
        totalLabCostAll,
        tier1LabCostAll,
        totalChassisCost,
        xpTable,
        waveMath,
        tierBaselines,
        xpOverflowBaseline: 0,
        xpOverflowHypotheticalCap45: overflowCheck.xpOverflowLost
    },
    extremes: { topRun, worstLab0, worstLabMax },
    matrix1Summaries,
    chassisSummaries,
    playstyleSummaries,
    randomSummaries,
    cp26Summaries
}, null, 2), 'utf8');

console.log(`\nDone! ${allRuns.length} simulations completed in ${((Date.now() - tStart) / 1000).toFixed(2)}s.`);
console.log(`Artifacts saved to ${ARTIFACT_DIR}`);
