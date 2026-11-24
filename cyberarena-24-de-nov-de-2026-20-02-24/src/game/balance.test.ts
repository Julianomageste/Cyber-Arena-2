import test from 'node:test';
import assert from 'node:assert/strict';
import {
    CARDS, FALLBACK_CARDS, EVOLUTIONS, CHASSIS_DATA, LAB_UPGRADES, ECONOMY_TUNING, XP_CURVE, COMBAT_TUNING,
    labCost, nextMaxXp, applyXpGain, pickUpgradeChoices, getWaveCaps, getStarterPicksCount, getWaveEventPool, computeFixedBonus, XP_REWARDS, ENEMY_BASE_HP, ENEMY_BASE_DAMAGE, ENEMY_DISPLAY_NAMES, PLAYER_BASE_HEIGHT, PLAYER_VISUAL_HEIGHT, MIN_PLAYER_SHOT_RANGE, KAMIKAZE_EXPLOSION_RADIUS, getKamikazeExplosionRadius, getKamikazeChargeRange, BOSS_HP_MULTIPLIER, BOSS_SPRITE_DRAW_HEIGHT, ENEMY_VISUAL_HEIGHTS, CAMERA_TUNING, getCameraZoomForViewport, getEnemySpriteKey, getPlayerSpriteKey, getEnemyVisualScale,
    type PlayerStats, type HangarState
} from './balance';
import { runSimulation } from './sim';

function makeTestPlayer(overrides: Partial<PlayerStats> = {}): PlayerStats {
    return {
        x: 1200, y: 1200, r: 20, chassis: 'interceptor',
        spd: 260, maxHp: 100, hp: 100, inv: 0,
        aim: 0, dmg: 10, baseRate: 0.42, rate: 0.42, fireT: 0,
        range: 290, mag: 48, lv: 1, xp: 0, maxXp: XP_CURVE.initialMaxXp,
        spreadLv: 0, orbits: 0, orbitA: 0, pierce: 0, chain: 0, chainCD: 0,
        missiles: 0, missileT: 0, wingmen: 0, wingA: 0, wingFireT: 0,
        mineLv: 0, mineT: 0, laserLv: 0, laserT: 0,
        armor: 0, critChance: 0.06, critMult: 1.75, reactiveLv: 0, regen: 0,
        xpMult: 1, scrapMult: 1, enemySpdBonus: 0,
        empCd: 8, empRad: 225, walkPhase: 0, recoil: 0, evos: {},
        ...overrides
    };
}

test('XP curve preserves 100% overflow and supports multi-level jumps', () => {
    const p = makeTestPlayer({ lv: 1, xp: 0, maxXp: XP_CURVE.initialMaxXp });
    const req1 = p.maxXp;
    const req2 = nextMaxXp(req1, 2);
    const gained = applyXpGain(p, req1 + req2 + 12);
    assert.equal(gained, 2);
    assert.equal(p.lv, 3);
    assert.equal(p.xp, 12);
    assert.ok(p.maxXp < 150, `Lv3 maxXp should stay accessible, got ${p.maxXp}`);
});

test('XP curve remains smooth into Lv20 without exponential freeze', () => {
    let maxXp = XP_CURVE.initialMaxXp;
    for (let lv = 2; lv <= 20; lv++) {
        maxXp = nextMaxXp(maxXp, lv);
    }
    assert.ok(maxXp < 2500, `Lv20 maxXp should stay below 2500, got ${maxXp}`);
});

