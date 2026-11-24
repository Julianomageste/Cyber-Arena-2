import {
    CARDS, FALLBACK_CARDS, EVOLUTIONS, LAB_UPGRADES, ECONOMY_TUNING, XP_CURVE, COMBAT_TUNING,
    CAMPAIGN_TUNING, REPAIR_CAPSULE_TUNING, SCAVENGER_TUNING, BOSS_REINFORCEMENT_REGEN_PER_SEC,
    SPAWN_DIRECTOR_CONFIG,
    computeFixedBonus, labCost, getWaveCaps, getStarterPicksCount, getWaveEventPool, XP_REWARDS,
    ENEMY_BASE_HP, ENEMY_BASE_DAMAGE, getKamikazeExplosionRadius, getKamikazeChargeRange,
    applyXpGain, nextMaxXp, pickUpgradeChoices, applyRepairCapsulePickup, resetTempMaxHpAfterBoss,
    applyScavengerScrapSteal, computeScavengerDeathScrap, getStageForWave, isBossTriggerWave,
    getBossEncounterConfigByStage, createSeededRng, createAdaptiveSpawnDirector, stepAdaptiveSpawnDirector,
    type ChassisId, type HangarState, type PlayerStats, type CardDef, type EvoDef,
    type EconomyTuning, type CombatTuning, type LabUpgradeDef, type SpawnDirectorOverrides
} from './balance';

export type BuildArchetype = 'cadencia' | 'cadeia' | 'drones' | 'defensiva' | 'equilibrada';
export type LabTier = 'lab0' | 'lab3' | 'labMid' | 'labMax';
export type PlayStyle = 'kiting' | 'stationary' | 'moderate' | 'evasive' | 'dodge_only';

export interface SimConfig {
    build: BuildArchetype;
    labTier: LabTier;
    playStyle?: PlayStyle;
    chassisOverride?: ChassisId;
    startWave?: number;
    maxTimeSec?: number;
    seed?: number;
    economy?: EconomyTuning;
    xpCurve?: typeof XP_CURVE;
    combat?: CombatTuning;
    repairCapsuleTuning?: { droneRepairAmount: number; droneMaxHpGainWhenFull: number };
    directorOverrides?: SpawnDirectorOverrides;
    cards?: CardDef[];
    fallbackCards?: CardDef[];
    evos?: EvoDef[];
    labUpgrades?: LabUpgradeDef[];
    customLab?: Record<string, number>;
    useSmartChoices?: boolean;
    useRandomChoices?: boolean;
    noCardPicks?: boolean;
    focusTank?: boolean;
    stopAfterBossVictory?: boolean;
    maxBossRetries?: number;
    collectPickupRate?: number;
    simulateBossReinforcementWave?: boolean;
}

export interface WaveSnapshot {
    wave: number;
    timeSec: number;
    hp: number;
    maxHp: number;
    lv: number;
    scrapEarned: number;
    dmgDealt: number;
    dmgReceived: number;
    kills: number;
}

export interface SimResult {
    build: BuildArchetype;
    labTier: LabTier;
    playStyle: PlayStyle;
    chassis: ChassisId;
    survivedToEnd: boolean;
    deathWave: number;
    survivalTime: number;
    scrapEarned: number;
    finalLevel: number;
    endHp: number;
    endMaxHp: number;
    kills: number;
    tanks: number;
    damageDealt: number;
    damageReceived: number;
    primaryShotsFired: number;
    primaryShotsPerMin: number;
    firstUpgradeTime: number | null;
    secondUpgradeTime: number | null;
    thirdUpgradeTime: number | null;
    upgradeTimes: number[];
    upgradesPicked: Record<string, number>;
    evosUnlocked: string[];
    waveSnapshots: Record<number, WaveSnapshot>;
    levelTimes: Record<number, number>;
    fallbackPicks: number;
    xpOverflowLost: number;
    killsByType: Record<string, number>;
    damageBySource: Record<string, number>;
    capsulesDropped: number;
    capsulesCollected: number;
    capsuleHealTotal: number;
    capsuleTempMaxHpGained: number;
    scavengerStolenTotal: number;
    scavengerReturnedTotal: number;
    directorStats: {
        spawnedByType: Record<string, number>;
        droppedDrones: number;
        delayedDangerousSpawns: number;
    };
    bossAttempts: number;
    bossDefeated: boolean;
    bossAttacks: {
        fireCount: number;
        laserCount: number;
        missilesLaunched: number;
        missilesIntercepted: number;
        bombsDropped: number;
        bombsHit: number;
    };
}

const ARENA_W = 2800;
const ARENA_H = 2800;
const PAD = 46;
const DT = 1 / 20;

export function buildHangarForTier(
    tier: LabTier,
    _build: BuildArchetype,
    chassisOverride?: ChassisId,
    customLab?: Record<string, number>
): HangarState {
    const defaultChassis: ChassisId = chassisOverride || 'interceptor';
    const unlockedAll: Record<string, boolean> = {
        interceptor: true,
        parasita: tier !== 'lab0',
        tesla: tier === 'labMid' || tier === 'labMax',
        sombra: tier === 'labMax',
        carrasco: tier === 'labMax',
        fenix: tier === 'labMax',
        guardiao: tier === 'labMax',
        vortice: tier === 'labMax',
        chronos: tier === 'labMax',
        robot_10: false
    };

    if (customLab) {
        return {
            kills: 0, tanks: 0, bestWave: 0, bestTime: 0, bestLevel: 1, scrap: 0,
            ach: { exterminador: 0, sobrevivente: 0, cacatanques: 0, arsenal: 0 },
            chassis: defaultChassis,
            unlockedChassis: unlockedAll,
            lab: {
                hull: customLab.hull || 0,
                weapon: customLab.weapon || 0,
                capacitor: customLab.capacitor || 0,
                engine: customLab.engine || 0,
                magnet: customLab.magnet || 0,
                empCore: customLab.empCore || 0,
                salvage: customLab.salvage || 0,
            },
            goldSkinActive: false,
        };
    }

    if (tier === 'lab0') {
        return {
            kills: 0, tanks: 0, bestWave: 0, bestTime: 0, bestLevel: 1, scrap: 0,
            ach: { exterminador: 0, sobrevivente: 0, cacatanques: 0, arsenal: 0 },
            chassis: defaultChassis,
            unlockedChassis: { interceptor: true },
            lab: { hull: 0, weapon: 0, capacitor: 0, engine: 0, magnet: 0, empCore: 0, salvage: 0 },
            goldSkinActive: false,
        };
    }
    if (tier === 'lab3') {
        return {
            kills: 450, tanks: 20, bestWave: 6, bestTime: 300, bestLevel: 8, scrap: 0,
            ach: { exterminador: 0, sobrevivente: 0, cacatanques: 0, arsenal: 0 },
            chassis: defaultChassis,
            unlockedChassis: { interceptor: true, parasita: true },
            lab: { hull: 3, weapon: 3, capacitor: 3, engine: 3, magnet: 3, empCore: 3, salvage: 3 },
            goldSkinActive: false,
        };
    }
    if (tier === 'labMid') {
        return {
            kills: 1500, tanks: 70, bestWave: 16, bestTime: 900, bestLevel: 16, scrap: 0,
            ach: { exterminador: 1, sobrevivente: 1, cacatanques: 1, arsenal: 1 },
            chassis: defaultChassis,
            unlockedChassis: unlockedAll,
            lab: { hull: 5, weapon: 5, capacitor: 4, engine: 4, magnet: 4, empCore: 4, salvage: 4 },
            goldSkinActive: false,
        };
    }
    return {
        kills: 12000, tanks: 500, bestWave: 50, bestTime: 3000, bestLevel: 30, scrap: 0,
        ach: { exterminador: 3, sobrevivente: 3, cacatanques: 3, arsenal: 3 },
        chassis: defaultChassis,
        unlockedChassis: unlockedAll,
        lab: { hull: 10, weapon: 10, capacitor: 10, engine: 10, magnet: 10, empCore: 10, salvage: 10 },
        goldSkinActive: false,
    };
}

const BUILD_PRIORITIES: Record<BuildArchetype, string[]> = {
    cadencia: [
        'TIRO EM LEQUE', 'CADÊNCIA', 'ARMA PESADA', 'FRENESI CURTO', 'MIRAS CRÍTICAS',
        'TIRO PERFURANTE', 'CANHÃO DE VIDRO', 'SOBRECARGA NÚCLEO', 'VELOCIDADE', 'LANÇA-LASER'
    ],
    cadeia: [
        'RAIO EM CADEIA', 'ARMA PESADA', 'CADÊNCIA', 'CAPACITOR EMP', 'TIRO PERFURANTE',
        'MIRAS CRÍTICAS', 'CATALISADOR DE XP', 'VELOCIDADE', 'HP MÁXIMO'
    ],
    drones: [
        'MINI-DRONE ALIADO', 'MÍSSEIS TELEGUIADOS', 'LANÇA-LASER', 'ARMA PESADA', 'CADÊNCIA',
        'TIRO PERFURANTE', 'CAPACITOR EMP', 'CATALISADOR DE XP', 'VELOCIDADE', 'HP MÁXIMO'
    ],
    defensiva: [
        'ESCUDO ORBITAL', 'BLINDAGEM REATIVA', 'NANO-REGENERAÇÃO', 'HP MÁXIMO', 'CATALISADOR DE XP',
        'MINAS DE PROXIMIDADE', 'CAPACITOR EMP', 'VELOCIDADE', 'ARMA PESADA', 'CADÊNCIA'
    ],
    equilibrada: [
        'TIRO EM LEQUE', 'ESCUDO ORBITAL', 'ARMA PESADA', 'CADÊNCIA', 'MÍSSEIS TELEGUIADOS',
        'HP MÁXIMO', 'BLINDAGEM REATIVA', 'VELOCIDADE', 'RAIO EM CADEIA', 'CATALISADOR DE XP'
    ]
};

function scoreOption(
    opt: { isEvo: boolean; evo?: EvoDef; card?: CardDef; mult: number },
    build: BuildArchetype
): number {
    if (opt.isEvo) return 1000;
    const id = opt.card?.id || '';
    const list = BUILD_PRIORITIES[build];
    const idx = list.indexOf(id);
    if (idx !== -1) return 500 - idx * 25 + (opt.mult - 1) * 40;
    if (id === 'REPARO') return 450;
    if (opt.card?.cat === 'tactical' && build === 'defensiva') return 5;
    if (opt.card?.cat === 'weapon') return 120;
    if (opt.card?.noSlot) return 20 + (id === 'REPARO' ? 15 : 0);
    return 80 + (opt.mult - 1) * 30;
}