test('Economy: cheapest Lab Lv1 is affordable within ~1-2 short Lab0 runs and late wave bonus tapers', () => {
    const cheapestLab = Math.min(...LAB_UPGRADES.map(u => labCost(u, 0)));
    assert.ok(cheapestLab >= 30 && cheapestLab <= 45, `Expected cheapest Lab Lv1 in 30..45, got ${cheapestLab}`);
    assert.deepEqual(
        LAB_UPGRADES.map(u => ({ id: u.id, baseCost: u.baseCost, growth: u.growth, maxLv: u.maxLv })),
        [
            { id: 'hull', baseCost: 48, growth: 1.32, maxLv: 10 },
            { id: 'weapon', baseCost: 54, growth: 1.32, maxLv: 10 },
            { id: 'capacitor', baseCost: 66, growth: 1.32, maxLv: 10 },
            { id: 'engine', baseCost: 42, growth: 1.32, maxLv: 10 },
            { id: 'magnet', baseCost: 42, growth: 1.32, maxLv: 10 },
            { id: 'empCore', baseCost: 72, growth: 1.32, maxLv: 10 },
            { id: 'salvage', baseCost: 54, growth: 1.32, maxLv: 10 }
        ]
    );
    assert.ok(ECONOMY_TUNING.waveBonusFn(1) >= 2);
    assert.ok(ECONOMY_TUNING.waveBonusFn(20) <= 7);
    const guardiao = CHASSIS_DATA.find(c => c.id === 'guardiao')!;
    const tesla = CHASSIS_DATA.find(c => c.id === 'tesla')!;
    const sombra = CHASSIS_DATA.find(c => c.id === 'sombra')!;
    assert.ok(guardiao.cost < tesla.cost && tesla.cost < sombra.cost);
});

test('pickUpgradeChoices guarantees early weapon option, caps tactical cards, and handles maxed pool', () => {
    const p = makeTestPlayer({ lv: 2, hp: 100, maxHp: 100 });
    const picks = pickUpgradeChoices({
        player: p,
        upgradePicks: {},
        unlockedEvos: {},
        weaponSlotsUsed: new Set(),
        passiveSlotsUsed: new Set(),
        rng: () => 0.99 // worst-case order without weapon weighting
    });
    assert.equal(picks.length, 3);
    assert.ok(picks.some(o => o.card?.cat === 'weapon'), 'Early level should include a weapon option');

    // Maxed slots and all fallback levels exhausted at full HP -> still returns 3 options
    const allMaxed: Record<string, number> = {};
    for (const c of CARDS) allMaxed[c.id] = c.maxLv || 1;
    for (const f of FALLBACK_CARDS) allMaxed[f.id] = f.maxLv || 1;
    const maxedPicks = pickUpgradeChoices({
        player: makeTestPlayer({ lv: 35, hp: 100, maxHp: 100 }),
        upgradePicks: allMaxed,
        unlockedEvos: Object.fromEntries(EVOLUTIONS.map(e => [e.id, true])),
        weaponSlotsUsed: new Set(['TIRO EM LEQUE', 'ESCUDO ORBITAL', 'RAIO EM CADEIA', 'LANÇA-LASER']),
        passiveSlotsUsed: new Set(['ARMA PESADA', 'CADÊNCIA', 'VELOCIDADE', 'HP MÁXIMO'])
    });
    assert.equal(maxedPicks.length, 3);
});

test('Emergency Repair is offered only at 60% HP or below', () => {
    const repair = CARDS.find(c => c.id === 'REPARO')!;
    const base = {
        upgradePicks: {}, unlockedEvos: {}, weaponSlotsUsed: new Set<string>(), passiveSlotsUsed: new Set<string>(),
        cards: [repair], fallbackCards: [], evos: [], rng: () => 0.99
    };
    const aboveThreshold = pickUpgradeChoices({ player: makeTestPlayer({ lv: 5, hp: 61, maxHp: 100 }), ...base });
    const atThreshold = pickUpgradeChoices({ player: makeTestPlayer({ lv: 5, hp: 60, maxHp: 100 }), ...base });
    assert.equal(aboveThreshold.some(choice => choice.card?.id === 'REPARO'), false);
    assert.equal(atThreshold.some(choice => choice.card?.id === 'REPARO'), true);
});

test('Critical HP always offers an emergency repair card without consuming a passive slot', () => {
    const p = makeTestPlayer({ lv: 5, hp: 35, maxHp: 100 });
    const picks = pickUpgradeChoices({
        player: p,
        upgradePicks: {},
        unlockedEvos: {},
        weaponSlotsUsed: new Set(),
        passiveSlotsUsed: new Set(),
        rng: () => 0.99
    });
    const repair = picks.find(choice => choice.card?.id === 'REPARO')?.card;
    assert.ok(repair, 'Critical HP should guarantee Emergency Repair among the choices');
    repair!.fn(p, 1);
    assert.equal(p.hp, 65);
    assert.equal(repair!.noSlot, true);
});


test('Only the four real Boss entities can use the large Boss sprite assets and special units use their own sprites', () => {
    assert.equal(getEnemySpriteKey('boss', 'titan'), 'boss_titan');
    assert.equal(getEnemySpriteKey('boss', 'phantom'), 'boss_phantom');
    assert.equal(getEnemySpriteKey('boss', 'siege'), 'boss_siege');
    assert.equal(getEnemySpriteKey('boss', 'overlord'), 'boss_overlord');
    for (const kind of ['kamikaze', 'bastion', 'artillery', 'miniboss'] as const) {
        const key = getEnemySpriteKey(kind, 'siege');
        assert.equal(key, kind, `${kind} must use its own dedicated sprite rather than a Boss sprite`);
    }
    assert.equal(getEnemySpriteKey('tank', 'siege'), null);
});

test('Each player chassis maps to its dedicated Laboratory and combat sprite key', () => {
    assert.equal(getPlayerSpriteKey('interceptor'), 'player');
    assert.equal(getPlayerSpriteKey('guardiao'), 'player_guardiao');
    assert.equal(getPlayerSpriteKey('tesla'), 'player_tesla');
    assert.equal(getPlayerSpriteKey('sombra'), 'player_sombra');
    assert.equal(getPlayerSpriteKey('unknown'), 'player');
});

test('Special enemy proportions, Arpoador name, Kamikaze blast & charge range, and fallback scales match spec', () => {
    assert.equal(ENEMY_DISPLAY_NAMES.artillery.pt, 'Arpoador');
    assert.equal(ENEMY_DISPLAY_NAMES.artillery.en, 'Harpooner');
    assert.equal(PLAYER_VISUAL_HEIGHT, Math.round(PLAYER_BASE_HEIGHT * 1.35));
    assert.equal(ENEMY_VISUAL_HEIGHTS.kamikaze, Math.round(46 * 1.75));
    assert.equal(ENEMY_VISUAL_HEIGHTS.artillery, Math.round(PLAYER_BASE_HEIGHT * 1.30));
    assert.equal(ENEMY_VISUAL_HEIGHTS.bastion, Math.round(PLAYER_BASE_HEIGHT * 1.50));
    assert.equal(ENEMY_VISUAL_HEIGHTS.miniboss, Math.round(PLAYER_BASE_HEIGHT * 1.50));
    assert.equal(KAMIKAZE_EXPLOSION_RADIUS, Math.round(290 * 0.50));
    assert.equal(getKamikazeExplosionRadius(290), 145);
    assert.equal(getKamikazeChargeRange(290), Math.round(290 * 1.10));
    assert.ok(Math.abs(getEnemyVisualScale('kamikaze') * 42 - 81) < 1e-9);
    assert.ok(Math.abs(getEnemyVisualScale('bastion') * 46 - 84) < 1e-9);
    assert.ok(Math.abs(getEnemyVisualScale('artillery') * 44 - 73) < 1e-9);
    assert.ok(Math.abs(getEnemyVisualScale('miniboss') * 62 - 84) < 1e-9);
});