export function runSimulation(cfg: SimConfig): SimResult {
    const seed = cfg.seed ?? 1337;
    const rng = createSeededRng(seed);
    const econ = cfg.economy ?? ECONOMY_TUNING;
    const xpCurve = cfg.xpCurve ?? XP_CURVE;
    const combat = cfg.combat ?? COMBAT_TUNING;
    const capsuleTuning = cfg.repairCapsuleTuning ?? REPAIR_CAPSULE_TUNING;
    const cards = cfg.cards ?? CARDS;
    const fallbackCards = cfg.fallbackCards ?? FALLBACK_CARDS;
    const evos = cfg.evos ?? EVOLUTIONS;

    const playStyle: PlayStyle = cfg.playStyle ?? 'kiting';
    const startWave = Math.max(1, cfg.startWave ?? 1);
    const waveDur = CAMPAIGN_TUNING.normalWaveDurationSec;
    const maxTimeSec = cfg.maxTimeSec ?? (startWave > 1 ? 360 : 300);
    const hangar = buildHangarForTier(cfg.labTier, cfg.build, cfg.chassisOverride, cfg.customLab);
    const bonus = computeFixedBonus(hangar);
    const ch = bonus.ch;
    const startHp = bonus.hp;
    const startDmg = bonus.dmg;

    const player: PlayerStats = {
        x: ARENA_W / 2, y: ARENA_H / 2, r: 20, chassis: ch.id,
        spd: bonus.spd, maxHp: startHp, hp: startHp, tempMaxHpBonus: 0, inv: 0,
        aim: 0, dmg: startDmg, baseRate: bonus.rate, rate: bonus.rate, fireT: 0,
        range: 290, mag: bonus.mag, lv: 1, xp: 0, maxXp: xpCurve.initialMaxXp,
        spreadLv: 0, orbits: 0, orbitA: 0, pierce: 0, chain: ch.chain, chainCD: 0,
        missiles: 0, missileT: 0, wingmen: 0, wingA: 0, wingFireT: 0,
        mineLv: 0, mineT: 0, laserLv: 0, laserT: 0,
        armor: ch.armor, critChance: ch.crit, critMult: 1.75, reactiveLv: 0, regen: 0,
        xpMult: 1, scrapMult: bonus.scrapMult, enemySpdBonus: 0,
        empCd: bonus.empCd, empRad: bonus.empRad,
        walkPhase: 0, recoil: 0, evos: {}
    };

    const weaponSlotsUsed = new Set<string>();
    const passiveSlotsUsed = new Set<string>();
    const upgradePicks: Record<string, number> = {};
    const unlockedEvos: Record<string, boolean> = {};
    if (ch.chain > 0) {
        upgradePicks['RAIO EM CADEIA'] = 1;
        weaponSlotsUsed.add('RAIO EM CADEIA');
    }

    let wave = startWave;
    let playT = 0;
    let roundCD = waveDur;
    let scrapBank = 0;
    let runScrap = 0;
    let runKills = 0;
    let runTanks = 0;
    let damageDealt = 0;
    let damageReceived = 0;
    let primaryShotsFired = 0;
    const upgradeTimes: number[] = [];
    const waveSnapshots: Record<number, WaveSnapshot> = {};
    const levelTimes: Record<number, number> = {};
    const killsByType: Record<string, number> = {};
    const damageBySource: Record<string, number> = {};
    let fallbackPicks = 0;
    let xpOverflowLost = 0;
    let capsulesDropped = 0;
    let capsulesCollected = 0;
    let capsuleHealTotal = 0;
    let capsuleTempMaxHpGained = 0;
    let scavengerStolenTotal = 0;
    let scavengerReturnedTotal = 0;
    let bossAttempts = 0;
    let bossDefeated = false;

    const bossAttacks = {
        fireCount: 0,
        laserCount: 0,
        missilesLaunched: 0,
        missilesIntercepted: 0,
        bombsDropped: 0,
        bombsHit: 0
    };

    let empCD = 0;
    let overchargeT = 0;
    let globalMagT = 0;
    let supply: { x: number; y: number; life: number; evoChest: boolean } | null = null;
    let supplyT = 0;
    let arenaEvent: { type: string; x: number; y: number; r: number; dur: number; prog: number; life: number } | null = null;
    let eventCD = 22;
    let bossPhase: 'none' | 'cleanup' | 'active' = 'none';
    let bossCleanupT = 0;
    let currentBossStage = getStageForWave(wave);
    const recentEvents: string[] = [];
    let pendingKillLevelUps = 0;
    const director = createAdaptiveSpawnDirector(seed, wave);
    let nextEnemyId = 1;

    let playerKnockVx = 0, playerKnockVy = 0, playerKnockT = 0, playerPullT = 0;
    let playerTether: { sourceId: number; timer: number } | null = null;

    interface SimEnemy {
        id: number; t: string; isBossUnit?: boolean; bossVariant?: string; bounty: boolean;
        summonedByBossId?: number;
        baseMaxHp?: number; stolenScrap?: number;
        x: number; y: number; r: number; spd: number; hp: number; maxHp: number;
        dmg: number; xp: number; scrap: number; a: number; del?: boolean;
        stun?: number; stunImm?: number; _orbHit?: number[];
        fireCD?: number; prepT?: number; burstLeft?: number; burstT?: number;
        aimCD?: number; aimT?: number; lockA?: number; locked?: boolean;
        mode?: string; modeT?: number; actionCD?: number;
        dashA?: number; shieldA?: number; shieldDownT?: number; bashHit?: boolean; slashDir?: number;
        harpoon?: { state: 'out' | 'latched' | 'retract'; x: number; y: number; vx: number; vy: number; a: number; dist: number; maxDist: number; hit: boolean } | null;
    }

    interface SimProj {
        x: number; y: number; ox: number; oy: number; vx: number; vy: number; a: number;
        dmg: number; crit?: boolean; mainShot?: boolean; wingman?: boolean; piercedHit?: boolean;
        pierceLeft: number; hitIds: Set<number>; missile?: boolean; thermo?: boolean; life?: number; del?: boolean;
    }

    interface SimEnemyProj {
        kind?: string; destructible?: boolean; hp?: number; maxHp?: number;
        a?: number; spd?: number; turnRate?: number;
        x: number; y: number; vx: number; vy: number; r: number; dmg: number; life: number; del?: boolean;
    }

    interface SimHazard {
        type: 'bomb' | 'boss_bomb' | 'emp_field' | 'ion_cell';
        x: number; y: number; r: number; life: number; maxLife?: number;
        warnT?: number; tickT?: number; dmg?: number; del?: boolean;
    }

    interface SimLaserBeam {
        fromBoss?: boolean; length?: number;
        x: number; y: number; ang: number; warnT: number; activeT: number; width: number; dmg: number; hit?: boolean; del?: boolean;
    }

    interface SimRepairCapsule {
        x: number; y: number; life: number; magged: boolean; del?: boolean;
    }

    let enemies: SimEnemy[] = [];
    let projs: SimProj[] = [];
    let enemyProjs: SimEnemyProj[] = [];
    let hazards: SimHazard[] = [];
    let laserBeams: SimLaserBeam[] = [];
    let mines: { x: number; y: number; r: number; dmg: number; life: number; del?: boolean }[] = [];
    let crystals: { x: number; y: number; scrap: number; life: number; magged: boolean; del?: boolean }[] = [];
    let repairCapsules: SimRepairCapsule[] = [];
    let breaches: { x: number; y: number; life: number; spawnT: number }[] = [];
    let activeTurrets: { x: number; y: number; life: number; fireT: number }[] = [];

    const awardScrap = (baseAmount: number) => {
        if (baseAmount <= 0) return;
        const mult = player.scrapMult;
        scrapBank += baseAmount * mult * econ.scrapRewardScale;
        const amt = Math.floor(scrapBank);
        if (amt > 0) {
            scrapBank -= amt;
            runScrap += amt;
        }
    };

    const crystalXP = (base: number) => Math.round(base * (1 + (wave - 1) * xpCurve.waveXpScale) * player.xpMult);
    const grantImmediateXp = (xpGain: number) => {
        let simRem = player.xp + xpGain;
        let simMax = player.maxXp;
        let simLv = player.lv;
        const gained = applyXpGain(player, xpGain, xpCurve);
        if (gained > 0 && xpCurve.overflowCapRatio < 1) {
            const loops = xpCurve.allowMultiLevel ? gained : 1;
            for (let k = 0; k < loops; k++) {
                simRem -= simMax;
                simLv++;
                simMax = nextMaxXp(simMax, simLv, xpCurve);
            }
            xpOverflowLost += Math.max(0, simRem - player.xp);
        }
        pendingKillLevelUps += gained;
    };

    const pickSpawnPos = () => {
        const halfW = 720 + 80;
        const halfH = 450 + 80;
        const side = Math.floor(rng() * 4);
        let x = player.x, y = player.y;
        if (side === 0) { x = player.x + (rng() * 2 - 1) * halfW; y = player.y - halfH; }
        else if (side === 1) { x = player.x + halfW; y = player.y + (rng() * 2 - 1) * halfH; }
        else if (side === 2) { x = player.x + (rng() * 2 - 1) * halfW; y = player.y + halfH; }
        else { x = player.x - halfW; y = player.y + (rng() * 2 - 1) * halfH; }
        return {
            x: Math.max(PAD + 32, Math.min(ARENA_W - PAD - 32, x)),
            y: Math.max(PAD + 32, Math.min(ARENA_H - PAD - 32, y))
        };
    };

    const BOSS_DEFS: Record<string, { r: number }> = {
        titan: { r: 50 },
        phantom: { r: 46 },
        siege: { r: 52 },
        overlord: { r: 50 }
    };
    const makeBossUnitFields = (bv: string, dmgBase: number, dmgMult: number) => {
        const baseCd = bv === 'phantom' ? 2.5 : bv === 'overlord' ? 2.9 : bv === 'siege' ? 2.6 : 2.2;
        return {
            isBossUnit: true,
            bossVariant: bv,
            dmg: Math.round(dmgBase * dmgMult),
            actionCD: 1.8 * (baseCd / 2.5),
            mode: 'chase',
            modeT: 0,
            lockA: 0,
            locked: false
        };
    };

    const spawnEnemy = (t: string, opts: { pos?: { x: number; y: number }; bounty?: boolean; bossStage?: number; summonedByBossId?: number } = {}) => {
        const pos = opts.pos || pickSpawnPos();
        const caps = getWaveCaps(wave);
        const spdMult = (1 + player.enemySpdBonus + Math.min(0.4, (wave - 1) * 0.015));
        const hpMult = caps.hpMult * (opts.bounty ? 1.35 : 1);
        const dmgMult = caps.dmgMult;
        const id = nextEnemyId++;
        const bounty = !!opts.bounty;

        if (t === 'drone') {
            const hp = ENEMY_BASE_HP.drone;
            enemies.push({
                id, t, bounty, summonedByBossId: opts.summonedByBossId,
                x: pos.x, y: pos.y, r: 12, spd: (102 + (wave - 1) * 2.2) * spdMult,
                hp, maxHp: hp, dmg: Math.round(ENEMY_BASE_DAMAGE.drone * dmgMult),
                xp: XP_REWARDS.commonDrone, scrap: econ.enemyScrap.drone, a: 0
            });
        } else if (t === 'gunner') {
            const hp = Number((ENEMY_BASE_HP.gunner * hpMult).toFixed(1));
            enemies.push({
                id, t, bounty, summonedByBossId: opts.summonedByBossId,
                x: pos.x, y: pos.y, r: 17, spd: (116 + Math.max(0, wave - 2) * 1.8) * spdMult,
                hp, maxHp: hp, dmg: Math.round(ENEMY_BASE_DAMAGE.gunner * dmgMult),
                xp: XP_REWARDS.gunner, scrap: econ.enemyScrap.gunner, a: 0,
                fireCD: 1.5 + rng() * 0.6, prepT: 0, burstLeft: 0, burstT: 0
            });
        } else if (t === 'sniper') {
            const hp = Number((ENEMY_BASE_HP.sniper * hpMult).toFixed(1));
            enemies.push({
                id, t, bounty, summonedByBossId: opts.summonedByBossId,
                x: pos.x, y: pos.y, r: 17, spd: (84 + Math.max(0, wave - 3) * 1.5) * spdMult,
                hp, maxHp: hp, dmg: Math.round(ENEMY_BASE_DAMAGE.sniper * dmgMult),
                xp: XP_REWARDS.sniper, scrap: econ.enemyScrap.sniper, a: 0,
                aimCD: 2.1 + rng() * 0.8, aimT: 0, lockA: 0, locked: false
            });
        } else if (t === 'tank') {
            const hp = Number((ENEMY_BASE_HP.tank * hpMult).toFixed(1));
            enemies.push({
                id, t, bounty, summonedByBossId: opts.summonedByBossId,
                x: pos.x, y: pos.y, r: 39, spd: (55 + (wave - 1) * 0.7) * spdMult,
                hp, maxHp: hp, dmg: Math.round(ENEMY_BASE_DAMAGE.tank * dmgMult),
                xp: XP_REWARDS.tank, scrap: bounty ? econ.enemyScrap.tankBounty : econ.enemyScrap.tank, a: 0,
                fireCD: 1.15, prepT: 0, lockA: 0
            });
        } else if (t === 'scavenger') {
            const hp = Number((ENEMY_BASE_HP.scavenger * hpMult).toFixed(1));
            enemies.push({
                id, t, bounty, summonedByBossId: opts.summonedByBossId,
                x: pos.x, y: pos.y, r: 18, spd: SCAVENGER_TUNING.moveSpeed * spdMult,
                hp, maxHp: hp, baseMaxHp: hp, stolenScrap: 0,
                dmg: Math.round(ENEMY_BASE_DAMAGE.scavenger * dmgMult),
                xp: XP_REWARDS.scavenger, scrap: econ.enemyScrap.scavenger, a: 0
            });
        } else if (t === 'kamikaze') {
            const hp = Number((ENEMY_BASE_HP.kamikaze * hpMult).toFixed(1));
            enemies.push({
                id, t, bounty, summonedByBossId: opts.summonedByBossId,
                x: pos.x, y: pos.y, r: 29, spd: (118 + Math.max(0, wave - 3) * 2.2) * spdMult,
                hp, maxHp: hp, dmg: Math.round(ENEMY_BASE_DAMAGE.kamikaze * dmgMult),
                xp: XP_REWARDS.kamikaze, scrap: econ.enemyScrap.kamikaze, a: 0,
                mode: 'chase', modeT: 0, actionCD: 0.15 + rng() * 0.15, dashA: 0
            });
        } else if (t === 'bastion') {
            const hp = Number((ENEMY_BASE_HP.bastion * hpMult).toFixed(1));
            enemies.push({
                id, t, bounty, summonedByBossId: opts.summonedByBossId,
                x: pos.x, y: pos.y, r: 32, spd: (58 + Math.max(0, wave - 5) * 1.4) * spdMult,
                hp, maxHp: hp, dmg: Math.round(ENEMY_BASE_DAMAGE.bastion * dmgMult),
                xp: XP_REWARDS.bastion, scrap: bounty ? econ.enemyScrap.bastionBounty : econ.enemyScrap.bastion, a: 0,
                mode: 'chase', modeT: 0, actionCD: 1.0 + rng() * 0.4, lockA: 0, shieldA: 0, shieldDownT: 0, bashHit: false
            });
        } else if (t === 'artillery') {
            const hp = Number((ENEMY_BASE_HP.artillery * hpMult).toFixed(1));
            enemies.push({
                id, t, bounty, summonedByBossId: opts.summonedByBossId,
                x: pos.x, y: pos.y, r: 27, spd: (64 + Math.max(0, wave - 6) * 1.5) * spdMult,
                hp, maxHp: hp, dmg: Math.round(ENEMY_BASE_DAMAGE.artillery * dmgMult),
                xp: XP_REWARDS.artillery, scrap: econ.enemyScrap.artillery, a: 0,
                mode: 'chase', modeT: 0, actionCD: 1.3 + rng() * 0.6, lockA: 0, locked: false, harpoon: null
            });
        } else if (t === 'miniboss') {
            const hp = Number((ENEMY_BASE_HP.miniboss * hpMult).toFixed(1));
            enemies.push({
                id, t: 'miniboss', bounty: false, summonedByBossId: opts.summonedByBossId,
                x: pos.x, y: pos.y, r: 34, spd: (76 + Math.max(0, wave - 4) * 1.6) * spdMult,
                hp, maxHp: hp, dmg: Math.round(ENEMY_BASE_DAMAGE.miniboss * dmgMult),
                xp: XP_REWARDS.miniboss, scrap: econ.enemyScrap.miniboss, a: 0,
                mode: 'chase', modeT: 0, actionCD: 1.35, lockA: 0, slashDir: id % 2 === 0 ? 1 : -1
            });
        } else if (t === 'boss') {
            const bCfg = getBossEncounterConfigByStage(opts.bossStage ?? getStageForWave(wave));
            const bdef = BOSS_DEFS[bCfg.variant] || BOSS_DEFS.titan;
            const bossObj: SimEnemy = {
                id, t: 'boss', bounty: false, x: pos.x, y: pos.y, r: bdef.r,
                spd: bCfg.baseSpd * spdMult, hp: bCfg.baseHp, maxHp: bCfg.baseHp,
                xp: XP_REWARDS.boss, scrap: econ.enemyScrap.boss, a: 0,
                ...makeBossUnitFields(bCfg.variant, bCfg.baseDmg, 1)
            };
            enemies.push(bossObj);
            if (cfg.simulateBossReinforcementWave) {
                spawnEnemy('drone', {
                    pos: { x: Math.min(ARENA_W - PAD - 32, bossObj.x + 70), y: bossObj.y },
                    summonedByBossId: bossObj.id
                });
            }
        }
    };

    const resetStageScopedStateOnBossVictory = () => {
        resetTempMaxHpAfterBoss(player);
        player.lv = 1;
        player.xp = 0;
        player.maxXp = xpCurve.initialMaxXp;
        // Restore base weapon/passive slots while preserving Lab/chassis baseline
        player.dmg = startDmg;
        player.baseRate = bonus.rate;
        player.rate = bonus.rate;
        player.spd = bonus.spd;
        player.range = 290;
        player.mag = bonus.mag;
        player.spreadLv = 0;
        player.orbits = 0;
        player.pierce = 0;
        player.chain = ch.chain;
        player.missiles = 0;
        player.wingmen = 0;
        player.mineLv = 0;
        player.laserLv = 0;
        player.armor = ch.armor;
        player.critChance = ch.crit;
        player.critMult = 1.75;
        player.reactiveLv = 0;
        player.regen = 0;
        player.xpMult = 1;
        player.scrapMult = bonus.scrapMult;
        player.enemySpdBonus = 0;
        player.empCd = bonus.empCd;
        player.empRad = bonus.empRad;
        player.evos = {};
        weaponSlotsUsed.clear();
        passiveSlotsUsed.clear();
        for (const k of Object.keys(upgradePicks)) delete upgradePicks[k];
        for (const k of Object.keys(unlockedEvos)) delete unlockedEvos[k];
    };

    const damageEnemy = (e: SimEnemy, rawDmg: number, hitAngle: number | null, fromDirectProj = false) => {
        if (!e || e.del) return;
        let adjDmg = rawDmg;
        if (e.t === 'bastion' && (e.shieldDownT || 0) <= 0 && fromDirectProj && hitAngle !== null) {
            const diff = Math.abs(Math.atan2(Math.sin((hitAngle + Math.PI) - (e.shieldA || 0)), Math.cos((hitAngle + Math.PI) - (e.shieldA || 0))));
            if (diff < 1.15) adjDmg *= 0.3;
        }
        const dmg = Number(Math.max(0.5, adjDmg).toFixed(1));
        const actual = Math.min(e.hp, dmg);
        damageDealt += actual;
        e.hp = Number((e.hp - dmg).toFixed(1));
        if (hitAngle !== null && e.t !== 'boss' && e.t !== 'miniboss') {
            const kb = e.isBossUnit ? 2.5 : e.t === 'bastion' ? 2.0 : 5;
            e.x += Math.cos(hitAngle) * kb;
            e.y += Math.sin(hitAngle) * kb;
        }
        if (e.hp <= 0) {
            e.del = true;
            grantImmediateXp(crystalXP(e.xp));
            if (e.t === 'drone') {
                capsulesDropped++;
                repairCapsules.push({
                    x: e.x, y: e.y,
                    life: REPAIR_CAPSULE_TUNING.lifetimeSec,
                    magged: false
                });
            } else if (e.t === 'scavenger') {
                const dropAmt = computeScavengerDeathScrap(e.scrap, e.stolenScrap || 0);
                scavengerReturnedTotal += Math.max(0, (e.stolenScrap || 0) * SCAVENGER_TUNING.returnRatioOnDeath);
                if (dropAmt > 0) crystals.push({ x: e.x, y: e.y, scrap: dropAmt, life: 22, magged: false });
            } else {
                const dropScrap = e.scrap || 0;
                if (dropScrap > 0) {
                    crystals.push({ x: e.x, y: e.y, scrap: dropScrap, life: 22, magged: false });
                }
            }
            runKills++;
            killsByType[e.t] = (killsByType[e.t] || 0) + 1;
            if (e.t === 'tank') runTanks++;
            if (e.bounty) player.hp = Math.min(player.maxHp, player.hp + 16);
            if (e.t === 'miniboss') player.hp = Math.min(player.maxHp, player.hp + 12);
            if (e.t === 'boss') {
                bossDefeated = true;
                enemies.forEach(add => {
                    if (add.summonedByBossId === e.id) add.del = true;
                });
                enemyProjs = [];
                hazards = [];
                laserBeams = [];
                resetStageScopedStateOnBossVictory();
                bossPhase = 'none';
                wave++;
                roundCD = waveDur;
                director.wave = wave;
            }
        }
    };

    let dead = false;
    let repairOfferPending = false;
    let bossRetriesUsed = 0;
    const maxBossRetries = cfg.maxBossRetries ?? 0;

    const hurtPlayer = (rawDmg: number, source = 'unknown') => {
        if (player.inv > 0 || dead) return;
        const dmg = Math.max(1, Math.round(rawDmg * (1 - player.armor)));
        player.hp -= dmg;
        if (player.hp <= player.maxHp * 0.60) repairOfferPending = true;
        damageReceived += dmg;
        damageBySource[source] = (damageBySource[source] || 0) + dmg;
        player.inv = combat.playerInvTime;
        if (player.hp <= 0) {
            if (bossPhase === 'active' && bossRetriesUsed < maxBossRetries) {
                bossRetriesUsed++;
                bossAttempts++;
                player.hp = player.maxHp;
                player.inv = 1.2;
                enemies = [];
                enemyProjs = [];
                hazards = [];
                laserBeams = [];
                spawnEnemy('boss', { bossStage: currentBossStage });
                return;
            }
            player.hp = 0;
            dead = true;
        }
    };

    const fireEMP = () => {
        if (empCD > 0) return;
        empCD = player.empCd;
        const r = player.empRad;
        if (player.evos.gravPulse) {
            hazards.push({ type: 'emp_field', x: player.x, y: player.y, r, life: 3.0, tickT: 0 });
            for (const c of crystals) {
                if (Math.hypot(c.x - player.x, c.y - player.y) <= r * 1.4) c.magged = true;
            }
        }
        for (const e of enemies) {
            const d = Math.hypot(e.x - player.x, e.y - player.y);
            if (d <= r) {
                const a = Math.atan2(e.y - player.y, e.x - player.x);
                const push = 320 * (1 - d / (r * 1.15));
                e.x += Math.cos(a) * push; e.y += Math.sin(a) * push;
                e.stun = Math.max(e.stun || 0, 0.85);
                if (e.t === 'bastion') e.shieldDownT = 2.5;
                damageEnemy(e, 8 + player.dmg * 0.5, null, false);
            }
        }
        for (const ep of enemyProjs) {
            if (!ep.del && ep.destructible && Math.hypot(ep.x - player.x, ep.y - player.y) <= r) {
                ep.del = true;
                bossAttacks.missilesIntercepted++;
            }
        }
    };

    const triggerUpgradeChoice = () => {
        if (cfg.noCardPicks) {
            if (levelTimes[player.lv] === undefined) levelTimes[player.lv] = Number(playT.toFixed(2));
            return;
        }
        const opts = pickUpgradeChoices({
            player, upgradePicks, unlockedEvos, weaponSlotsUsed, passiveSlotsUsed,
            cards, fallbackCards, evos, rng,
            forceRepair: repairOfferPending || player.hp <= player.maxHp * 0.60
        });
        if (!opts.length) return;
        if (opts.some(choice => choice.card?.id === 'REPARO')) repairOfferPending = false;
        if (cfg.useRandomChoices) {
            const idx = Math.floor(rng() * opts.length);
            const swap = opts[0];
            opts[0] = opts[idx];
            opts[idx] = swap;
        } else {
            opts.sort((a, b) => scoreOption(b, cfg.build) - scoreOption(a, cfg.build));
        }
        const chosen = opts[0];
        if (chosen.isEvo && chosen.evo) {
            unlockedEvos[chosen.evo.id] = true;
            chosen.evo.fn(player);
        } else if (chosen.card) {
            if (fallbackCards.some(card => card.id === chosen.card!.id)) fallbackPicks++;
            chosen.card.fn(player, chosen.mult, {
                awardScrap: (b) => awardScrap(b),
                triggerOvercharge: (sec) => { overchargeT = Math.max(overchargeT, sec); },
                resetEmp: () => { empCD = 0; }
            });
            upgradePicks[chosen.card.id] = (upgradePicks[chosen.card.id] || 0) + 1;
            if (chosen.card.cat === 'weapon') weaponSlotsUsed.add(chosen.card.id);
            else if (chosen.card.cat === 'passive' && !chosen.card.noSlot) passiveSlotsUsed.add(chosen.card.id);
            player.hp = Math.min(player.maxHp, player.hp + 3);
        }
        upgradeTimes.push(Number(playT.toFixed(2)));
        if (levelTimes[player.lv] === undefined) levelTimes[player.lv] = Number(playT.toFixed(2));
    };

    const starterPicks = getStarterPicksCount(startWave);
    for (let i = 0; i < starterPicks; i++) {
        triggerUpgradeChoice();
    }

    const isInCameraView = (x: number, y: number, margin = 25) =>
        Math.abs(x - player.x) <= 720 + margin && Math.abs(y - player.y) <= 450 + margin;

    const refWaves = new Set([1, 2, 3, 4, 5, 6, 7, 10, 15, 20, 30]);

    while (!dead && playT < maxTimeSec) {
        if (cfg.stopAfterBossVictory && bossDefeated) break;

        playT += DT;
        if (player.chainCD > 0) player.chainCD = Math.max(0, player.chainCD - DT);
        if (empCD > 0) empCD = Math.max(0, empCD - DT);
        if (overchargeT > 0) overchargeT = Math.max(0, overchargeT - DT);
        if (globalMagT > 0) globalMagT = Math.max(0, globalMagT - DT);

        // Wave progression & Stage-5 Boss cleanup transition
        if (bossPhase === 'none') {
            roundCD -= DT;
            if (roundCD <= 0) {
                if (refWaves.has(wave) && !waveSnapshots[wave]) {
                    waveSnapshots[wave] = {
                        wave, timeSec: Number(playT.toFixed(1)), hp: Math.round(player.hp), maxHp: player.maxHp,
                        lv: player.lv, scrapEarned: runScrap, dmgDealt: Math.round(damageDealt),
                        dmgReceived: Math.round(damageReceived), kills: runKills
                    };
                }
                const wb = econ.waveBonusFn(wave);
                if (wb > 0) awardScrap(wb);
                if (isBossTriggerWave(wave)) {
                    currentBossStage = getStageForWave(wave);
                    bossPhase = 'cleanup';
                    bossCleanupT = CAMPAIGN_TUNING.bossCleanupBlinkSec;
                    arenaEvent = null;
                    breaches = [];
                    enemyProjs = [];
                    hazards = [];
                    laserBeams = [];
                } else {
                    wave++;
                    roundCD = waveDur;
                    for (const c of crystals) {
                        if (Math.hypot(c.x - player.x, c.y - player.y) <= 360) c.magged = true;
                    }
                }
            }
        } else if (bossPhase === 'cleanup') {
            bossCleanupT -= DT;
            if (bossCleanupT <= 0) {
                // Despawn surviving common enemies without kills, XP, scrap, or repair capsules
                enemies = enemies.filter(e => e.t === 'boss');
                enemyProjs = [];
                hazards = [];
                laserBeams = [];
                bossPhase = 'active';
                bossAttempts++;
                spawnEnemy('boss', { bossStage: currentBossStage });
            }
        }

        // Adaptive Spawn Director (active ONLY during normal waves)
        const playerHpRatio = player.maxHp > 0 ? player.hp / player.maxHp : 1;
        const dirRes = stepAdaptiveSpawnDirector({
            director,
            dt: DT,
            wave,
            enemies,
            playerHpRatio,
            rng,
            enabled: bossPhase === 'none',
            overrides: cfg.directorOverrides
        });
        for (const spawnType of dirRes.spawns) {
            spawnEnemy(spawnType);
        }

        player.rate = Math.max(combat.minFireRate, player.baseRate / (overchargeT > 0 ? 1.8 : 1));

        // Supply crate every 28s
        if (bossPhase === 'none') {
            supplyT += DT;
            if (!supply && supplyT >= 28) {
                supplyT = 0;
                const a = rng() * 6.283, dist = 320 + rng() * 260;
                supply = {
                    x: Math.max(PAD + 80, Math.min(ARENA_W - PAD - 80, player.x + Math.cos(a) * dist)),
                    y: Math.max(PAD + 80, Math.min(ARENA_H - PAD - 80, player.y + Math.sin(a) * dist)),
                    life: 16, evoChest: false
                };
            }
        }
        if (supply) {
            supply.life -= DT;
            if (supply.life <= 0) supply = null;
            else if (Math.hypot(player.x - supply.x, player.y - supply.y) < player.r + 22) {
                if (supply.evoChest) {
                    if (econ.supplyScrap > 0) awardScrap(econ.supplyScrap);
                    player.hp = Math.min(player.maxHp, player.hp + 20);
                    globalMagT = 4.5;
                } else if (rng() < 0.5) {
                    globalMagT = 4.5;
                    crystals.forEach(c => { c.magged = true; });
                } else {
                    overchargeT = 6;
                }
                if (econ.supplyScrap > 0) awardScrap(econ.supplyScrap);
                supply = null;
            }
        }

        // Breaches & Allied Turrets
        for (const b of breaches) {
            b.life -= DT;
            b.spawnT -= DT;
            if (b.spawnT <= 0 && bossPhase === 'none' && enemies.filter(e => !e.del).length < getWaveCaps(wave).maxEnemies) {
                b.spawnT = 1.75;
                const kind = rng() < 0.45 ? 'kamikaze' : (wave >= 8 && rng() < 0.25 ? 'sniper' : 'drone');
                spawnEnemy(kind, { pos: { x: Math.max(PAD + 36, Math.min(ARENA_W - PAD - 36, b.x + (rng() - 0.5) * 44)), y: Math.max(PAD + 36, Math.min(ARENA_H - PAD - 36, b.y + (rng() - 0.5) * 44)) } });
            }
        }
        breaches = breaches.filter(b => b.life > 0);

        for (const t of activeTurrets) {
            t.life -= DT;
            t.fireT -= DT;
            if (t.fireT <= 0) {
                let target: SimEnemy | null = null, td = 330;
                for (const e of enemies) {
                    if (e.del) continue;
                    const d = Math.hypot(e.x - t.x, e.y - t.y);
                    if (d < td) { td = d; target = e; }
                }
                if (target) {
                    t.fireT = 0.42;
                    const ta = Math.atan2(target.y - t.y, target.x - t.x);
                    projs.push({ x: t.x + Math.cos(ta) * 16, y: t.y + Math.sin(ta) * 16, ox: t.x, oy: t.y, vx: Math.cos(ta) * 650, vy: Math.sin(ta) * 650, a: ta, dmg: player.dmg * 0.85, wingman: true, pierceLeft: 0, hitIds: new Set() });
                }
            }
        }
        activeTurrets = activeTurrets.filter(t => t.life > 0);

        // Arena Event Director (Wave 6+ only so Stage 1 preserves clean 41/min enemy cadence calibration)
        if (wave >= 6 && bossPhase === 'none') {
            if (arenaEvent) {
                arenaEvent.life -= DT;
                const inside = Math.hypot(player.x - arenaEvent.x, player.y - arenaEvent.y) <= arenaEvent.r;
                if (inside) arenaEvent.prog += DT / arenaEvent.dur;
                else arenaEvent.prog = Math.max(0, arenaEvent.prog - DT * 0.25);
                if (arenaEvent.prog >= 1) {
                    if (arenaEvent.type === 'relay') {
                        awardScrap(econ.relayScrapFn(wave));
                        overchargeT = Math.max(overchargeT, 5);
                        player.hp = Math.min(player.maxHp, player.hp + 12);
                        grantImmediateXp(crystalXP(XP_REWARDS.relayCrystal) * 4);
                    } else if (arenaEvent.type === 'supply_pod') {
                        awardScrap(econ.supplyPodScrapFn(wave));
                        player.hp = Math.min(player.maxHp, player.hp + 15);
                        overchargeT = Math.max(overchargeT, 4);
                        grantImmediateXp(crystalXP(XP_REWARDS.supplyPodCrystal) * 6);
                    } else if (arenaEvent.type === 'ally_turret') {
                        activeTurrets.push({ x: arenaEvent.x, y: arenaEvent.y, life: 22, fireT: 0.2 });
                    }
                    arenaEvent = null;
                } else if (arenaEvent.life <= 0) {
                    arenaEvent = null;
                }
            }
            eventCD -= DT;
            if (eventCD <= 0 && !arenaEvent && !enemies.some(e => !e.del && (e.t === 'boss' || e.t === 'miniboss')) && hazards.length === 0 && laserBeams.length === 0 && breaches.length === 0) {
                eventCD = Math.max(26, 34 - Math.min(8, wave * 0.35)) + rng() * 6;
                const pool = getWaveEventPool(wave);
                const options = pool.filter(k => !recentEvents.includes(k));
                const pickPool = options.length > 0 ? options : pool;
                const pick = pickPool[Math.floor(rng() * pickPool.length)];
                recentEvents.push(pick);
                if (recentEvents.length > 3) recentEvents.shift();

                if (pick === 'relay' && !arenaEvent) {
                    const a = rng() * 6.283, d = 340 + rng() * 190;
                    arenaEvent = { type: 'relay', x: Math.max(PAD + 110, Math.min(ARENA_W - PAD - 110, player.x + Math.cos(a) * d)), y: Math.max(PAD + 110, Math.min(ARENA_H - PAD - 110, player.y + Math.sin(a) * d)), r: 82, dur: 3.0, prog: 0, life: 20 };
                } else if (pick === 'supply_pod' && !arenaEvent) {
                    const a = rng() * 6.283, d = 300 + rng() * 180;
                    const px = Math.max(PAD + 110, Math.min(ARENA_W - PAD - 110, player.x + Math.cos(a) * d));
                    const py = Math.max(PAD + 110, Math.min(ARENA_H - PAD - 110, player.y + Math.sin(a) * d));
                    arenaEvent = { type: 'supply_pod', x: px, y: py, r: 74, dur: 2.2, prog: 0, life: 22 };
                } else if (pick === 'ally_turret' && !arenaEvent) {
                    const a = rng() * 6.283, d = 260 + rng() * 160;
                    arenaEvent = { type: 'ally_turret', x: Math.max(PAD + 110, Math.min(ARENA_W - PAD - 110, player.x + Math.cos(a) * d)), y: Math.max(PAD + 110, Math.min(ARENA_H - PAD - 110, player.y + Math.sin(a) * d)), r: 68, dur: 1.4, prog: 0, life: 18 };
                } else if (pick === 'orbital_sweep') {
                    const caps = getWaveCaps(wave);
                    const lanes = wave >= 10 ? 3 : 2;
                    for (let i = 0; i < lanes; i++) {
                        const ang = rng() * Math.PI;
                        const off = (i - (lanes - 1) / 2) * 90;
                        laserBeams.push({ x: Math.max(PAD + 60, Math.min(ARENA_W - PAD - 60, player.x + Math.cos(ang + 1.57) * off)), y: Math.max(PAD + 60, Math.min(ARENA_H - PAD - 60, player.y + Math.sin(ang + 1.57) * off)), ang, warnT: 1.75, activeT: 0.45, width: 46, dmg: Math.round(16 * caps.dmgMult) });
                    }
                } else if (pick === 'ion_storm') {
                    const caps = getWaveCaps(wave);
                    const cells = wave >= 12 ? 4 : 3;
                    for (let i = 0; i < cells; i++) {
                        const a = (i / cells) * 6.283 + rng() * 0.6;
                        const d = i === 0 ? 45 : (140 + rng() * 140);
                        hazards.push({ type: 'ion_cell', x: Math.max(PAD + 90, Math.min(ARENA_W - PAD - 90, player.x + Math.cos(a) * d)), y: Math.max(PAD + 90, Math.min(ARENA_H - PAD - 90, player.y + Math.sin(a) * d)), r: 88, warnT: 1.4, life: 7.4, tickT: 0, dmg: Math.round(9 * caps.dmgMult) });
                    }
                } else if (pick === 'bounty') {
                    const caps = getWaveCaps(wave);
                    if (enemies.filter(e => !e.del).length < caps.maxEnemies) spawnEnemy(wave >= 11 ? 'bastion' : 'tank', { bounty: true });
                } else if (pick === 'miniboss') {
                    const caps = getWaveCaps(wave);
                    if (enemies.filter(e => !e.del).length < caps.maxEnemies) spawnEnemy('miniboss');
                } else if (pick === 'bombardment') {
                    const caps = getWaveCaps(wave);
                    const shells = wave >= 10 ? 6 : 4;
                    for (let i = 0; i < shells; i++) {
                        const maxL = 1.3 + i * 0.28;
                        hazards.push({ type: 'bomb', x: Math.max(PAD + 75, Math.min(ARENA_W - PAD - 75, player.x + (rng() - 0.5) * 280)), y: Math.max(PAD + 75, Math.min(ARENA_H - PAD - 75, player.y + (rng() - 0.5) * 280)), r: 68, life: maxL, maxLife: maxL, dmg: Math.round(14 * caps.dmgMult) });
                    }
                } else if (pick === 'invasion') {
                    const count = wave >= 11 ? 3 : 2;
                    for (let i = 0; i < count; i++) {
                        const a = (i / count) * 6.283 + rng() * 0.8;
                        const d = 340 + rng() * 90;
                        breaches.push({ x: Math.max(PAD + 90, Math.min(ARENA_W - PAD - 90, player.x + Math.cos(a) * d)), y: Math.max(PAD + 90, Math.min(ARENA_H - PAD - 90, player.y + Math.sin(a) * d)), life: 7.0, spawnT: 0.4 + i * 0.35 });
                    }
                }
            }
        }

        if (player.inv > 0) player.inv = Math.max(0, player.inv - DT);
        if (player.regen > 0 && player.hp < player.maxHp) player.hp = Math.min(player.maxHp, player.hp + player.regen * DT);

        let tetherSource: SimEnemy | null = null;
        if (playerTether && playerTether.timer > 0) {
            tetherSource = enemies.find(e => e.id === playerTether!.sourceId && !e.del) || null;
            playerTether.timer -= DT;
            if (!tetherSource || playerTether.timer <= 0) {
                playerTether = null;
                tetherSource = null;
            }
        }

        // Player Movement & AI Styles
        let moveMag = 0;
        if (playStyle !== 'stationary') {
            const isEvasive = playStyle === 'evasive';
            const isModerate = playStyle === 'moderate';
            const isDodgeOnly = playStyle === 'dodge_only';
            let fx = 0, fy = 0;
            let closeDangerCount = 0;
            for (const e of enemies) {
                if (e.del) continue;
                const dx = player.x - e.x, dy = player.y - e.y;
                const d = Math.hypot(dx, dy) || 1;
                if (d < 150) closeDangerCount++;
                const baseSafe = e.t === 'boss' ? 235 : e.t === 'miniboss' ? 175 : 140;
                const safeR = (isEvasive || isDodgeOnly) ? baseSafe * 1.2 : isModerate ? baseSafe * 0.8 : baseSafe;
                if (d < safeR) {
                    const w = ((safeR - d) / safeR) * (e.t === 'boss' ? 2.4 : e.t === 'miniboss' ? 1.9 : 1.4);
                    fx += (dx / d) * w;
                    fy += (dy / d) * w;
                }
            }
            if (!isDodgeOnly && empCD <= 0 && (closeDangerCount >= 4 || (player.hp < player.maxHp * 0.55 && closeDangerCount >= 2))) {
                fireEMP();
            }
            const projDodgeR = (isEvasive || isDodgeOnly) ? 150 : isModerate ? 75 : 120;
            for (const ep of enemyProjs) {
                if (ep.del) continue;
                const dx = player.x - ep.x, dy = player.y - ep.y;
                const d = Math.hypot(dx, dy) || 1;
                if (d < projDodgeR) {
                    const pa = Math.atan2(ep.vy, ep.vx) + 1.57;
                    const mult = isModerate ? 0.75 : (isEvasive || isDodgeOnly) ? 1.85 : 1.4;
                    fx += Math.cos(pa) * mult + (dx / d) * ((isEvasive || isDodgeOnly) ? 1.1 : 0.8);
                    fy += Math.sin(pa) * mult + (dy / d) * ((isEvasive || isDodgeOnly) ? 1.1 : 0.8);
                }
            }
            const hazMargin = (isEvasive || isDodgeOnly) ? 56 : isModerate ? 12 : 36;
            for (const h of hazards) {
                if (h.type === 'bomb' || h.type === 'boss_bomb' || h.type === 'ion_cell') {
                    const dx = player.x - h.x, dy = player.y - h.y;
                    const d = Math.hypot(dx, dy) || 1;
                    if (d < h.r + hazMargin) {
                        const hw = isModerate ? 1.6 : (isEvasive || isDodgeOnly) ? 3.8 : 3.0;
                        fx += (dx / d) * hw;
                        fy += (dy / d) * hw;
                    }
                }
            }
            for (const lb of laserBeams) {
                const ca = Math.cos(lb.ang), sa = Math.sin(lb.ang);
                const perp = (player.x - lb.x) * -sa + (player.y - lb.y) * ca;
                if (Math.abs(perp) < lb.width * 0.85 + player.r) {
                    const sign = perp >= 0 ? 1 : -1;
                    const lw = isModerate ? 1.5 : 3.2;
                    fx += -sa * sign * lw;
                    fy += ca * sign * lw;
                }
            }
            for (const e of enemies) {
                if (e.del) continue;
                if (e.isBossUnit && e.mode === 'laser_prep' && e.locked && e.lockA !== undefined) {
                    const ca = Math.cos(e.lockA), sa = Math.sin(e.lockA);
                    const along = (player.x - e.x) * ca + (player.y - e.y) * sa;
                    if (along > 0 && along < 760) {
                        const perp = (player.x - e.x) * -sa + (player.y - e.y) * ca;
                        if (Math.abs(perp) < 38) {
                            const sign = perp >= 0 ? 1 : -1;
                            const lw = isModerate ? 1.2 : (isEvasive || isDodgeOnly) ? 3.5 : 2.8;
                            fx += -sa * sign * lw;
                            fy += ca * sign * lw;
                        }
                    }
                } else if (e.t === 'sniper' && (e.aimT || 0) > 0 && e.locked && e.lockA !== undefined) {
                    const ca = Math.cos(e.lockA), sa = Math.sin(e.lockA);
                    const along = (player.x - e.x) * ca + (player.y - e.y) * sa;
                    if (along > 0 && along < 640) {
                        const perp = (player.x - e.x) * -sa + (player.y - e.y) * ca;
                        if (Math.abs(perp) < 28) {
                            const sign = perp >= 0 ? 1 : -1;
                            const lw = isModerate ? 1.0 : (isEvasive || isDodgeOnly) ? 3.0 : 2.2;
                            fx += -sa * sign * lw;
                            fy += ca * sign * lw;
                        }
                    }
                }
            }
            fx += (ARENA_W / 2 - player.x) * 0.0009;
            fy += (ARENA_H / 2 - player.y) * 0.0009;

            if (cfg.focusTank) {
                const targetTank = enemies.find(e => !e.del && e.t === 'tank');
                if (targetTank && closeDangerCount < 2) {
                    const dx = targetTank.x - player.x, dy = targetTank.y - player.y;
                    const d = Math.hypot(dx, dy) || 1;
                    if (d > player.range * 0.85) {
                        fx += (dx / d) * 1.4;
                        fy += (dy / d) * 1.4;
                    }
                }
            } else if (bossPhase === 'active' && !isDodgeOnly) {
                const activeBoss = enemies.find(e => !e.del && e.t === 'boss');
                if (activeBoss) {
                    const dx = activeBoss.x - player.x, dy = activeBoss.y - player.y;
                    const d = Math.hypot(dx, dy) || 1;
                    if (d > player.range * 0.84) {
                        fx += (dx / d) * 1.65;
                        fy += (dy / d) * 1.65;
                    }
                }
            }

            if (!isEvasive && !isDodgeOnly) {
                if (supply && closeDangerCount < 3) {
                    const dx = supply.x - player.x, dy = supply.y - player.y;
                    const d = Math.hypot(dx, dy) || 1;
                    if (d < 480) { fx += (dx / d) * 1.3; fy += (dy / d) * 1.3; }
                } else if (arenaEvent && (arenaEvent.type === 'relay' || arenaEvent.type === 'supply_pod') && closeDangerCount < 3) {
                    const dx = arenaEvent.x - player.x, dy = arenaEvent.y - player.y;
                    const d = Math.hypot(dx, dy) || 1;
                    if (d < 520) { fx += (dx / d) * 1.1; fy += (dy / d) * 1.1; }
                } else if (repairCapsules.length > 0 && player.hp < player.maxHp * 0.85 && closeDangerCount < 2) {
                    const cap = repairCapsules[0];
                    const dx = cap.x - player.x, dy = cap.y - player.y;
                    const d = Math.hypot(dx, dy) || 1;
                    if (d < 340 && d > player.mag * 0.7) {
                        fx += (dx / d) * 0.95;
                        fy += (dy / d) * 0.95;
                    }
                } else if (crystals.length > 0 && closeDangerCount < 2) {
                    let bestC = null as (typeof crystals)[0] | null;
                    let bestD = 280;
                    for (const c of crystals) {
                        const d = Math.hypot(c.x - player.x, c.y - player.y);
                        if (d < bestD) { bestD = d; bestC = c; }
                    }
                    if (bestC && bestD > player.mag * 0.8) {
                        fx += ((bestC.x - player.x) / bestD) * 0.85;
                        fy += ((bestC.y - player.y) / bestD) * 0.85;
                    }
                }
            }
            fx += Math.cos(playT * ((isEvasive || isDodgeOnly) ? 1.35 : 0.7)) * ((isEvasive || isDodgeOnly) ? 0.75 : 0.45);
            fy += Math.sin(playT * ((isEvasive || isDodgeOnly) ? 1.35 : 0.7)) * ((isEvasive || isDodgeOnly) ? 0.75 : 0.45);

            const mag = Math.hypot(fx, fy);
            const spdScale = isModerate ? 0.68 : 1.0;
            if (mag > 0.05) {
                let mx = fx / mag;
                let my = fy / mag;
                if (tetherSource) {
                    const rdx = player.x - tetherSource.x, rdy = player.y - tetherSource.y;
                    const rd = Math.hypot(rdx, rdy) || 1;
                    const tx = -rdy / rd, ty = rdx / rd;
                    const lat = mx * tx + my * ty;
                    mx = tx * lat;
                    my = ty * lat;
                }
                player.x += mx * player.spd * spdScale * DT;
                player.y += my * player.spd * spdScale * DT;
                moveMag = spdScale;
            }
        }
        if (playerKnockT > 0) {
            playerKnockT = Math.max(0, playerKnockT - DT);
            player.x += playerKnockVx * DT;
            player.y += playerKnockVy * DT;
            playerKnockVx *= 0.88;
            playerKnockVy *= 0.88;
        }
        if (playerPullT > 0) {
            playerPullT = Math.max(0, playerPullT - DT);
            if (tetherSource) {
                const pa = Math.atan2(tetherSource.y - player.y, tetherSource.x - player.x);
                const pd = Math.hypot(tetherSource.x - player.x, tetherSource.y - player.y);
                if (pd > 68) {
                    player.x += Math.cos(pa) * 430 * DT;
                    player.y += Math.sin(pa) * 430 * DT;
                }
            }
        }
        player.x = Math.max(PAD + 20, Math.min(ARENA_W - PAD - 20, player.x));
        player.y = Math.max(PAD + 20, Math.min(ARENA_H - PAD - 20, player.y));

        // Targeting & Main Gun (skipped in passive dodge_only profile)
        let nearest: SimEnemy | null = null, nearestDist = Infinity;
        let tankTarget: SimEnemy | null = null, tankDist = Infinity;
        for (const e of enemies) {
            if (e.del) continue;
            const d = Math.hypot(player.x - e.x, player.y - e.y);
            if (d < nearestDist) { nearestDist = d; nearest = e; }
            if (e.t === 'tank' && d < tankDist) { tankDist = d; tankTarget = e; }
        }
        const fireTarget = (cfg.focusTank && tankTarget && tankDist <= player.range) ? tankTarget : nearest;
        const fireTargetDist = fireTarget === tankTarget ? tankDist : nearestDist;
        if (fireTarget) player.aim = Math.atan2(fireTarget.y - player.y, fireTarget.x - player.x) || 0;

        player.fireT -= DT;
        if (playStyle !== 'dodge_only' && player.fireT <= 0 && fireTarget && fireTargetDist <= player.range) {
            player.fireT = player.rate;
            primaryShotsFired++;
            const count = 1 + player.spreadLv * 2 + (player.evos.plasmaStorm ? 1 : 0);
            const step = player.evos.plasmaStorm ? 0.14 : 0.19;
            const center = (count - 1) / 2;
            for (let idx = 0; idx < count; idx++) {
                const offset = idx - center;
                const a = player.aim + offset * step;
                const isCrit = rng() < player.critChance;
                const isMain = Math.abs(offset) < 0.6 && idx === Math.floor(count / 2);
                const spreadScale = isMain ? 1 : combat.spreadSideScale;
                const d = player.dmg * spreadScale * (isCrit ? player.critMult : 1);
                projs.push({
                    x: player.x + Math.cos(a) * 18, y: player.y + Math.sin(a) * 18, ox: player.x, oy: player.y,
                    vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, a, dmg: d, crit: isCrit,
                    mainShot: isMain, piercedHit: false, pierceLeft: player.pierce || 0, hitIds: new Set()
                });
            }
        }

        // Homing Missiles
        if (playStyle !== 'dodge_only' && player.missiles > 0) {
            player.missileT -= DT;
            if (player.missileT <= 0 && enemies.length) {
                player.missileT = Math.max(1.1, 2.3 - player.missiles * 0.25);
                const nM = 1 + Math.floor(player.missiles / 2);
                for (let i = 0; i < nM; i++) {
                    const a = player.aim + (i - (nM - 1) / 2) * 0.5;
                    projs.push({
                        x: player.x, y: player.y, ox: player.x, oy: player.y,
                        vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, a,
                        dmg: player.dmg * (player.evos.thermobaric ? 2.1 : 1.45),
                        missile: true, thermo: !!player.evos.thermobaric, life: 2.6, pierceLeft: 0, hitIds: new Set()
                    });
                }
            }
        }

        // Wingman Drones
        if (playStyle !== 'dodge_only' && player.wingmen > 0) {
            player.wingA += DT * 1.9;
            player.wingFireT -= DT;
            if (player.wingFireT <= 0 && fireTarget && fireTargetDist <= 290) {
                player.wingFireT = Math.max(combat.wingmanCooldownMin, combat.wingmanCooldownBase - player.wingmen * combat.wingmanCooldownStep);
                for (let i = 0; i < player.wingmen; i++) {
                    const wa = player.wingA + (i / player.wingmen) * 6.283;
                    const wx = player.x + Math.cos(wa) * 36, wy = player.y + Math.sin(wa) * 36;
                    const aim = Math.atan2(fireTarget.y - wy, fireTarget.x - wx);
                    const isCrit = rng() < player.critChance;
                    projs.push({
                        x: wx, y: wy, ox: wx, oy: wy, vx: Math.cos(aim) * 600, vy: Math.sin(aim) * 600, a: aim,
                        dmg: player.dmg * combat.wingmanDmgScale * (isCrit ? player.critMult : 1),
                        crit: isCrit, wingman: true, pierceLeft: 0, hitIds: new Set()
                    });
                }
            }
        }

        // Proximity Mines
        if (playStyle !== 'dodge_only' && player.mineLv > 0) {
            player.mineT -= DT;
            if (player.mineT <= 0 && moveMag > 0.1) {
                player.mineT = Math.max(1.2, 2.8 - player.mineLv * 0.45);
                mines.push({ x: player.x, y: player.y, r: 65 + player.mineLv * 12, dmg: player.dmg * (1.8 + player.mineLv * 0.4), life: 12 });
            }
        }

        // Laser Lance
        if (playStyle !== 'dodge_only' && player.laserLv > 0) {
            player.laserT -= DT;
            if (player.laserT <= 0 && fireTarget && fireTargetDist <= 380) {
                player.laserT = Math.max(1.4, 3.0 - player.laserLv * 0.45);
                const lx1 = player.x, ly1 = player.y;
                const lx2 = lx1 + Math.cos(player.aim) * 420, ly2 = ly1 + Math.sin(player.aim) * 420;
                const lDmg = player.dmg * (1.5 + player.laserLv * 0.5);
                for (const e of enemies) {
                    if (e.del) continue;
                    const dx = lx2 - lx1, dy = ly2 - ly1, l2 = dx * dx + dy * dy;
                    const t = Math.max(0, Math.min(1, ((e.x - lx1) * dx + (e.y - ly1) * dy) / l2));
                    const px = lx1 + t * dx, py = ly1 + t * dy;
                    if (Math.hypot(e.x - px, e.y - py) <= e.r + 12) {
                        damageEnemy(e, lDmg, player.aim, false);
                    }
                }
                for (const ep of enemyProjs) {
                    if (ep.del || !ep.destructible) continue;
                    const dx = lx2 - lx1, dy = ly2 - ly1, l2 = dx * dx + dy * dy;
                    const t = Math.max(0, Math.min(1, ((ep.x - lx1) * dx + (ep.y - ly1) * dy) / l2));
                    const px = lx1 + t * dx, py = ly1 + t * dy;
                    if (Math.hypot(ep.x - px, ep.y - py) <= ep.r + 14) {
                        ep.hp = (ep.hp || 1) - lDmg;
                        if (ep.hp <= 0) { ep.del = true; bossAttacks.missilesIntercepted++; }
                    }
                }
            }
        }

        // Boss +1 HP/s regeneration while >= 1 summoned reinforcement is alive
        for (const boss of enemies) {
            if (boss.del || boss.t !== 'boss') continue;
            const hasLivingReinforcement = enemies.some(e => !e.del && e.summonedByBossId === boss.id);
            if (hasLivingReinforcement && boss.hp < boss.maxHp) {
                boss.hp = Math.min(boss.maxHp, Number((boss.hp + BOSS_REINFORCEMENT_REGEN_PER_SEC * DT).toFixed(3)));
            }
        }

        // Enemy AI
        const activeIonCells = hazards.length > 0 ? hazards.filter(h => h.type === 'ion_cell' && (h.warnT || 0) <= 0) : [];
        for (const e of enemies) {
            if (e.del) continue;
            const dx = player.x - e.x, dy = player.y - e.y;
            const dist = Math.hypot(dx, dy) || 1;
            e.a = Math.atan2(dy, dx);
            if ((e.stunImm || 0) > 0) e.stunImm = (e.stunImm || 0) - DT;
            if ((e.stun || 0) > 0) { e.stun = (e.stun || 0) - DT; continue; }
            const visible = isInCameraView(e.x, e.y, 40);
            let ionBoost = 1.0;
            for (let ih = 0; ih < activeIonCells.length; ih++) {
                const h = activeIonCells[ih];
                if (Math.hypot(e.x - h.x, e.y - h.y) <= h.r) { ionBoost = 1.35; break; }
            }

            if (e.t === 'drone') {
                let sepX = 0, sepY = 0;
                for (let j = 0; j < enemies.length; j++) {
                    const o = enemies[j];
                    if (o === e || o.del) continue;
                    const ox = e.x - o.x;
                    if (ox >= 26 || ox <= -26) continue;
                    const oy = e.y - o.y;
                    if (oy >= 26 || oy <= -26) continue;
                    const od2 = ox * ox + oy * oy;
                    if (od2 > 0 && od2 < 676) { const od = Math.sqrt(od2); sepX += (ox / od) * 38; sepY += (oy / od) * 38; }
                }
                e.x += (Math.cos(e.a) * e.spd * ionBoost + sepX) * DT;
                e.y += (Math.sin(e.a) * e.spd * ionBoost + sepY) * DT;
            } else if (e.t === 'scavenger') {
                let targetCrystal: (typeof crystals)[0] | null = null;
                let bestCrystalDist = 520;
                for (const c of crystals) {
                    if (c.del || (c.scrap || 0) <= 0) continue;
                    const cd = Math.hypot(c.x - e.x, c.y - e.y);
                    if (cd < bestCrystalDist) { bestCrystalDist = cd; targetCrystal = c; }
                }
                if (targetCrystal) {
                    const sa = Math.atan2(targetCrystal.y - e.y, targetCrystal.x - e.x);
                    e.a = sa;
                    e.x += Math.cos(sa) * e.spd * ionBoost * DT;
                    e.y += Math.sin(sa) * e.spd * ionBoost * DT;
                    if (Math.hypot(targetCrystal.x - e.x, targetCrystal.y - e.y) <= SCAVENGER_TUNING.stealRadius) {
                        targetCrystal.del = true;
                        scavengerStolenTotal += targetCrystal.scrap;
                        applyScavengerScrapSteal(e, targetCrystal.scrap);
                    }
                } else {
                    e.x += Math.cos(e.a) * e.spd * 0.85 * ionBoost * DT;
                    e.y += Math.sin(e.a) * e.spd * 0.85 * ionBoost * DT;
                }
            } else if (e.t === 'gunner') {
                if ((e.prepT || 0) <= 0 && (e.burstLeft || 0) <= 0) {
                    if (dist > 195) { e.x += Math.cos(e.a) * e.spd * ionBoost * DT; e.y += Math.sin(e.a) * e.spd * ionBoost * DT; }
                    else if (dist < 120) { e.x -= Math.cos(e.a) * e.spd * 0.55 * DT; e.y -= Math.sin(e.a) * e.spd * 0.55 * DT; }
                    else { e.x += Math.cos(e.a + 1.57) * e.spd * 0.62 * DT; e.y += Math.sin(e.a + 1.57) * e.spd * 0.62 * DT; }
                }
                if (visible) {
                    if ((e.burstLeft || 0) > 0) {
                        e.burstT = (e.burstT || 0) - DT;
                        if (e.burstT <= 0) {
                            e.burstLeft = (e.burstLeft || 1) - 1;
                            e.burstT = 0.15;
                            const fa = e.a + (rng() - 0.5) * 0.15;
                            enemyProjs.push({ kind: 'smg_round', x: e.x, y: e.y, vx: Math.cos(fa) * 440, vy: Math.sin(fa) * 440, r: 5, dmg: e.dmg, life: 1.4 });
                            if (e.burstLeft <= 0) e.fireCD = Math.max(1.9, 2.7 - wave * 0.03);
                        }
                    } else if ((e.prepT || 0) > 0) {
                        e.prepT = (e.prepT || 0) - DT;
                        if (e.prepT <= 0) { e.burstLeft = 3; e.burstT = 0; }
                    } else {
                        e.fireCD = (e.fireCD || 0) - DT;
                        if (e.fireCD <= 0 && dist <= 245) e.prepT = 0.45;
                    }
                }
            } else if (e.t === 'sniper') {
                if ((e.aimT || 0) <= 0) {
                    if (dist > 450) { e.x += Math.cos(e.a) * e.spd * ionBoost * DT; e.y += Math.sin(e.a) * e.spd * ionBoost * DT; }
                    else if (dist < 320) { e.x -= Math.cos(e.a) * e.spd * 0.9 * DT; e.y -= Math.sin(e.a) * e.spd * 0.9 * DT; }
                    else { e.x += Math.cos(e.a + 1.57) * e.spd * 0.5 * DT; e.y += Math.sin(e.a + 1.57) * e.spd * 0.5 * DT; }
                }
                if (visible) {
                    if ((e.aimT || 0) > 0) {
                        e.aimT = (e.aimT || 0) - DT;
                        if (e.aimT > 0.22) e.lockA = e.a;
                        else e.locked = true;
                        if (e.aimT <= 0) {
                            const la = e.lockA || e.a;
                            enemyProjs.push({ kind: 'sniper_bolt', x: e.x, y: e.y, vx: Math.cos(la) * 740, vy: Math.sin(la) * 740, r: 5.5, dmg: e.dmg, life: 2.2 });
                            e.aimCD = Math.max(2.0, 2.8 - wave * 0.03);
                            e.locked = false;
                        }
                    } else {
                        e.aimCD = (e.aimCD || 0) - DT;
                        if (e.aimCD <= 0 && dist <= 540) { e.aimT = 1.05; e.lockA = e.a; e.locked = false; }
                    }
                }
            } else if (e.t === 'tank') {
                e.x += Math.cos(e.a) * e.spd * ionBoost * DT;
                e.y += Math.sin(e.a) * e.spd * ionBoost * DT;
                if (visible) {
                    if ((e.prepT || 0) > 0) {
                        e.prepT = (e.prepT || 0) - DT;
                        if (e.prepT <= 0) {
                            const la = e.lockA ?? e.a;
                            enemyProjs.push({
                                kind: 'tank_cannonball',
                                x: e.x + Math.cos(la) * 26, y: e.y + Math.sin(la) * 26,
                                vx: Math.cos(la) * 320, vy: Math.sin(la) * 320,
                                a: la, r: 10, dmg: e.dmg, life: 2.3
                            });
                            e.fireCD = Math.max(2.0, 2.75 - wave * 0.02);
                        }
                    } else {
                        e.fireCD = (e.fireCD || 0) - DT;
                        if (e.fireCD <= 0 && dist <= 470) {
                            e.prepT = 0.50;
                            e.lockA = e.a;
                        }
                    }
                }
            } else if (e.t === 'kamikaze') {
                if (e.mode === 'chase') {
                    e.x += Math.cos(e.a) * e.spd * ionBoost * DT;
                    e.y += Math.sin(e.a) * e.spd * ionBoost * DT;
                    e.actionCD = (e.actionCD || 0) - DT;
                    const chargeTriggerDist = getKamikazeChargeRange(player.range);
                    if (dist <= e.r + player.r + 18) {
                        e.mode = 'explode_primed'; e.modeT = 1.0;
                    } else if (e.actionCD <= 0 && dist <= chargeTriggerDist) {
                        e.mode = 'charge_prep'; e.modeT = 0.45; e.dashA = e.a;
                    }
                } else if (e.mode === 'charge_prep') {
                    e.modeT = (e.modeT || 0) - DT;
                    e.dashA = e.a;
                    if (e.modeT <= 0) { e.mode = 'charge_dash'; e.modeT = 1.45; }
                } else if (e.mode === 'charge_dash') {
                    const dashSpd = e.spd * 2.45 * ionBoost;
                    e.x += Math.cos(e.dashA || e.a) * dashSpd * DT;
                    e.y += Math.sin(e.dashA || e.a) * dashSpd * DT;
                    e.modeT = (e.modeT || 0) - DT;
                    if (dist <= e.r + player.r + 24 || (e.modeT <= 0 && dist <= 115)) {
                        e.mode = 'explode_primed'; e.modeT = 1.0;
                    } else if (e.modeT <= 0) {
                        e.mode = 'chase'; e.actionCD = 1.1;
                    }
                } else if (e.mode === 'explode_primed') {
                    e.modeT = (e.modeT || 0) - DT;
                    if (e.modeT <= 0) {
                        e.del = true;
                        const blastR = getKamikazeExplosionRadius(player.range);
                        if (Math.hypot(player.x - e.x, player.y - e.y) <= blastR + player.r * 0.5) {
                            hurtPlayer(e.dmg, 'kamikaze_explosion');
                        }
                    }
                }
            } else if (e.t === 'bastion') {
                if ((e.shieldDownT || 0) > 0) e.shieldDownT = Math.max(0, (e.shieldDownT || 0) - DT);
                if (e.mode === 'chase') {
                    e.shieldA = e.a;
                    e.x += Math.cos(e.a) * e.spd * ionBoost * DT;
                    e.y += Math.sin(e.a) * e.spd * ionBoost * DT;
                    e.actionCD = (e.actionCD || 0) - DT;
                    if (visible && e.actionCD <= 0 && dist <= 330) {
                        e.mode = 'shield_prep'; e.modeT = 0.42; e.lockA = e.a; e.shieldA = e.a; e.bashHit = false;
                    }
                } else if (e.mode === 'shield_prep') {
                    e.modeT = (e.modeT || 0) - DT;
                    e.lockA = e.a; e.shieldA = e.lockA;
                    if (e.modeT <= 0) { e.mode = 'shield_bash'; e.modeT = 0.42; e.bashHit = false; }
                } else if (e.mode === 'shield_bash') {
                    const la = e.lockA ?? e.a;
                    const bashSpd = e.spd * 6.2 * ionBoost;
                    e.x += Math.cos(la) * bashSpd * DT;
                    e.y += Math.sin(la) * bashSpd * DT;
                    if (!e.bashHit && Math.hypot(player.x - e.x, player.y - e.y) <= e.r + player.r + 24) {
                        e.bashHit = true;
                        playerKnockVx = Math.cos(la) * 580;
                        playerKnockVy = Math.sin(la) * 580;
                        playerKnockT = 0.26;
                        hurtPlayer(e.dmg, 'bastion_shield_bash');
                    }
                    e.modeT = (e.modeT || 0) - DT;
                    if (e.modeT <= 0) { e.mode = 'chase'; e.actionCD = 1.95; }
                }
            } else if (e.t === 'artillery') {
                if (e.mode === 'chase') {
                    if (dist > 340) { e.x += Math.cos(e.a) * e.spd * ionBoost * DT; e.y += Math.sin(e.a) * e.spd * ionBoost * DT; }
                    else if (dist < 190) { e.x -= Math.cos(e.a) * e.spd * 0.72 * DT; e.y -= Math.sin(e.a) * e.spd * 0.72 * DT; }
                    else { const strafe = (e.id % 2 === 0 ? 1 : -1); e.x += Math.cos(e.a + strafe * 1.57) * e.spd * 0.58 * DT; e.y += Math.sin(e.a + strafe * 1.57) * e.spd * 0.58 * DT; }
                    e.actionCD = (e.actionCD || 0) - DT;
                    if (visible && e.actionCD <= 0 && dist <= 440) { e.mode = 'harpoon_prep'; e.modeT = 0.65; e.lockA = e.a; e.locked = false; }
                } else if (e.mode === 'harpoon_prep') {
                    e.modeT = (e.modeT || 0) - DT;
                    if (e.modeT > 0.16) e.lockA = e.a;
                    else e.locked = true;
                    if (e.modeT <= 0) {
                        e.locked = false;
                        e.mode = 'harpoon_cast';
                        const la = e.lockA ?? e.a;
                        const spd = 640;
                        e.harpoon = { state: 'out', x: e.x + Math.cos(la) * 24, y: e.y + Math.sin(la) * 24, vx: Math.cos(la) * spd, vy: Math.sin(la) * spd, a: la, dist: 0, maxDist: 470, hit: false };
                    }
                } else if (e.mode === 'harpoon_cast') {
                    const hp = e.harpoon;
                    if (!hp) { e.mode = 'chase'; e.actionCD = 2.5; }
                    else if (hp.state === 'out') {
                        hp.x += hp.vx * DT; hp.y += hp.vy * DT;
                        hp.dist += Math.hypot(hp.vx, hp.vy) * DT;
                        if (Math.hypot(hp.x - player.x, hp.y - player.y) <= player.r + 10) {
                            hp.hit = true; hp.state = 'latched';
                            playerTether = { sourceId: e.id, timer: 3.0 };
                            playerPullT = 0.24;
                            hurtPlayer(e.dmg, 'arpoador_harpoon');
                        } else if (hp.dist >= hp.maxDist || hp.x < PAD || hp.x > ARENA_W - PAD || hp.y < PAD || hp.y > ARENA_H - PAD) {
                            hp.state = 'retract';
                        }
                    } else if (hp.state === 'latched') {
                        if (playerTether && playerTether.sourceId === e.id && playerTether.timer > 0) {
                            hp.x = player.x; hp.y = player.y;
                        } else {
                            hp.state = 'retract';
                        }
                    } else if (hp.state === 'retract') {
                        const rx = e.x - hp.x, ry = e.y - hp.y, rd = Math.hypot(rx, ry);
                        const retSpd = 760 * DT;
                        if (rd <= retSpd + 16) { e.harpoon = null; e.mode = 'chase'; e.actionCD = hp.hit ? 2.4 : 2.1; }
                        else { hp.x += (rx / rd) * retSpd; hp.y += (ry / rd) * retSpd; }
                    }
                }
            } else if (e.t === 'miniboss') {
                if (e.mode === 'chase') {
                    if (dist > 196) { e.x += Math.cos(e.a) * e.spd * ionBoost * DT; e.y += Math.sin(e.a) * e.spd * ionBoost * DT; }
                    else { const strafe = e.slashDir || 1; e.x += Math.cos(e.a + strafe * 1.57) * e.spd * 0.48 * DT; e.y += Math.sin(e.a + strafe * 1.57) * e.spd * 0.48 * DT; }
                    e.actionCD = (e.actionCD || 0) - DT;
                    if (visible && e.actionCD <= 0 && dist <= 378) { e.mode = 'blade_prep'; e.modeT = 0.60; e.lockA = e.a; }
                } else if (e.mode === 'blade_prep') {
                    e.modeT = (e.modeT || 0) - DT;
                    if (e.modeT > 0.16) e.lockA = e.a;
                    if (e.modeT <= 0) {
                        e.mode = 'blade_slash'; e.modeT = 0.28; e.slashDir = (e.slashDir || 1) * -1;
                        const la = e.lockA ?? e.a;
                        e.x += Math.cos(la + e.slashDir * 0.6) * 25;
                        e.y += Math.sin(la + e.slashDir * 0.6) * 25;
                        const pAng = Math.atan2(player.y - e.y, player.x - e.x);
                        const angDiff = Math.abs(Math.atan2(Math.sin(pAng - la), Math.cos(pAng - la)));
                        if (Math.hypot(player.x - e.x, player.y - e.y) <= 143 && angDiff <= 1.25) {
                            hurtPlayer(e.dmg, 'miniboss_blade_slash');
                        }
                        enemyProjs.push({ kind: 'blade_mist', x: e.x + Math.cos(la) * 38, y: e.y + Math.sin(la) * 38, vx: Math.cos(la) * 420, vy: Math.sin(la) * 420, a: la, r: 31, dmg: e.dmg, life: 1.25 });
                    }
                } else if (e.mode === 'blade_slash') {
                    e.modeT = (e.modeT || 0) - DT;
                    if (e.modeT <= 0) { e.mode = 'chase'; e.actionCD = 2.15; }
                }
            } else if (e.isBossUnit) {
                const bv = e.bossVariant || 'titan';
                if (e.mode === 'chase') {
                    const prefMin = bv === 'titan' ? 95 : bv === 'phantom' ? 210 : bv === 'siege' ? 200 : 210;
                    const prefMax = bv === 'titan' ? 185 : bv === 'phantom' ? 370 : bv === 'siege' ? 360 : 370;
                    if (dist > prefMax) {
                        e.x += Math.cos(e.a) * e.spd * ionBoost * DT;
                        e.y += Math.sin(e.a) * e.spd * ionBoost * DT;
                    } else if (dist < prefMin) {
                        e.x -= Math.cos(e.a) * e.spd * 0.45 * DT;
                        e.y -= Math.sin(e.a) * e.spd * 0.45 * DT;
                    } else {
                        const strafeDir = (e.id % 2 === 0 ? 1 : -1);
                        e.x += Math.cos(e.a + strafeDir * 1.57) * e.spd * 0.55 * DT;
                        e.y += Math.sin(e.a + strafeDir * 1.57) * e.spd * 0.55 * DT;
                    }
                    e.actionCD = (e.actionCD || 0) - DT;
                    if (visible && e.actionCD <= 0 && dist <= 650) {
                        if (bv === 'titan') { e.mode = 'fire_prep'; e.modeT = 0.55; e.lockA = e.a; }
                        else if (bv === 'phantom') { e.mode = 'laser_prep'; e.modeT = 0.85; e.lockA = e.a; e.locked = false; }
                        else if (bv === 'siege') { e.mode = 'missile_prep'; e.modeT = 0.55; e.lockA = e.a; }
                        else { e.mode = 'bomb_prep'; e.modeT = 0.55; e.lockA = e.a; }
                    }
                } else if (e.mode === 'fire_prep') {
                    e.modeT = (e.modeT || 0) - DT;
                    e.lockA = e.a;
                    if (e.modeT <= 0) {
                        bossAttacks.fireCount++;
                        const count = 7, step = 0.19;
                        const la = e.lockA ?? e.a;
                        const mx = e.x + Math.cos(la) * (e.r * 0.75);
                        const my = e.y + Math.sin(la) * (e.r * 0.75);
                        for (let i = 0; i < count; i++) {
                            const off = i - (count - 1) / 2;
                            const fa = la + off * step;
                            const spd = 335 + Math.abs(off) * -10;
                            enemyProjs.push({ kind: 'fire_flame', x: mx, y: my, vx: Math.cos(fa) * spd, vy: Math.sin(fa) * spd, a: fa, r: 9.5, dmg: e.dmg, life: 1.55 });
                        }
                        e.mode = 'chase';
                        e.actionCD = Math.max(1.85, 2.1 - wave * 0.02);
                    }
                } else if (e.mode === 'laser_prep') {
                    e.modeT = (e.modeT || 0) - DT;
                    if (e.modeT > 0.26) e.lockA = e.a;
                    else e.locked = true;
                    if (e.modeT <= 0) {
                        bossAttacks.laserCount++;
                        const la = e.lockA ?? e.a;
                        const mx = e.x + Math.cos(la) * (e.r * 0.6);
                        const my = e.y + Math.sin(la) * (e.r * 0.6);
                        laserBeams.push({ fromBoss: true, x: mx, y: my, ang: la, length: 860, warnT: 0, activeT: 0.32, width: 30, dmg: e.dmg, hit: false });
                        e.locked = false;
                        e.mode = 'chase';
                        e.actionCD = Math.max(2.1, 2.2 - wave * 0.025);
                    }
                } else if (e.mode === 'missile_prep') {
                    e.modeT = (e.modeT || 0) - DT;
                    e.lockA = e.a;
                    if (e.modeT <= 0) {
                        const la = e.lockA ?? e.a;
                        const nMiss = 3;
                        const mHp = Math.max(8, Math.round(player.dmg * 1.8));
                        for (let i = 0; i < nMiss; i++) {
                            bossAttacks.missilesLaunched++;
                            const off = (i - (nMiss - 1) / 2) * 0.45;
                            const ma = la + off;
                            const sideX = -Math.sin(la) * (i % 2 === 0 ? 16 : -16);
                            const sideY = Math.cos(la) * (i % 2 === 0 ? 16 : -16);
                            const mx = e.x + sideX;
                            const my = e.y + sideY;
                            enemyProjs.push({
                                kind: 'homing_missile', destructible: true, hp: mHp, maxHp: mHp,
                                x: mx, y: my, vx: Math.cos(ma) * 215, vy: Math.sin(ma) * 215,
                                a: ma, spd: 215, turnRate: 2.35, r: 12, dmg: e.dmg, life: 4.8
                            });
                        }
                        e.mode = 'chase';
                        e.actionCD = Math.max(2.3, 2.4 - wave * 0.025);
                    }
                } else if (e.mode === 'bomb_prep') {
                    e.modeT = (e.modeT || 0) - DT;
                    if (e.modeT <= 0) {
                        const nBombs = 4;
                        for (let k = 0; k < nBombs; k++) {
                            bossAttacks.bombsDropped++;
                            const spread = k === 0 ? 45 : 175;
                            const bx = Math.max(PAD + 75, Math.min(ARENA_W - PAD - 75, player.x + (rng() - 0.5) * spread * 2));
                            const by = Math.max(PAD + 75, Math.min(ARENA_H - PAD - 75, player.y + (rng() - 0.5) * spread * 2));
                            hazards.push({ type: 'boss_bomb', x: bx, y: by, r: 68, life: 3.0, maxLife: 3.0, dmg: e.dmg });
                        }
                        e.mode = 'chase';
                        e.actionCD = Math.max(2.5, 2.6 - wave * 0.025);
                    }
                }
            }
            e.x = Math.max(PAD + e.r, Math.min(ARENA_W - PAD - e.r, e.x));
            e.y = Math.max(PAD + e.r, Math.min(ARENA_H - PAD - e.r, e.y));
        }

        // Orbitals
        player.orbitA += DT * (1.55 + player.orbits * 0.25);
        if (player.orbits > 0) {
            const orbitR = player.evos.singularity ? 60 : 48;
            const orbHitR = player.evos.singularity ? 13 : 9;
            for (let i = 0; i < player.orbits; i++) {
                const oa = player.orbitA + (i / player.orbits) * 6.283;
                const ox = player.x + Math.cos(oa) * orbitR, oy = player.y + Math.sin(oa) * orbitR;
                if (player.evos.singularity) {
                    for (const c of crystals) { if (Math.hypot(c.x - ox, c.y - oy) < 95) c.magged = true; }
                }
                for (const e of enemies) {
                    if (e.del) continue;
                    if (Math.hypot(ox - e.x, oy - e.y) < e.r + orbHitR) {
                        if (!e._orbHit) e._orbHit = [];
                        if ((e._orbHit[i] || 0) <= playT) {
                            e._orbHit[i] = playT + combat.orbitTickCd;
                            damageEnemy(e, Math.max(2, player.dmg * (player.evos.singularity ? 0.56 : 0.38) * combat.orbitDmgScale), oa, false);
                        }
                    }
                }
                for (const ep of enemyProjs) {
                    if (!ep.del && ep.destructible && Math.hypot(ox - ep.x, oy - ep.y) < ep.r + orbHitR + 4) {
                        ep.hp = (ep.hp || 1) - Math.max(4, player.dmg * 0.8);
                        if (ep.hp <= 0) { ep.del = true; bossAttacks.missilesIntercepted++; }
                    }
                }
            }
        }

        // Hazards
        for (const h of hazards) {
            h.life -= DT;
            if (h.type === 'boss_bomb' && h.life <= 0) {
                h.del = true;
                if (Math.hypot(player.x - h.x, player.y - h.y) <= h.r) {
                    bossAttacks.bombsHit++;
                    hurtPlayer(h.dmg || 17, 'boss_bomb');
                }
            } else if (h.type === 'bomb' && h.life <= 0) {
                h.del = true;
                if (Math.hypot(player.x - h.x, player.y - h.y) <= h.r) hurtPlayer(h.dmg || 14, 'event_bomb');
            } else if (h.type === 'emp_field') {
                h.tickT = (h.tickT || 0) - DT;
                if (h.tickT <= 0) {
                    h.tickT = 0.5;
                    for (const e of enemies) {
                        if (!e.del && Math.hypot(e.x - h.x, e.y - h.y) <= h.r) {
                            if (!e.stunImm || e.stunImm <= 0) { e.stun = Math.max(e.stun || 0, 0.16); e.stunImm = 1.15; }
                            damageEnemy(e, player.dmg * 0.35, null, false);
                        }
                    }
                }
                if (h.life <= 0) h.del = true;
            } else if (h.type === 'ion_cell') {
                if ((h.warnT || 0) > 0) { h.warnT = (h.warnT || 0) - DT; continue; }
                h.tickT = (h.tickT || 0) - DT;
                if (h.tickT <= 0) {
                    h.tickT = 0.6;
                    if (Math.hypot(player.x - h.x, player.y - h.y) <= h.r) hurtPlayer(h.dmg || 9, 'event_ion');
                }
                if (h.life <= 0) h.del = true;
            }
        }
        hazards = hazards.filter(h => !h.del);

        for (const lb of laserBeams) {
            if (lb.warnT > 0) {
                lb.warnT -= DT;
                if (lb.warnT <= 0 && !lb.hit) {
                    lb.hit = true;
                    const ca = Math.cos(lb.ang), sa = Math.sin(lb.ang);
                    const perp = Math.abs((player.x - lb.x) * -sa + (player.y - lb.y) * ca);
                    if (perp <= lb.width * 0.5 + player.r * 0.65) hurtPlayer(lb.dmg, 'event_laser');
                }
            } else {
                if (lb.fromBoss && !lb.hit) {
                    lb.hit = true;
                    const x1 = lb.x, y1 = lb.y;
                    const x2 = x1 + Math.cos(lb.ang) * (lb.length || 700), y2 = y1 + Math.sin(lb.ang) * (lb.length || 700);
                    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1;
                    const t = Math.max(0, Math.min(1, ((player.x - x1) * dx + (player.y - y1) * dy) / l2));
                    const px = x1 + t * dx, py = y1 + t * dy;
                    if (Math.hypot(player.x - px, player.y - py) <= lb.width * 0.5 + player.r * 0.6) hurtPlayer(lb.dmg, 'boss_laser');
                }
                lb.activeT -= DT;
                if (lb.activeT <= 0) lb.del = true;
            }
        }
        laserBeams = laserBeams.filter(lb => !lb.del);

        // Mines
        for (const m of mines) {
            m.life -= DT;
            if (m.life <= 0) { m.del = true; continue; }
            for (const e of enemies) {
                if (!e.del && Math.hypot(e.x - m.x, e.y - m.y) <= e.r + 18) {
                    m.del = true;
                    for (const o of enemies) {
                        if (!o.del && Math.hypot(o.x - m.x, o.y - m.y) <= m.r) damageEnemy(o, m.dmg, null, false);
                    }
                    break;
                }
            }
        }
        mines = mines.filter(m => !m.del);

        // Player Projectiles
        for (const p of projs) {
            if (p.missile) {
                p.life = (p.life || 0) - DT;
                if (p.life <= 0) p.del = true;
                let best: SimEnemy | null = null, bd = 320;
                for (const e of enemies) { if (!e.del) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } } }
                if (best) {
                    const ta = Math.atan2(best.y - p.y, best.x - p.x);
                    const diff = Math.atan2(Math.sin(ta - p.a), Math.cos(ta - p.a));
                    p.a += Math.sign(diff) * Math.min(Math.abs(diff), DT * 6.5);
                    p.vx = Math.cos(p.a) * 440; p.vy = Math.sin(p.a) * 440;
                }
            }
            p.x += p.vx * DT; p.y += p.vy * DT;
            if (p.x < PAD || p.x > ARENA_W - PAD || p.y < PAD || p.y > ARENA_H - PAD || (!p.missile && Math.hypot(p.x - p.ox, p.y - p.oy) >= player.range + 40)) {
                p.del = true;
            }
            const pr = p.missile ? 10 : 8;
            for (const ep of enemyProjs) {
                if (p.del || ep.del || !ep.destructible) continue;
                const mdx = p.x - ep.x, mdy = p.y - ep.y, mhr = ep.r + (p.missile ? 10 : 9);
                if (mdx * mdx + mdy * mdy < mhr * mhr) {
                    ep.hp = (ep.hp || 1) - p.dmg;
                    if (ep.hp <= 0) { ep.del = true; bossAttacks.missilesIntercepted++; }
                    if (p.pierceLeft > 0) p.pierceLeft--;
                    else p.del = true;
                }
            }
            for (const e of enemies) {
                if (p.del || e.del || p.hitIds.has(e.id)) continue;
                const hitR = e.r + pr;
                const pdx = p.x - e.x;
                if (pdx >= hitR || pdx <= -hitR) continue;
                const pdy = p.y - e.y;
                if (pdy >= hitR || pdy <= -hitR) continue;
                if (pdx * pdx + pdy * pdy < hitR * hitR) {
                    p.hitIds.add(e.id);
                    if (p.thermo) {
                        for (const o of enemies) { if (!o.del && Math.hypot(o.x - p.x, o.y - p.y) <= 95) damageEnemy(o, p.dmg, null, false); }
                    } else {
                        damageEnemy(e, p.dmg, p.a, true);
                    }
                    if (player.chain > 0 && p.mainShot && !p.wingman && !p.piercedHit && player.chainCD <= 0) {
                        player.chainCD = combat.chainCooldown;
                        let arcs = 0;
                        const maxArcs = Math.min(combat.chainMaxArcs, player.chain + 1 + (player.evos.teslaCoil ? 1 : 0));
                        for (const o of enemies) {
                            if (arcs >= maxArcs) break;
                            if (o === e || o.del) continue;
                            if (Math.hypot(o.x - e.x, o.y - e.y) <= combat.chainRadius) {
                                if (player.evos.teslaCoil && (!o.stunImm || o.stunImm <= 0)) {
                                    o.stun = Math.max(o.stun || 0, o.t === 'boss' ? 0.1 : 0.25);
                                    o.stunImm = 0.75;
                                }
                                const hopDmg = Math.max(0.5, p.dmg * combat.chainHopScale * Math.pow(combat.chainHopDecay, arcs));
                                damageEnemy(o, hopDmg, null, false);
                                arcs++;
                            }
                        }
                    }
                    if (p.pierceLeft > 0) { p.pierceLeft--; p.piercedHit = true; }
                    else p.del = true;
                }
            }
        }

        // Enemy Projectiles
        for (const ep of enemyProjs) {
            if (ep.del) continue;
            ep.life -= DT;
            if (ep.life <= 0) { ep.del = true; continue; }
            if (ep.kind === 'homing_missile') {
                const ta = Math.atan2(player.y - ep.y, player.x - ep.x);
                const diff = Math.atan2(Math.sin(ta - (ep.a || 0)), Math.cos(ta - (ep.a || 0)));
                ep.a = (ep.a || 0) + Math.sign(diff) * Math.min(Math.abs(diff), DT * (ep.turnRate || 2.35));
                ep.vx = Math.cos(ep.a) * (ep.spd || 190);
                ep.vy = Math.sin(ep.a) * (ep.spd || 190);
            }
            ep.x += ep.vx * DT; ep.y += ep.vy * DT;
            if (ep.x < PAD || ep.x > ARENA_W - PAD || ep.y < PAD || ep.y > ARENA_H - PAD) { ep.del = true; continue; }
            if (Math.hypot(ep.x - player.x, ep.y - player.y) < player.r + ep.r - 2) {
                ep.del = true;
                hurtPlayer(ep.dmg, ep.kind || 'enemy_proj');
            }
        }
        enemyProjs = enemyProjs.filter(ep => !ep.del);

        // Contact damage
        if (player.inv <= 0) {
            for (const e of enemies) {
                if (e.del) continue;
                if (e.t === 'kamikaze' && e.mode === 'explode_primed') continue;
                if (Math.hypot(player.x - e.x, player.y - e.y) < player.r + e.r - 2) {
                    hurtPlayer(e.dmg, 'contact_' + e.t);
                    if (dead) break;
                    break;
                }
            }
        }
        if (dead) break;

        // Scrap collection & Repair Capsules
        const magnetRadius = Math.round(player.range * 0.40 + (hangar.lab.magnet || 0) * 5);
        for (const c of crystals) {
            if (c.del) continue;
            c.life -= DT;
            if (c.life <= 0) { c.del = true; continue; }
            let scrapDist = Math.hypot(player.x - c.x, player.y - c.y);
            if (globalMagT > 0) c.magged = true;
            if (c.magged || scrapDist < magnetRadius) {
                const angle = Math.atan2(player.y - c.y, player.x - c.x);
                const pullSpeed = c.magged ? 720 : (430 + (1 - scrapDist / Math.max(1, magnetRadius)) * 320);
                c.x += Math.cos(angle) * pullSpeed * DT;
                c.y += Math.sin(angle) * pullSpeed * DT;
                scrapDist = Math.hypot(player.x - c.x, player.y - c.y);
            }
            if (scrapDist < player.r + 12) {
                c.del = true;
                if (cfg.collectPickupRate === undefined || rng() <= cfg.collectPickupRate) {
                    awardScrap(c.scrap || 0);
                }
            }
        }

        for (const cap of repairCapsules) {
            if (cap.del) continue;
            cap.life -= DT;
            if (cap.life <= 0) { cap.del = true; continue; }
            let capDist = Math.hypot(player.x - cap.x, player.y - cap.y);
            if (globalMagT > 0) cap.magged = true;
            if (cap.magged || capDist < magnetRadius) {
                const angle = Math.atan2(player.y - cap.y, player.x - cap.x);
                const pullSpeed = cap.magged ? 720 : REPAIR_CAPSULE_TUNING.attractSpeed;
                cap.x += Math.cos(angle) * pullSpeed * DT;
                cap.y += Math.sin(angle) * pullSpeed * DT;
                capDist = Math.hypot(player.x - cap.x, player.y - cap.y);
            }
            if (capDist < player.r + 12) {
                cap.del = true;
                capsulesCollected++;
                const effect = applyRepairCapsulePickup(player, capsuleTuning);
                if (effect.kind === 'healed') capsuleHealTotal += effect.amount;
                else capsuleTempMaxHpGained += effect.amount;
            }
        }

        if (pendingKillLevelUps > 0) {
            const gained = pendingKillLevelUps;
            pendingKillLevelUps = 0;
            for (let g = 0; g < gained; g++) triggerUpgradeChoice();
        }

        enemies = enemies.filter(e => !e.del);
        projs = projs.filter(p => !p.del);
        crystals = crystals.filter(c => !c.del);
        repairCapsules = repairCapsules.filter(cap => !cap.del);
    }

    const minutes = Math.max(1 / 60, playT / 60);
    return {
        build: cfg.build,
        labTier: cfg.labTier,
        playStyle,
        chassis: ch.id,
        survivedToEnd: !dead,
        deathWave: wave,
        survivalTime: Number(playT.toFixed(1)),
        scrapEarned: runScrap,
        finalLevel: player.lv,
        endHp: Number(player.hp.toFixed(1)),
        endMaxHp: Number(player.maxHp.toFixed(1)),
        kills: runKills,
        tanks: runTanks,
        damageDealt: Math.round(damageDealt),
        damageReceived: Math.round(damageReceived),
        primaryShotsFired,
        primaryShotsPerMin: Number((primaryShotsFired / minutes).toFixed(2)),
        firstUpgradeTime: upgradeTimes[0] ?? null,
        secondUpgradeTime: upgradeTimes[1] ?? null,
        thirdUpgradeTime: upgradeTimes[2] ?? null,
        upgradeTimes,
        upgradesPicked: upgradePicks,
        evosUnlocked: Object.keys(unlockedEvos),
        waveSnapshots,
        levelTimes,
        fallbackPicks,
        xpOverflowLost,
        killsByType,
        damageBySource,
        capsulesDropped,
        capsulesCollected,
        capsuleHealTotal: Number(capsuleHealTotal.toFixed(1)),
        capsuleTempMaxHpGained: Number(capsuleTempMaxHpGained.toFixed(1)),
        scavengerStolenTotal: Number(scavengerStolenTotal.toFixed(1)),
        scavengerReturnedTotal: Number(scavengerReturnedTotal.toFixed(1)),
        directorStats: {
            spawnedByType: { ...director.stats.spawnedByType },
            droppedDrones: director.stats.droppedDrones,
            delayedDangerousSpawns: director.stats.delayedDangerousSpawns,
        },
        bossAttempts,
        bossDefeated,
        bossAttacks
    };
}