test('Emergency Repair remains guaranteed at the next card selection after crossing 60% HP', () => {
    const repair = CARDS.find(c => c.id === 'REPARO')!;
    const picks = pickUpgradeChoices({
        player: makeTestPlayer({ lv: 6, hp: 72, maxHp: 100 }),
        upgradePicks: {}, unlockedEvos: {},
        weaponSlotsUsed: new Set(), passiveSlotsUsed: new Set(),
        cards: [repair], fallbackCards: [], evos: [], forceRepair: true,
        rng: () => 0.5
    });
    assert.ok(picks.some(choice => choice.card?.id === 'REPARO'));
});

test('Checkpoint kits and event unlocks are progressive', () => {
    assert.equal(getStarterPicksCount(1), 0);
    assert.equal(getStarterPicksCount(6), 4);
    assert.equal(getStarterPicksCount(11), 5);
    assert.equal(getStarterPicksCount(16), 6);
    assert.equal(getStarterPicksCount(46), 12);
    assert.deepEqual(getWaveEventPool(4), ['relay', 'supply_pod']);
    assert.ok(!getWaveEventPool(6).includes('orbital_sweep'), 'Hostile area events should not appear in the first six waves');
    assert.ok(getWaveEventPool(8).includes('orbital_sweep'));
    assert.ok(!getWaveEventPool(10).includes('miniboss'));
    assert.ok(getWaveEventPool(12).includes('miniboss'));
});

test('Reactive Armor respects COMBAT_TUNING.armorCap', () => {
    const p = makeTestPlayer({ armor: 0.14 });
    const reactive = CARDS.find(c => c.id === 'BLINDAGEM REATIVA')!;
    for (let i = 0; i < 3; i++) reactive.fn(p, 1);
    assert.ok(Math.abs(p.armor - 0.44) < 1e-9);
    assert.equal(reactive.pt[0], 'COLETE À PROVA DE BALAS');
});

test('Drone XP no longer snowballs; tougher enemies carry the larger XP rewards', () => {
    assert.equal(XP_REWARDS.commonDrone, 2);
    assert.equal(XP_REWARDS.swarmDrone, 2);
    assert.equal(XP_REWARDS.gunner, 10);
    assert.equal(XP_REWARDS.kamikaze, 10);
    assert.equal(XP_REWARDS.sniper, 12);
    assert.equal(XP_REWARDS.tank, 20);
    assert.equal(XP_REWARDS.bastion, 20);
    assert.equal(XP_REWARDS.artillery, 18);
    assert.equal(XP_REWARDS.relayCrystal * 4, 32);
    assert.equal(XP_REWARDS.supplyPodCrystal * 6, 48);
    assert.equal(ENEMY_BASE_HP.gunner, 26);
    assert.equal(ENEMY_BASE_HP.kamikaze, 21);
    assert.equal(ENEMY_BASE_HP.sniper, 34);
    assert.equal(ENEMY_BASE_HP.tank, 105);
    assert.equal(ENEMY_BASE_HP.bastion, 68);
    assert.equal(ENEMY_BASE_HP.artillery, 42);
    assert.equal(ENEMY_BASE_HP.miniboss, 115);
    assert.equal(XP_CURVE.initialMaxXp, 55);
    assert.equal(XP_CURVE.waveXpScale, 0.045);
    assert.equal(ECONOMY_TUNING.scrapRewardScale, 1.70);
    assert.equal(BOSS_HP_MULTIPLIER, 1.5);
    assert.equal(BOSS_SPRITE_DRAW_HEIGHT, 128);
});

test('Specialist enemies enter earlier and arrive more frequently', () => {
    const w2 = getWaveCaps(2), w3 = getWaveCaps(3), w4 = getWaveCaps(4);
    const w5 = getWaveCaps(5), w7 = getWaveCaps(7), w9 = getWaveCaps(9);
    assert.equal(w2.maxGunners, 1);
    assert.equal(w3.maxTanks, 1);
    assert.equal(w4.maxKamikazes, 1);
    assert.equal(w5.maxSnipers, 1);
    assert.equal(w7.maxBastions, 1);
    assert.equal(w9.maxArtillery, 1);
    assert.equal(w2.gunnerIntervalSec, 4.6);
    assert.equal(w3.tankIntervalSec, 6.1);
    assert.equal(w4.kamikazeIntervalSec, 6.6);
    assert.equal(w5.sniperIntervalSec, 7.0);
    assert.equal(w7.bastionIntervalSec, 7.5);
    assert.equal(w9.artilleryIntervalSec, 8.2);
});

test('Camera zoom expands the field of view by device profile without shrinking actor sprites', () => {
    assert.equal(getCameraZoomForViewport(1920, 1080), CAMERA_TUNING.desktopZoom);
    assert.equal(getCameraZoomForViewport(768, 1024), CAMERA_TUNING.tabletZoom);
    assert.equal(getCameraZoomForViewport(1280, 720), CAMERA_TUNING.tabletZoom);
    assert.equal(getCameraZoomForViewport(390, 844), CAMERA_TUNING.mobileZoom);
    assert.equal(ENEMY_VISUAL_HEIGHTS.gunner, 50);
    assert.equal(ENEMY_VISUAL_HEIGHTS.sniper, 50);
    assert.equal(ENEMY_VISUAL_HEIGHTS.kamikaze, 81);
    assert.equal(ENEMY_VISUAL_HEIGHTS.artillery, 73);
    assert.equal(ENEMY_VISUAL_HEIGHTS.bastion, 84);
    assert.equal(ENEMY_VISUAL_HEIGHTS.tank, 112);
    assert.equal(ENEMY_VISUAL_HEIGHTS.miniboss, 84);
    assert.ok(ENEMY_BASE_DAMAGE.tank > ENEMY_BASE_DAMAGE.sniper, 'Tank damage must exceed Sniper damage');
    assert.ok(ENEMY_BASE_DAMAGE.tank > ENEMY_BASE_DAMAGE.gunner, 'Tank damage must exceed Gunner damage');
    assert.ok(ENEMY_VISUAL_HEIGHTS.bastion > ENEMY_VISUAL_HEIGHTS.gunner);
    assert.equal(ENEMY_VISUAL_HEIGHTS.drone, 34);
    assert.equal(CAMERA_TUNING.playerVisualScale, 1.512);
    assert.ok(CAMERA_TUNING.enemyProjectileScale >= 1.35, 'Enemy projectiles must be visibly enlarged');
    assert.ok(CAMERA_TUNING.playerProjectileScale > 1.0, 'Player projectiles receive a small visibility boost');
});

test('Wave scaling preserves pressure and unlocks specialist enemies progressively', () => {
    const w2 = getWaveCaps(2);
    const w4 = getWaveCaps(4);
    const w6 = getWaveCaps(6);
    const w7 = getWaveCaps(7);
    const w8 = getWaveCaps(8);
    const w12 = getWaveCaps(12);
    const w13 = getWaveCaps(13);
    const w30 = getWaveCaps(30);
    assert.ok(w4.hpMult >= 1.25 && w4.hpMult <= 1.35);
    assert.ok(w6.hpMult >= 1.5 && w6.hpMult <= 1.65);
    assert.ok(w7.hpMult > 1.6 && w7.hpMult < 2);
    assert.ok(w30.hpMult > 12 && w30.hpMult < 14);
    assert.ok(w6.dronesPerSec < 2.0, `Wave 6 drone pressure is too high: ${w6.dronesPerSec}`);
    assert.equal(w4.maxSnipers, 0);
    assert.equal(w6.maxArtillery, 0);
    assert.equal(w8.maxSnipers, 1);
    assert.equal(w12.maxArtillery, 1);
    assert.equal(w7.maxEnemies, 19);
    assert.equal(w2.maxDrones, 6);
    assert.ok(w13.maxEnemies > w13.maxDrones, 'specialists must have reserved arena capacity');
    assert.equal(getWaveCaps(1).dronesPerSec, 0.75);
    assert.equal(getWaveCaps(50).dronesPerSec, 1.7);
    assert.equal(getWaveCaps(50).maxEnemies, 34);
});

test('computeFixedBonus reflects Lab upgrades and chassis multipliers', () => {
    const baseHangar: HangarState = {
        kills: 0, tanks: 0, bestWave: 0, bestTime: 0, bestLevel: 1, scrap: 0,
        ach: { exterminador: 0, sobrevivente: 0, cacatanques: 0, arsenal: 0 },
        chassis: 'interceptor', unlockedChassis: { interceptor: true },
        lab: { hull: 0, weapon: 0, capacitor: 0, engine: 0, magnet: 0, empCore: 0, salvage: 0 },
        goldSkinActive: false
    };
    const b0 = computeFixedBonus(baseHangar);
    assert.equal(b0.mag, 116);
    const upgradedHangar: HangarState = {
        ...baseHangar,
        lab: { hull: 2, weapon: 2, capacitor: 2, engine: 2, magnet: 2, empCore: 1, salvage: 2 }
    };
    const b1 = computeFixedBonus(upgradedHangar);
    assert.equal(b1.mag, 126);
    assert.ok(b1.hp > b0.hp && b1.dmg > b0.dmg && b1.spd > b0.spd && b1.rate < b0.rate && b1.scrapMult > b0.scrapMult);
});

test('Simulation: Stationary AFK cannot survive indefinitely even at LabMax', () => {
    const afkLab0 = runSimulation({ build: 'defensiva', labTier: 'lab0', playStyle: 'stationary', seed: 101, maxTimeSec: 300 });
    const afkMax = runSimulation({ build: 'defensiva', labTier: 'labMax', playStyle: 'stationary', seed: 101, maxTimeSec: 300 });
    assert.equal(afkLab0.survivedToEnd, false);
    assert.ok(afkLab0.deathWave <= 10, `AFK Lab0 survived too long: wave ${afkLab0.deathWave}`);
    assert.equal(afkMax.survivedToEnd, false);
    assert.ok(afkMax.deathWave <= 14, `AFK LabMax survived too long: wave ${afkMax.deathWave}`);
});

test('Simulation: Lab progression improves survival and first upgrade arrives by the end of wave 2', () => {
    const lab0 = runSimulation({ build: 'equilibrada', labTier: 'lab0', playStyle: 'kiting', seed: 101 });
    const labMid = runSimulation({ build: 'equilibrada', labTier: 'labMid', playStyle: 'kiting', seed: 101 });
    const cheapestLab = Math.min(...LAB_UPGRADES.map(u => labCost(u, 0)));
    assert.ok(lab0.firstUpgradeTime !== null && lab0.firstUpgradeTime <= 45, `First XP upgrade too slow: ${lab0.firstUpgradeTime}s`);
    assert.ok(lab0.scrapEarned * 2 >= cheapestLab * 0.9, `Lab0 scrap too low: ${lab0.scrapEarned} vs cheapest ${cheapestLab}`);
    assert.ok(labMid.deathWave > lab0.deathWave, `LabMid (${labMid.deathWave}) should outperform Lab0 (${lab0.deathWave})`);
});

test('Checkpoint simulation starts with the intended starter build kit', () => {
    const checkpoint = runSimulation({
        build: 'equilibrada', labTier: 'lab0', playStyle: 'kiting', startWave: 6,
        maxTimeSec: 145, seed: 202
    });
    assert.ok(checkpoint.upgradeTimes.length >= 4, `Expected 4 starter picks, got ${checkpoint.upgradeTimes.length}`);
    assert.ok(checkpoint.finalLevel >= 5, `Checkpoint should begin at starter-kit level 5, got ${checkpoint.finalLevel}`);
});

