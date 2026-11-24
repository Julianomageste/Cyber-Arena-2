import { ROBOT_CATALOG_DEFS, getRobotById, getRobotSpriteKeys, type RobotId } from './robots';
import type { CampaignProgress } from './villains';

export type Lang = 'en' | 'pt';
export type ChassisId = RobotId;
export type CardCategory = 'weapon' | 'passive' | 'tactical';
export type Rarity = 'common' | 'rare' | 'epic' | 'evo';

export interface ChassisPalette {
    main: string;
    dark: string;
    light: string;
    visor: string;
    visorGlow: string;
    accent: string;
}

export interface ChassisDef {
    id: ChassisId;
    name: string;
    nameEn: string;
    number: number;
    unlockWave: number;
    unlockBossNumber: number;
    cost: number;
    medalsReq: number;
    hpMult: number;
    dmgMult: number;
    spdMult: number;
    armor: number;
    crit: number;
    chain: number;
    empMult: number;
    descPt: string;
    descEn: string;
    pal: ChassisPalette;
}

export interface LabUpgradeDef {
    id: 'hull' | 'weapon' | 'capacitor' | 'engine' | 'magnet' | 'empCore' | 'salvage';
    namePt: string;
    nameEn: string;
    descPt: string;
    descEn: string;
    baseCost: number;
    growth: number;
    maxLv: number;
}

export interface HangarState {
    kills: number;
    tanks: number;
    bestWave: number;
    bestTime: number;
    bestLevel: number;
    scrap: number;
    ach: Record<string, number>;
    chassis: ChassisId;
    unlockedChassis: Record<string, boolean>;
    lab: Record<string, number>;
    stageLabPurchases?: Record<string, number>;
    stageLabStage?: number;
    goldSkinActive: boolean;
    campaign?: CampaignProgress;
}

export interface PlayerStats {
    x: number;
    y: number;
    r: number;
    chassis: ChassisId;
    spd: number;
    maxHp: number;
    hp: number;
    tempMaxHpBonus?: number;
    inv: number;
    aim: number;
    dmg: number;
    baseRate: number;
    rate: number;
    fireT: number;
    range: number;
    mag: number;
    lv: number;
    xp: number;
    maxXp: number;
    spreadLv: number;
    orbits: number;
    orbitA: number;
    pierce: number;
    chain: number;
    chainCD: number;
    missiles: number;
    missileT: number;
    wingmen: number;
    wingA: number;
    wingFireT: number;
    mineLv: number;
    mineT: number;
    laserLv: number;
    laserT: number;
    armor: number;
    critChance: number;
    critMult: number;
    reactiveLv: number;
    regen: number;
    xpMult: number;
    scrapMult: number;
    enemySpdBonus: number;
    empCd: number;
    empRad: number;
    walkPhase: number;
    recoil: number;
    evos: Record<string, boolean>;
}

export interface CardDef {
    id: string;
    cat: CardCategory;
    icon: string;
    maxLv?: number;
    noSlot?: boolean;
    rarityScalable?: boolean;
    pt: [string, string];
    en: [string, string];
    fn: (p: PlayerStats, mult: number, ctx?: CardApplyContext) => void;
}

export interface CardApplyContext {
    awardScrap?: (base: number, x: number, y: number, showFloat?: boolean) => void;
    triggerOvercharge?: (sec: number) => void;
    resetEmp?: () => void;
}

export interface EvoDef {
    id: string;
    weapon: string;
    wMin: number;
    passive: string | null;
    pMin: number;
    icon: string;
    pt: [string, string];
    en: [string, string];
    fn: (p: PlayerStats) => void;
}

export interface UpgradeChoice {
    isEvo: boolean;
    evo?: EvoDef;
    card?: CardDef;
    rarity: Rarity;
    mult: number;
}

export const CHASSIS_DATA: ChassisDef[] = ROBOT_CATALOG_DEFS.map(r => ({
    id: r.id,
    name: r.namePt,
    nameEn: r.nameEn,
    number: r.number,
    unlockWave: r.unlockWave,
    unlockBossNumber: r.unlockBossNumber,
    cost: 0,
    medalsReq: 0,
    hpMult: r.hpMult,
    dmgMult: r.dmgMult,
    spdMult: r.spdMult,
    armor: r.armor,
    crit: r.crit,
    chain: r.chain,
    empMult: r.empMult,
    descPt: r.descPt,
    descEn: r.descEn,
    pal: { ...r.pal }
}));

export const LAB_UPGRADES: LabUpgradeDef[] = [
    { id: 'hull', namePt: 'Chapeamento do Chassi', nameEn: 'Chassis Plating', descPt: '+12 HP base por nível', descEn: '+12 Base HP per level', baseCost: 48, growth: 1.32, maxLv: 10 },
    { id: 'weapon', namePt: 'Núcleo Balístico', nameEn: 'Ballistic Core', descPt: '+8% Dano base por nível', descEn: '+8% Base Damage per level', baseCost: 54, growth: 1.32, maxLv: 10 },
    { id: 'capacitor', namePt: 'Capacitor de Disparo', nameEn: 'Fire Capacitor', descPt: '+5% Cadência por nível', descEn: '+5% Fire Rate per level', baseCost: 66, growth: 1.32, maxLv: 10 },
    { id: 'engine', namePt: 'Servomotores', nameEn: 'Servo Thrusters', descPt: '+5% Velocidade por nível', descEn: '+5% Move Speed per level', baseCost: 42, growth: 1.32, maxLv: 10 },
    { id: 'magnet', namePt: 'Bobina Magnética', nameEn: 'Magnet Coil', descPt: '+5px no raio de atração automática', descEn: '+5px automatic pickup radius', baseCost: 42, growth: 1.32, maxLv: 10 },
    { id: 'empCore', namePt: 'Reator EMP', nameEn: 'EMP Reactor', descPt: '-6% Recarga EMP e +16px raio', descEn: '-6% EMP Cooldown & +16px radius', baseCost: 72, growth: 1.32, maxLv: 10 },
    { id: 'salvage', namePt: 'Extrator de Sucata', nameEn: 'Scrap Harvester', descPt: '+10% Sucata obtida por nível', descEn: '+10% Scrap gained per level', baseCost: 54, growth: 1.32, maxLv: 10 }
];

export const LAB_STAGE_PURCHASE_LIMIT = 2;

export function createDefaultStageLabPurchases(): Record<LabUpgradeDef['id'], number> {
    return { hull: 0, weapon: 0, capacitor: 0, engine: 0, magnet: 0, empCore: 0, salvage: 0 };
}

export function normalizeStageLabPurchases(raw: unknown): Record<LabUpgradeDef['id'], number> {
    const out = createDefaultStageLabPurchases();
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const obj = raw as Record<string, unknown>;
        for (const u of LAB_UPGRADES) {
            const val = Number(obj[u.id]);
            if (Number.isFinite(val) && val > 0) {
                out[u.id] = Math.min(LAB_STAGE_PURCHASE_LIMIT, Math.floor(val));
            }
        }
    }
    return out;
}

export function getLabPurchasesInStage(
    hangar: Pick<HangarState, 'stageLabPurchases'>,
    id: LabUpgradeDef['id']
): number {
    return Math.max(0, Math.min(LAB_STAGE_PURCHASE_LIMIT, Math.floor(hangar.stageLabPurchases?.[id] || 0)));
}

export function getRemainingLabPurchasesInStage(
    hangar: Pick<HangarState, 'stageLabPurchases'>,
    id: LabUpgradeDef['id']
): number {
    return Math.max(0, LAB_STAGE_PURCHASE_LIMIT - getLabPurchasesInStage(hangar, id));
}

export function canBuyLabUpgradeInStage(
    hangar: Pick<HangarState, 'scrap' | 'lab' | 'stageLabPurchases'>,
    u: LabUpgradeDef
): boolean {
    const lv = Math.max(0, Math.floor(hangar.lab?.[u.id] || 0));
    if (lv >= u.maxLv) return false;
    if (getRemainingLabPurchasesInStage(hangar, u.id) <= 0) return false;
    return Math.floor(Number(hangar.scrap) || 0) >= labCost(u, lv);
}

export function getLabUpgradeBonusValue(id: LabUpgradeDef['id'], level: number): { label: string; numericValue: number } {
    const lv = Math.max(0, Math.min(10, Math.floor(level || 0)));
    if (id === 'hull') return { label: `+${lv * 12} HP`, numericValue: 100 + lv * 12 };
    if (id === 'weapon') return { label: `+${lv * 8}% DMG`, numericValue: Number((10 * (1 + lv * 0.08)).toFixed(2)) };
    if (id === 'capacitor') return { label: `+${lv * 5}% ROF`, numericValue: Number((1 / (0.42 / (1 + lv * 0.05))).toFixed(2)) };
    if (id === 'engine') return { label: `+${lv * 5}% SPD`, numericValue: Math.round(248 * (1 + lv * 0.05)) };
    if (id === 'magnet') return { label: `+${lv * 5}px MAG`, numericValue: Math.round(290 * 0.40 + lv * 5) };
    if (id === 'empCore') {
        const cd = Number(Math.max(4.2, 8 * Math.pow(0.94, lv)).toFixed(2));
        return { label: `${cd}s / ${225 + lv * 16}px`, numericValue: cd };
    }
    return { label: `+${lv * 10}% SCRAP`, numericValue: Number((1 + lv * 0.10).toFixed(2)) };
}

export const CAMPAIGN_TUNING = {
    totalStages: 10,
    wavesPerStage: 5,
    totalNormalWaves: 50,
    normalWaveDurationSec: 60,
    bossCleanupBlinkSec: 0.55,
    checkpointWaves: [1, 6, 11, 16, 21, 26, 31, 36, 41, 46] as readonly number[],
    checkpointStarterBonusPctPerTier: 0,
    checkpointStarterTempCards: 0,
} as const;

export function getStageForWave(wave: number): number {
    const safe = Math.max(1, Math.floor(wave || 1));
    return Math.max(1, Math.min(CAMPAIGN_TUNING.totalStages, Math.floor((safe - 1) / CAMPAIGN_TUNING.wavesPerStage) + 1));
}

export function getWaveInStage(wave: number): number {
    const safe = Math.max(1, Math.floor(wave || 1));
    return ((safe - 1) % CAMPAIGN_TUNING.wavesPerStage) + 1;
}

export function isBossTriggerWave(wave: number): boolean {
    const safe = Math.max(1, Math.floor(wave || 1));
    return safe >= CAMPAIGN_TUNING.wavesPerStage && safe % CAMPAIGN_TUNING.wavesPerStage === 0;
}

export function getBossNumberForStage(stage: number): number {
    return Math.max(1, Math.min(CAMPAIGN_TUNING.totalStages, Math.floor(stage || 1)));
}

export function getBossEncounterIdForStage(stage: number): string {
    return `boss_${String(getBossNumberForStage(stage)).padStart(2, '0')}`;
}

export function resolveCheckpointWave(progress: Pick<CampaignProgress, 'lastDefeatedBossNumber'> | undefined | null): number {
    const lastDefeated = Math.max(0, Math.min(CAMPAIGN_TUNING.totalStages - 1, Math.floor(progress?.lastDefeatedBossNumber ?? 0)));
    return lastDefeated * CAMPAIGN_TUNING.wavesPerStage + 1;
}

export const ACHIEVEMENT_GOALS = {
    exterminador: [200, 1000, 3500, 10000, 25000],
    sobrevivente: [5, 10, 20, 35, 50],
    cacatanques: [15, 60, 180, 450, 1000],
    arsenal: [10, 16, 22, 28, 35]
};

export const RANKS = [
    { m: 0, min: 0, name: 'Recruta de Ferro', nameEn: 'Iron Recruit', lvl: 0, pct: 0 },
    { m: 3, min: 3, name: 'Soldado de Cromo', nameEn: 'Chrome Soldier', lvl: 1, pct: 8 },
    { m: 7, min: 7, name: 'Sargento de Aço', nameEn: 'Steel Sergeant', lvl: 2, pct: 16 },
    { m: 12, min: 12, name: 'Comandante de Elite', nameEn: 'Elite Commander', lvl: 3, pct: 24 },
    { m: 17, min: 17, name: 'Lenda da Arena', nameEn: 'Arena Legend', lvl: 4, pct: 35 }
];

export const MAX_MEDALS = 20;
export const GOLDEN_MEDALS = 17;

export function getChassis(id: string): ChassisDef {
    return CHASSIS_DATA.find(c => c.id === id) || CHASSIS_DATA[0];
}

export type PlayerSpriteKey = string;

export function getPlayerSpriteKey(chassisId: string): PlayerSpriteKey {
    const robot = getRobotById(chassisId);
    return getRobotSpriteKeys(robot.id).right;
}

export function totalMedalsFromAch(ach: Record<string, number>): number {
    return Object.entries(ACHIEVEMENT_GOALS).reduce((s, [id, goals]) => {
        return s + Math.min(ach[id] || 0, goals.length);
    }, 0);
}

export function rankForMedals(medals: number) {
    let r = RANKS[0];
    for (const x of RANKS) {
        if (medals >= x.m) r = x;
    }
    return r;
}

export function labCost(u: LabUpgradeDef, currentLv: number): number {
    return Math.round(u.baseCost * Math.pow(u.growth, currentLv || 0));
}

export function computeFixedBonus(hangar: Pick<HangarState, 'ach' | 'chassis' | 'lab'>) {
    const medals = totalMedalsFromAch(hangar.ach || {});
    const r = rankForMedals(medals);
    const k = 1 + r.pct / 100;
    const ch = getChassis(hangar.chassis);
    const lab = hangar.lab || {};
    const hp = Math.round((100 + (lab.hull || 0) * 12) * k * ch.hpMult);
    const dmg = Number(((10 * (1 + (lab.weapon || 0) * 0.08)) * k * ch.dmgMult).toFixed(1));
    const spd = Math.round(248 * (1 + (lab.engine || 0) * 0.05) * k * ch.spdMult);
    const rate = 0.42 / (k * (1 + (lab.capacitor || 0) * 0.05));
    const mag = Math.round(290 * 0.40 + (lab.magnet || 0) * 5);
    const empCd = Math.max(4.2, 8 * Math.pow(0.94, lab.empCore || 0) * ch.empMult);
    const empRad = 225 + (lab.empCore || 0) * 16;
    const scrapMult = 1 + (lab.salvage || 0) * 0.10;
    return { pct: r.pct, lvl: r.lvl, hp, dmg, spd, rate, mag, empCd, empRad, scrapMult, ch };
}

export const REPAIR_CAPSULE_TUNING = {
    lifetimeSec: 12,
    droneRepairAmount: 2,
    droneMaxHpGainWhenFull: 1,
    attractSpeed: 540,
} as const;

export function applyRepairCapsulePickup(
    player: Pick<PlayerStats, 'hp' | 'maxHp' | 'tempMaxHpBonus'>,
    tuning: { droneRepairAmount: number; droneMaxHpGainWhenFull: number } = REPAIR_CAPSULE_TUNING
): { kind: 'healed' | 'temp_max_hp'; amount: number } {
    if (player.hp < player.maxHp) {
        const before = player.hp;
        player.hp = Math.min(player.maxHp, Number((player.hp + tuning.droneRepairAmount).toFixed(2)));
        return { kind: 'healed', amount: Number((player.hp - before).toFixed(2)) };
    }
    const gain = tuning.droneMaxHpGainWhenFull;
    player.maxHp = Number((player.maxHp + gain).toFixed(2));
    player.tempMaxHpBonus = Number(((player.tempMaxHpBonus || 0) + gain).toFixed(2));
    return { kind: 'temp_max_hp', amount: gain };
}

export function resetTempMaxHpAfterBoss(
    player: Pick<PlayerStats, 'hp' | 'maxHp' | 'tempMaxHpBonus'>
): number {
    const bonus = Math.max(0, Number(player.tempMaxHpBonus || 0));
    if (bonus > 0) {
        player.maxHp = Math.max(40, Number((player.maxHp - bonus).toFixed(2)));
        player.hp = Math.min(player.hp, player.maxHp);
        player.tempMaxHpBonus = 0;
    }
    return bonus;
}

export const SCAVENGER_TUNING = {
    unlockWave: 6,
    baseHp: 34,
    baseDmg: 8,
    moveSpeed: 132,
    stealStepScrap: 10,
    hpBonusPctPerStep: 0.02,
    maxHpBonusPct: 0.30,
    returnRatioOnDeath: 0.75,
    stealRadius: 24,
} as const;

export function computeScavengerBonusPct(stolenScrap: number): number {
    const steps = Math.floor(Math.max(0, stolenScrap) / SCAVENGER_TUNING.stealStepScrap);
    return Math.min(SCAVENGER_TUNING.maxHpBonusPct, steps * SCAVENGER_TUNING.hpBonusPctPerStep);
}

export function applyScavengerScrapSteal(
    enemy: { baseMaxHp?: number; maxHp: number; hp: number; stolenScrap?: number },
    amount: number
): { bonusPct: number; hpAdded: number } {
    const baseMax = enemy.baseMaxHp ?? enemy.maxHp;
    enemy.baseMaxHp = baseMax;
    const prevBonusPct = computeScavengerBonusPct(enemy.stolenScrap || 0);
    enemy.stolenScrap = Number(((enemy.stolenScrap || 0) + Math.max(0, amount)).toFixed(2));
    const nextBonusPct = computeScavengerBonusPct(enemy.stolenScrap);
    const prevMax = Number((baseMax * (1 + prevBonusPct)).toFixed(1));
    const nextMax = Number((baseMax * (1 + nextBonusPct)).toFixed(1));
    const hpAdded = Math.max(0, Number((nextMax - prevMax).toFixed(1)));
    enemy.maxHp = nextMax;
    enemy.hp = Number((enemy.hp + hpAdded).toFixed(1));
    return { bonusPct: nextBonusPct, hpAdded };
}

export function computeScavengerDeathScrap(baseScrap: number, stolenScrap: number): number {
    const returned = Math.max(0, stolenScrap) * SCAVENGER_TUNING.returnRatioOnDeath;
    return Number((Math.max(0, baseScrap) + returned).toFixed(2));
}

export interface EconomyTuning {
    enemyScrap: {
        drone: number;
        swarmDrone: number;
        gunner: number;
        tank: number;
        tankBounty: number;
        kamikaze: number;
        sniper: number;
        bastion: number;
        bastionBounty: number;
        artillery: number;
        scavenger: number;
        miniboss: number;
        boss: number;
    };
    waveBonusFn: (completedWave: number) => number;
    supplyScrap: number;
    relayScrapFn: (wave: number) => number;
    supplyPodScrapFn: (wave: number) => number;
    scrapRewardScale: number;
    stage1AssumedGroundPickupRate: number;
}

export const ECONOMY_TUNING: EconomyTuning = {
    enemyScrap: {
        drone: 0,
        swarmDrone: 0,
        gunner: 6,
        tank: 15,
        tankBounty: 24,
        kamikaze: 4,
        sniper: 5,
        bastion: 10,
        bastionBounty: 18,
        artillery: 8,
        scavenger: 2,
        miniboss: 18,
        boss: 35
    },
    waveBonusFn: (w: number) => (w <= 5 ? 0 : 4 + Math.min(8, Math.floor((w - 5) * 0.4))),
    supplyScrap: 0,
    relayScrapFn: (w: number) => (w <= 5 ? 0 : 4 + Math.min(6, Math.floor((w - 5) * 0.25))),
    supplyPodScrapFn: (w: number) => (w <= 5 ? 0 : 5 + Math.min(6, Math.floor((w - 5) * 0.25))),
    // Single Salvage multiplier via player.scrapMult (Extrator de Sucata).
    scrapRewardScale: 1.0,
    stage1AssumedGroundPickupRate: 0.663,
};

export function computeStage1PotentialScrap(): {
    gunnersTotal: number;
    tanksTotal: number;
    snipersTotal: number;
    dronesTotal: number;
    potentialScrap: number;
    expectedCollectedAt663: number;
    labLevel1Sum: number;
} {
    const gunnersTotal = SPAWN_DIRECTOR_CONFIG.stage1.ratesPerMin.gunner * CAMPAIGN_TUNING.wavesPerStage;
    const tanksTotal = SPAWN_DIRECTOR_CONFIG.stage1.ratesPerMin.tank * CAMPAIGN_TUNING.wavesPerStage;
    const snipersTotal = SPAWN_DIRECTOR_CONFIG.stage1.ratesPerMin.sniper * CAMPAIGN_TUNING.wavesPerStage;
    const dronesTotal = SPAWN_DIRECTOR_CONFIG.stage1.ratesPerMin.drone * CAMPAIGN_TUNING.wavesPerStage;
    const potentialScrap = Number((
        dronesTotal * ECONOMY_TUNING.enemyScrap.drone
        + gunnersTotal * ECONOMY_TUNING.enemyScrap.gunner
        + tanksTotal * ECONOMY_TUNING.enemyScrap.tank
        + snipersTotal * ECONOMY_TUNING.enemyScrap.sniper
    ).toFixed(2));
    const expectedCollectedAt663 = Number((potentialScrap * ECONOMY_TUNING.stage1AssumedGroundPickupRate).toFixed(2));
    const labLevel1Sum = LAB_UPGRADES.reduce((sum, u) => sum + labCost(u, 0), 0);
    return { gunnersTotal, tanksTotal, snipersTotal, dronesTotal, potentialScrap, expectedCollectedAt663, labLevel1Sum };
}

export const XP_CURVE = {
    initialMaxXp: 85,
    earlyGrowth: 1.10,
    lateGrowth: 1.12,
    earlyFlat: 18,
    lateFlat: 42,
    lateThresholdLv: 8,
    overflowCapRatio: 1.0,
    waveXpScale: 0.045,
    allowMultiLevel: true
};

export function nextMaxXp(currentMaxXp: number, newLv: number, curve = XP_CURVE): number {
    const late = newLv >= curve.lateThresholdLv;
    const mult = late ? curve.lateGrowth : curve.earlyGrowth;
    const flat = late ? curve.lateFlat : curve.earlyFlat;
    return Math.round(currentMaxXp * mult + flat);
}

export function applyXpGain(
    player: Pick<PlayerStats, 'xp' | 'maxXp' | 'lv'>,
    xpGain: number,
    curve = XP_CURVE
): number {
    player.xp += xpGain;
    let levelsGained = 0;
    if (curve.allowMultiLevel) {
        while (player.xp >= player.maxXp) {
            const overflow = player.xp - player.maxXp;
            player.lv++;
            player.maxXp = nextMaxXp(player.maxXp, player.lv, curve);
            player.xp = curve.overflowCapRatio >= 1
                ? overflow
                : Math.min(overflow, Math.floor(player.maxXp * curve.overflowCapRatio));
            levelsGained++;
        }
    } else if (player.xp >= player.maxXp) {
        const overflow = player.xp - player.maxXp;
        player.lv++;
        player.maxXp = nextMaxXp(player.maxXp, player.lv, curve);
        player.xp = curve.overflowCapRatio >= 1
            ? overflow
            : Math.min(overflow, Math.floor(player.maxXp * curve.overflowCapRatio));
        levelsGained = 1;
    }
    return levelsGained;
}

export const STAGE_CARD_CONFIG = {
    choicesPerPick: 3,
    targetPoolSizeStage2Plus: 15,
    potencyScalePerStage: 0,
    resetScope: 'after_boss_victory' as const,
} as const;

export function getStageCardPotencyMult(stage: number): number {
    const s = Math.max(1, Math.floor(stage || 1));
    return Number((1 + (s - 1) * STAGE_CARD_CONFIG.potencyScalePerStage).toFixed(3));
}

export const XP_REWARDS = {
    commonDrone: 3,
    swarmDrone: 3,
    gunner: 10,
    kamikaze: 10,
    sniper: 12,
    scavenger: 10,
    tank: 24,
    bastion: 22,
    artillery: 18,
    miniboss: 65,
    boss: 95,
    relayCrystal: 8,
    supplyPodCrystal: 8
} as const;

export const ENEMY_BASE_HP = {
    drone: 10,
    gunner: 36,
    kamikaze: 21,
    sniper: 36,
    scavenger: SCAVENGER_TUNING.baseHp,
    tank: 125,
    bastion: 68,
    artillery: 42,
    miniboss: 115
} as const;

export const ENEMY_BASE_DAMAGE = {
    drone: 7,
    scavenger: SCAVENGER_TUNING.baseDmg,
    gunner: 9,
    artillery: 10,
    bastion: 12,
    sniper: 14,
    miniboss: 14,
    kamikaze: 22,
    tank: 22
} as const;

export const ENEMY_DISPLAY_NAMES = {
    kamikaze: { pt: 'Kamikaze', en: 'Kamikaze' },
    bastion: { pt: 'Bastion', en: 'Bastion' },
    artillery: { pt: 'Arpoador', en: 'Harpooner' },
    scavenger: { pt: 'Catador', en: 'Scavenger' },
    miniboss: { pt: 'MiniBoss', en: 'MiniBoss' },
} as const;

export const PLAYER_BASE_HEIGHT = 56;
export const PLAYER_VISUAL_HEIGHT = Math.round(PLAYER_BASE_HEIGHT * 1.35);
export const MIN_PLAYER_SHOT_RANGE = Math.round(290 * 0.78);
export const KAMIKAZE_EXPLOSION_RADIUS = Math.round(290 * 0.5);

/** Kamikaze explosion damage radius is 50% of the player's current attack radius. */
export function getKamikazeExplosionRadius(playerRange: number): number {
    return Math.round(Math.max(MIN_PLAYER_SHOT_RANGE, playerRange) * 0.50);
}

/** Kamikaze starts its charge prep outside the player's current attack radius (+10%). */
export function getKamikazeChargeRange(playerRange: number): number {
    return Math.round(Math.max(MIN_PLAYER_SHOT_RANGE, playerRange) * 1.10);
}

export const BOSS_HP_MULTIPLIER = 1.50;
export const BOSS_SPRITE_DRAW_HEIGHT = 128;
export const BOSS_REINFORCEMENT_REGEN_PER_SEC = 1;

export const BOSS_VARIANT_IDS = ['titan', 'phantom', 'siege', 'overlord'] as const;

export interface BossEncounterRuntimeConfig {
    bossId: string;
    number: number;
    stage: number;
    variant: typeof BOSS_VARIANT_IDS[number];
    baseHp: number;
    baseDmg: number;
    baseSpd: number;
    regenPerSecWithReinforcements: number;
    reinforcements: {
        enabled: boolean;
        triggerHpRatios: readonly number[];
        count: number;
        enemyType: 'drone' | 'gunner' | 'sniper' | 'scavenger';
        pendingDefinitionNote: string;
    };
}

export const BOSS_ENCOUNTER_CONFIGS: readonly BossEncounterRuntimeConfig[] = Array.from(
    { length: CAMPAIGN_TUNING.totalStages },
    (_, idx): BossEncounterRuntimeConfig => {
        const number = idx + 1;
        const variant = BOSS_VARIANT_IDS[idx % BOSS_VARIANT_IDS.length];
        const baseSpd = variant === 'phantom' ? 78 : variant === 'siege' ? 54 : variant === 'overlord' ? 60 : 62;
        return {
            bossId: `boss_${String(number).padStart(2, '0')}`,
            number,
            stage: number,
            variant,
            baseHp: Math.round(340 * (1 + idx * 0.45) * BOSS_HP_MULTIPLIER),
            baseDmg: Math.round(21 * (1 + idx * 0.14)),
            baseSpd: baseSpd + idx * 2,
            regenPerSecWithReinforcements: BOSS_REINFORCEMENT_REGEN_PER_SEC,
            reinforcements: {
                enabled: false,
                triggerHpRatios: [],
                count: 0,
                enemyType: 'drone',
                pendingDefinitionNote: 'Reforços e habilidades específicas do chefão — A definir'
            }
        };
    }
);

export function getBossEncounterConfigByStage(stage: number): BossEncounterRuntimeConfig {
    const idx = Math.max(0, Math.min(BOSS_ENCOUNTER_CONFIGS.length - 1, Math.floor(stage || 1) - 1));
    return BOSS_ENCOUNTER_CONFIGS[idx];
}

/** Real Bosses use the 4 large Boss portraits; special units use their dedicated assets. */
export function getEnemySpriteKey(enemyType: string, bossVariant?: string): string | null {
    if (enemyType === 'boss') {
        const variant = BOSS_VARIANT_IDS.includes(bossVariant as typeof BOSS_VARIANT_IDS[number])
            ? bossVariant
            : 'titan';
        return `boss_${variant}`;
    }
    return ['drone', 'gunner', 'sniper', 'kamikaze', 'bastion', 'artillery', 'miniboss'].includes(enemyType)
        ? enemyType
        : null;
}

export const ENEMY_VISUAL_HEIGHTS = {
    drone: 34,
    gunner: 50,
    sniper: 50,
    scavenger: 46,
    kamikaze: Math.round(46 * 1.75),
    artillery: Math.round(PLAYER_BASE_HEIGHT * 1.30),
    bastion: Math.round(PLAYER_BASE_HEIGHT * 1.50),
    tank: Math.round(Math.round(PLAYER_BASE_HEIGHT * 1.42) * 1.40),
    miniboss: Math.round(PLAYER_BASE_HEIGHT * 1.50)
} as const;

/** Native Canvas silhouette fallback heights before world-space scaling. */
export const ENEMY_NATIVE_DRAW_HEIGHTS = {
    kamikaze: 42,
    bastion: 46,
    artillery: 44,
    scavenger: 40,
    miniboss: 62
} as const;

export function getEnemyVisualScale(enemyType: string): number {
    const nativeHeight = ENEMY_NATIVE_DRAW_HEIGHTS[enemyType as keyof typeof ENEMY_NATIVE_DRAW_HEIGHTS];
    const targetHeight = ENEMY_VISUAL_HEIGHTS[enemyType as keyof typeof ENEMY_VISUAL_HEIGHTS];
    if (!nativeHeight || !targetHeight) return 1;
    return targetHeight / nativeHeight;
}

export const CAMERA_TUNING = {
    desktopZoom: 0.92,
    tabletZoom: 0.84,
    mobileZoom: 0.74,
    playerVisualScale: Number((1.12 * 1.35).toFixed(3)),
    playerProjectileScale: 1.12,
    enemyProjectileScale: 1.38
} as const;

export function getCameraZoomForViewport(width: number, height: number): number {
    const minDim = Math.min(Math.max(1, width), Math.max(1, height));
    if (minDim < 520) return CAMERA_TUNING.mobileZoom;
    if (minDim < 900) return CAMERA_TUNING.tabletZoom;
    return CAMERA_TUNING.desktopZoom;
}

export function createSeededRng(seed: number): () => number {
    let s = (Math.floor(seed) >>> 0) || 1;
    return () => {
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        return (s >>> 0) / 4294967296;
    };
}

export interface SpawnDirectorOverrides {
    maxSimultaneousDrones?: number;
    threatBudgetBase?: number;
    maxConcurrentRanged?: number;
    maxConcurrentTanks?: number;
    gunnerBurstSize?: number;
}

export const SPAWN_DIRECTOR_CONFIG = {
    stage1: {
        ratesPerMin: {
            drone: 24,
            gunner: 9,
            tank: 2,
            sniper: 6,
        },
        maxSimultaneousDrones: 10,
        gunnerBurstSize: 3,
        gunnerGroupIntervalMeanSec: 20,
        gunnerGroupJitterSec: 2.5,
        gunnerBurstStaggerSec: 0.55,
        tankIntervalMinSec: 22,
        tankIntervalMaxSec: 38,
        tankMinGapSec: 18,
        sniperIntervalMinSec: 7.5,
        sniperIntervalMaxSec: 12.5,
        maxConcurrentRanged: 6,
        maxConcurrentTanks: 2,
    },
    threatWeights: {
        drone: 1,
        scavenger: 2,
        gunner: 3,
        kamikaze: 3,
        sniper: 3.5,
        artillery: 4.5,
        bastion: 5.5,
        tank: 7,
        miniboss: 10,
        boss: 25,
    } as Record<string, number>,
    threatBudgetBase: 30,
    threatBudgetPerWave: 1.8,
    minHeavyReleaseGapSec: 1.8,
    stageUnlocks: {
        drone: 1,
        gunner: 1,
        tank: 1,
        sniper: 1,
        kamikaze: 6,
        scavenger: SCAVENGER_TUNING.unlockWave,
        bastion: 11,
        artillery: 16,
    } as Record<string, number>,
    // Centralized scaling per wave after Stage 1 (waves 6..50)
    laterStageCadenceGrowthPerStage: 0.14,
} as const;

export interface LiveArenaEnemySummary {
    t: string;
    del?: boolean;
}

export interface ThreatAssessment {
    liveCount: number;
    aliveDrones: number;
    aliveRanged: number;
    aliveTanks: number;
    aliveHeavies: number;
    rawWeight: number;
    rangedPressure: number;
    heavyPressure: number;
    lowHpPressure: number;
    totalThreat: number;
    threatBudget: number;
    overloaded: boolean;
}

export function evaluateArenaThreat(
    enemies: readonly LiveArenaEnemySummary[],
    wave: number,
    playerHpRatio: number,
    overrides: SpawnDirectorOverrides = {}
): ThreatAssessment {
    const safeWave = Math.max(1, Math.floor(wave || 1));
    let liveCount = 0;
    let aliveDrones = 0;
    let aliveRanged = 0;
    let aliveTanks = 0;
    let aliveHeavies = 0;
    let rawWeight = 0;

    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (e.del) continue;
        liveCount++;
        const weight = SPAWN_DIRECTOR_CONFIG.threatWeights[e.t] ?? 2;
        rawWeight += weight;
        if (e.t === 'drone') aliveDrones++;
        if (e.t === 'gunner' || e.t === 'sniper' || e.t === 'artillery') aliveRanged++;
        if (e.t === 'tank') aliveTanks++;
        if (e.t === 'tank' || e.t === 'bastion' || e.t === 'miniboss') aliveHeavies++;
    }

    const rangedPressure = aliveRanged * 0.7;
    const heavyPressure = aliveHeavies * 1.4;
    const clampedRatio = Math.max(0, Math.min(1, Number.isFinite(playerHpRatio) ? playerHpRatio : 1));
    const lowHpPressure = clampedRatio < 0.45 ? Number(((0.45 - clampedRatio) * 10).toFixed(2)) : 0;
    const totalThreat = Number((rawWeight + rangedPressure + heavyPressure + lowHpPressure).toFixed(2));
    const budgetBase = overrides.threatBudgetBase ?? SPAWN_DIRECTOR_CONFIG.threatBudgetBase;
    const threatBudget = Number((budgetBase + (safeWave - 1) * SPAWN_DIRECTOR_CONFIG.threatBudgetPerWave).toFixed(2));

    return {
        liveCount,
        aliveDrones,
        aliveRanged,
        aliveTanks,
        aliveHeavies,
        rawWeight,
        rangedPressure,
        heavyPressure,
        lowHpPressure,
        totalThreat,
        threatBudget,
        overloaded: totalThreat >= threatBudget
    };
}

export interface AdaptiveSpawnDirectorState {
    seed: number;
    wave: number;
    droneTimer: number;
    gunnerBurstTimer: number;
    gunnerBurstQueued: number;
    gunnerStaggerTimer: number;
    tankTimer: number;
    timeSinceLastTank: number;
    sniperTimer: number;
    kamikazeTimer: number;
    scavengerTimer: number;
    bastionTimer: number;
    artilleryTimer: number;
    releaseCooldown: number;
    stats: {
        spawnedByType: Record<string, number>;
        droppedDrones: number;
        delayedDangerousSpawns: number;
    };
}

export function createAdaptiveSpawnDirector(seed: number, initialWave = 1): AdaptiveSpawnDirectorState {
    const rng = createSeededRng(seed + Math.floor(initialWave) * 97);
    const s1 = SPAWN_DIRECTOR_CONFIG.stage1;
    const tankSpan = s1.tankIntervalMaxSec - s1.tankIntervalMinSec;
    const sniperSpan = s1.sniperIntervalMaxSec - s1.sniperIntervalMinSec;
    return {
        seed: (Math.floor(seed) >>> 0) || 1,
        wave: Math.max(1, Math.floor(initialWave)),
        droneTimer: 2.1, // first drone arrives shortly after start (~0.4s)
        // 3 gunner bursts per 60s (~every 20s): first burst ~7-11s in
        gunnerBurstTimer: s1.gunnerGroupIntervalMeanSec - (8 + rng() * 3.5),
        gunnerBurstQueued: 0,
        gunnerStaggerTimer: 0,
        // variable tank interval around 30s, never back-to-back
        tankTimer: -(12 + rng() * 8) + (s1.tankIntervalMinSec + rng() * tankSpan),
        timeSinceLastTank: 999,
        sniperTimer: s1.sniperIntervalMinSec + rng() * sniperSpan - (2 + rng() * 2),
        kamikazeTimer: 0,
        scavengerTimer: 0,
        bastionTimer: 0,
        artilleryTimer: 0,
        releaseCooldown: 0,
        stats: {
            spawnedByType: {},
            droppedDrones: 0,
            delayedDangerousSpawns: 0,
        }
    };
}

export function stepAdaptiveSpawnDirector(params: {
    director: AdaptiveSpawnDirectorState;
    dt: number;
    wave: number;
    enemies: readonly LiveArenaEnemySummary[];
    playerHpRatio: number;
    rng: () => number;
    enabled?: boolean;
    overrides?: SpawnDirectorOverrides;
}): {
    spawns: string[];
    threat: ThreatAssessment;
} {
    const { director, dt, enemies, playerHpRatio, rng, enabled = true, overrides = {} } = params;
    const wave = Math.max(1, Math.floor(params.wave || 1));
    director.wave = wave;
    const threat = evaluateArenaThreat(enemies, wave, playerHpRatio, overrides);
    if (!enabled || dt <= 0) {
        return { spawns: [], threat };
    }

    const s1 = SPAWN_DIRECTOR_CONFIG.stage1;
    const stage = getStageForWave(wave);
    const paceMult = stage <= 1
        ? 1
        : 1 + (stage - 1) * SPAWN_DIRECTOR_CONFIG.laterStageCadenceGrowthPerStage;
    const maxDrones = overrides.maxSimultaneousDrones
        ?? (s1.maxSimultaneousDrones + Math.max(0, stage - 1) * 2);
    const maxRanged = overrides.maxConcurrentRanged
        ?? (s1.maxConcurrentRanged + Math.max(0, stage - 1) * 1);
    const maxTanks = overrides.maxConcurrentTanks
        ?? (s1.maxConcurrentTanks + Math.max(0, Math.floor((stage - 1) / 2)));

    const spawns: string[] = [];
    const caps = getWaveCaps(wave);
    let projectedLive = threat.liveCount;
    let projectedDrones = threat.aliveDrones;
    let projectedRanged = threat.aliveRanged;
    let projectedTanks = threat.aliveTanks;
    let projectedThreat = threat.totalThreat;

    const recordSpawn = (type: string) => {
        spawns.push(type);
        projectedLive++;
        projectedThreat += SPAWN_DIRECTOR_CONFIG.threatWeights[type] ?? 2;
        if (type === 'drone') projectedDrones++;
        if (type === 'gunner' || type === 'sniper' || type === 'artillery') projectedRanged++;
        if (type === 'tank') projectedTanks++;
        director.stats.spawnedByType[type] = (director.stats.spawnedByType[type] || 0) + 1;
    };

    if (director.releaseCooldown > 0) {
        director.releaseCooldown = Math.max(0, director.releaseCooldown - dt);
    }
    director.timeSinceLastTank += dt;

    // 1. Drones: steady flow capped by maxSimultaneousDrones; drop excess cleanly (no backlog)
    const droneInterval = 60 / (s1.ratesPerMin.drone * (stage <= 1 ? 1 : Math.min(2.0, paceMult)));
    director.droneTimer += dt;
    if (director.droneTimer >= droneInterval) {
        director.droneTimer -= droneInterval;
        if (projectedDrones < maxDrones && projectedLive < caps.maxEnemies) {
            recordSpawn('drone');
        } else {
            director.stats.droppedDrones++;
        }
    }

    const canAcceptDangerousSpawn = (type: string): boolean => {
        if (projectedLive >= caps.maxEnemies) return false;
        if (projectedThreat >= threat.threatBudget) return false;
        if ((type === 'gunner' || type === 'sniper' || type === 'artillery') && projectedRanged >= maxRanged) return false;
        if (type === 'tank') {
            if (projectedTanks >= maxTanks) return false;
            if (director.timeSinceLastTank < s1.tankMinGapSec) return false;
        }
        return true;
    };

    // 2. Gunners: groups of 3 ~every 20s with random jitter (~9/min in Stage 1)
    const gunnerGroupInterval = s1.gunnerGroupIntervalMeanSec / (stage <= 1 ? 1 : Math.min(1.6, paceMult));
    const burstSize = overrides.gunnerBurstSize ?? s1.gunnerBurstSize;
    director.gunnerBurstTimer += dt;
    if (director.gunnerBurstTimer >= gunnerGroupInterval) {
        const jitter = (rng() * 2 - 1) * s1.gunnerGroupJitterSec;
        director.gunnerBurstTimer = jitter;
        // Avoid accumulating unbounded bursts if delayed
        if (director.gunnerBurstQueued < burstSize) {
            director.gunnerBurstQueued += burstSize;
        }
    }
    if (director.gunnerBurstQueued > 0) {
        director.gunnerStaggerTimer -= dt;
        if (director.gunnerStaggerTimer <= 0) {
            if (canAcceptDangerousSpawn('gunner')) {
                recordSpawn('gunner');
                director.gunnerBurstQueued--;
                director.gunnerStaggerTimer = s1.gunnerBurstStaggerSec;
            } else {
                director.stats.delayedDangerousSpawns++;
                director.gunnerStaggerTimer = 0.9;
            }
        }
    }

    // 3. Tanks: variable ~30s interval (~2/min in Stage 1), never back-to-back
    const tankInterval = (s1.tankIntervalMinSec + rng() * (s1.tankIntervalMaxSec - s1.tankIntervalMinSec))
        / (stage <= 1 ? 1 : Math.min(1.6, paceMult));
    director.tankTimer += dt;
    if (director.tankTimer >= 0) {
        if (canAcceptDangerousSpawn('tank') && director.releaseCooldown <= 0) {
            recordSpawn('tank');
            director.timeSinceLastTank = 0;
            director.tankTimer = -tankInterval;
            director.releaseCooldown = 1.2;
        } else {
            director.stats.delayedDangerousSpawns++;
            // Hold slightly so pressure relieves instead of stacking
            director.tankTimer = -0.8;
        }
    }

    // 4. Snipers: variable ~10s interval (~6/min in Stage 1)
    const sniperInterval = (s1.sniperIntervalMinSec + rng() * (s1.sniperIntervalMaxSec - s1.sniperIntervalMinSec))
        / (stage <= 1 ? 1 : Math.min(1.65, paceMult));
    director.sniperTimer += dt;
    if (director.sniperTimer >= 0) {
        if (canAcceptDangerousSpawn('sniper')) {
            recordSpawn('sniper');
            director.sniperTimer = -sniperInterval;
        } else {
            director.stats.delayedDangerousSpawns++;
            director.sniperTimer = -0.9;
        }
    }

    // 5. Stage 2+ centralized unlocks (Kamikaze, Scavenger, Bastion, Artillery)
    if (wave >= SPAWN_DIRECTOR_CONFIG.stageUnlocks.kamikaze) {
        director.kamikazeTimer += dt;
        const kamiCd = Math.max(5.5, 11.5 - (stage - 2) * 0.7);
        if (director.kamikazeTimer >= kamiCd) {
            if (canAcceptDangerousSpawn('kamikaze')) {
                recordSpawn('kamikaze');
                director.kamikazeTimer = 0;
            } else {
                director.stats.delayedDangerousSpawns++;
                director.kamikazeTimer = kamiCd - 1.0;
            }
        }
    }

    if (wave >= SPAWN_DIRECTOR_CONFIG.stageUnlocks.scavenger) {
        director.scavengerTimer += dt;
        const scavCd = Math.max(8.5, 15 - (stage - 2) * 0.7);
        if (director.scavengerTimer >= scavCd) {
            if (projectedLive < caps.maxEnemies && projectedThreat < threat.threatBudget) {
                recordSpawn('scavenger');
                director.scavengerTimer = 0;
            } else {
                director.scavengerTimer = scavCd - 1.0;
            }
        }
    }

    if (wave >= SPAWN_DIRECTOR_CONFIG.stageUnlocks.bastion) {
        director.bastionTimer += dt;
        const bastionCd = Math.max(10, 18 - (stage - 3) * 0.8);
        if (director.bastionTimer >= bastionCd) {
            if (canAcceptDangerousSpawn('bastion') && director.releaseCooldown <= 0) {
                recordSpawn('bastion');
                director.bastionTimer = 0;
                director.releaseCooldown = 1.4;
            } else {
                director.stats.delayedDangerousSpawns++;
                director.bastionTimer = bastionCd - 1.2;
            }
        }
    }

    if (wave >= SPAWN_DIRECTOR_CONFIG.stageUnlocks.artillery) {
        director.artilleryTimer += dt;
        const artCd = Math.max(10, 17 - (stage - 4) * 0.7);
        if (director.artilleryTimer >= artCd) {
            if (canAcceptDangerousSpawn('artillery')) {
                recordSpawn('artillery');
                director.artilleryTimer = 0;
            } else {
                director.stats.delayedDangerousSpawns++;
                director.artilleryTimer = artCd - 1.2;
            }
        }
    }

    return { spawns, threat };
}

export function getWaveCaps(w: number) {
    const wave = Math.max(1, Math.floor(w));
    const stage = getStageForWave(wave);
    // Stage 1 waves 1..5 scale gently (+5%/wave) against baseline 10/36/125/36 HP;
    // subsequent stages ramp smoothly up to wave 50.
    const hpMult = 1
        + (wave - 1) * 0.05
        + Math.max(0, wave - 5) * 0.08
        + Math.max(0, wave - 15) * 0.14
        + Math.max(0, wave - 30) * 0.18;
    const dmgMult = 1
        + (wave - 1) * 0.04
        + Math.max(0, wave - 10) * 0.04
        + Math.max(0, wave - 25) * 0.04;
    const maxEnemies = Math.min(36, Math.round(18 + (wave - 1) * 0.4));
    const u = SPAWN_DIRECTOR_CONFIG.stageUnlocks;
    return {
        maxEnemies,
        maxDrones: SPAWN_DIRECTOR_CONFIG.stage1.maxSimultaneousDrones + Math.max(0, stage - 1) * 2,
        maxGunners: wave < u.gunner ? 0 : Math.min(8, 3 + Math.floor((stage - 1) * 0.7)),
        maxTanks: wave < u.tank ? 0 : Math.min(5, 2 + Math.floor((stage - 1) / 3)),
        maxKamikazes: wave < u.kamikaze ? 0 : Math.min(5, 1 + Math.floor((wave - u.kamikaze) / 4)),
        maxSnipers: wave < u.sniper ? 0 : Math.min(5, 2 + Math.floor((stage - 1) / 2)),
        maxScavengers: wave < u.scavenger ? 0 : Math.min(3, 1 + Math.floor((stage - 2) / 3)),
        maxBastions: wave < u.bastion ? 0 : Math.min(4, 1 + Math.floor((wave - u.bastion) / 5)),
        maxArtillery: wave < u.artillery ? 0 : Math.min(4, 1 + Math.floor((wave - u.artillery) / 5)),
        gunnerIntervalSec: 20,
        tankIntervalSec: 30,
        kamikazeIntervalSec: 11.5,
        sniperIntervalSec: 10,
        bastionIntervalSec: 16,
        artilleryIntervalSec: 16,
        dronesPerSec: 0.4 + Math.max(0, stage - 1) * 0.06,
        hpMult,
        dmgMult
    };
}

export function getStarterPicksCount(_startWave: number): number {
    // Checkpoints always begin cleanly with Lab progression only and 0 temp cards.
    return CAMPAIGN_TUNING.checkpointStarterTempCards;
}

export type ArenaEventId = 'relay' | 'supply_pod' | 'orbital_sweep' | 'ally_turret' | 'bounty' | 'swarm' | 'ion_storm' | 'miniboss' | 'bombardment' | 'invasion';

export function getWaveEventPool(w: number): ArenaEventId[] {
    const wave = Math.max(1, Math.floor(w));
    const pool: ArenaEventId[] = ['relay', 'supply_pod'];
    if (wave >= 6) pool.push('ally_turret');
    if (wave >= 8) pool.push('orbital_sweep');
    if (wave >= 9) pool.push('bounty');
    if (wave >= 10) pool.push('swarm');
    if (wave >= 11) pool.push('ion_storm');
    if (wave >= 12) pool.push('miniboss');
    if (wave >= 13) pool.push('bombardment');
    if (wave >= 15) pool.push('invasion');
    return pool;
}

export const CARDS: CardDef[] = [
    // WEAPONS (max 4 slots)
    { id: 'TIRO EM LEQUE', cat: 'weapon', icon: '🔱', maxLv: 2, pt: ['TIRO EM LEQUE', '+2 projéteis em leque'], en: ['SPREAD SHOT', '+2 spread shots'],
      fn: (p) => { p.spreadLv = Math.min(2, p.spreadLv + 1); } },
    { id: 'ESCUDO ORBITAL', cat: 'weapon', icon: '🌀', maxLv: 3, pt: ['ESCUDO ORBITAL', '+1 esfera giratória defensiva'], en: ['ORBITAL SHIELD', '+1 defensive orbiting sphere'],
      fn: (p) => { p.orbits = Math.min(3, p.orbits + 1); } },
    { id: 'RAIO EM CADEIA', cat: 'weapon', icon: '⚡', maxLv: 3, pt: ['RAIO EM CADEIA', 'Arcos elétricos saltam no disparo principal'], en: ['CHAIN LIGHTNING', 'Primary shots arc between foes'],
      fn: (p) => { p.chain = Math.min(3, p.chain + 1); } },
    { id: 'MÍSSEIS TELEGUIADOS', cat: 'weapon', icon: '🚀', maxLv: 3, pt: ['MÍSSEIS TELEGUIADOS', 'Dispara foguetes teleguiados'], en: ['HOMING MISSILES', 'Fires seeking micro-missiles'],
      fn: (p) => { p.missiles = Math.min(3, p.missiles + 1); } },
    { id: 'MINI-DRONE ALIADO', cat: 'weapon', icon: '🛸', maxLv: 3, pt: ['MINI-DRONE ALIADO', 'Drone companheiro dá suporte próximo'], en: ['WINGMAN DRONE', 'Allied drone gives close fire support'],
      fn: (p) => { p.wingmen = Math.min(3, p.wingmen + 1); } },
    { id: 'MINAS DE PROXIMIDADE', cat: 'weapon', icon: '💣', maxLv: 3, pt: ['MINAS DE PROXIMIDADE', 'Solta minas explosivas ao correr'], en: ['PROXIMITY MINES', 'Drops explosive mines while moving'],
      fn: (p) => { p.mineLv = Math.min(3, p.mineLv + 1); } },
    { id: 'LANÇA-LASER', cat: 'weapon', icon: '🔦', maxLv: 3, pt: ['LANÇA-LASER', 'Feixe perfurante periódico de alta energia'], en: ['LASER LANCE', 'Periodic piercing energy beam'],
      fn: (p) => { p.laserLv = Math.min(3, p.laserLv + 1); } },

    // RECOVERY (no passive slot consumed; guaranteed in critical condition)
    { id: 'REPARO', cat: 'passive', noSlot: true, icon: '➕', pt: ['REPARO DE EMERGÊNCIA', 'Recupera 30% do HP máximo'], en: ['EMERGENCY REPAIR', 'Restores 30% of maximum HP'],
      fn: (p) => { p.hp = Math.min(p.maxHp, p.hp + Math.max(24, Math.round(p.maxHp * 0.30))); } },

    // PASSIVES (max 4 slots)
    { id: 'ARMA PESADA', cat: 'passive', icon: '💥', maxLv: 5, rarityScalable: true, pt: ['ARMA PESADA', '+10% de dano'], en: ['HEAVY WEAPON', '+10% damage'],
      fn: (p, m) => { p.dmg *= (1 + 0.10 * m); } },
    { id: 'CADÊNCIA', cat: 'passive', icon: '🔥', maxLv: 5, rarityScalable: true, pt: ['CADÊNCIA', '+12% velocidade de disparo'], en: ['FIRE RATE', '+12% fire rate'],
      fn: (p, m) => { p.baseRate = Math.max(0.16, p.baseRate / (1 + 0.12 * m)); } },
    { id: 'VELOCIDADE', cat: 'passive', icon: '💨', maxLv: 4, rarityScalable: true, pt: ['VELOCIDADE', '+9% velocidade de movimento'], en: ['THRUSTERS', '+9% move speed'],
      fn: (p, m) => { p.spd *= (1 + 0.09 * m); } },
    { id: 'HP MÁXIMO', cat: 'passive', icon: '🛡️', maxLv: 4, rarityScalable: true, pt: ['HP MÁXIMO', '+20% HP máximo'], en: ['MAX HP', '+20% max HP'],
      fn: (p, m) => { const add = Math.round(p.maxHp * 0.20 * m); p.maxHp += add; p.hp = Math.min(p.maxHp, p.hp + Math.round(add * 0.45)); } },
    { id: 'TIRO PERFURANTE', cat: 'passive', icon: '🏹', maxLv: 2, pt: ['TIRO PERFURANTE', '+1 inimigo atravessado'], en: ['PIERCING SHOT', '+1 enemy pierced'],
      fn: (p) => { p.pierce = Math.min(2, p.pierce + 1); } },
    { id: 'CAPACITOR EMP', cat: 'passive', icon: '🔋', maxLv: 3, pt: ['CAPACITOR EMP', '-12% recarga EMP e +18% raio'], en: ['EMP CAPACITOR', '-12% EMP CD & +18% radius'],
      fn: (p) => { p.empCd *= 0.88; p.empRad = Math.round(p.empRad * 1.18); } },
    { id: 'MIRAS CRÍTICAS', cat: 'passive', icon: '🎯', maxLv: 3, pt: ['MIRAS CRÍTICAS', '+8% chance crítica e +20% dano crít.'], en: ['CRITICAL OPTICS', '+8% crit chance & +20% crit dmg'],
      fn: (p) => { p.critChance = Math.min(0.50, p.critChance + 0.08); p.critMult += 0.20; } },
    { id: 'BLINDAGEM REATIVA', cat: 'passive', icon: '🧱', maxLv: 3, pt: ['COLETE À PROVA DE BALAS', '-10% de dano recebido por nível (máx. 30%)'], en: ['BULLETPROOF VEST', '-10% incoming damage per level (30% max)'],
      fn: (p) => { p.armor = Math.min(COMBAT_TUNING.armorCap, p.armor + 0.10); p.reactiveLv = Math.min(3, (p.reactiveLv || 0) + 1); } },
    { id: 'NANO-REGENERAÇÃO', cat: 'passive', icon: '🧬', maxLv: 3, pt: ['NANO-REGENERAÇÃO', '+0.50 HP/s contínuo'], en: ['NANO-REGEN', '+0.50 HP/s regeneration'],
      fn: (p) => { p.regen += 0.50; } },
    { id: 'CATALISADOR DE XP', cat: 'passive', icon: '💎', maxLv: 3, pt: ['CATALISADOR DE XP', '+10% XP e +12% Sucata'], en: ['XP CATALYST', '+10% XP & +12% Scrap'],
      fn: (p) => { p.xpMult += 0.10; p.scrapMult += 0.12; } },

    // TACTICAL TRADE-OFFS
    { id: 'CANHÃO DE VIDRO', cat: 'tactical', icon: '☢️', maxLv: 1, pt: ['+ FORÇA + VULNERÁVEL', '+30% Dano · -18% HP Máx'], en: ['+ POWER + VULNERABLE', '+30% Damage · -18% Max HP'],
      fn: (p) => { p.dmg *= 1.30; p.maxHp = Math.max(40, Math.round(p.maxHp * 0.82)); p.hp = Math.min(p.hp, p.maxHp); } },
    { id: 'FRENESI CURTO', cat: 'tactical', icon: '🔥', maxLv: 1, pt: ['TROCA: MENOR ALCANCE POR + TIROS POR SEGUNDO', '+24% tiros por segundo · -22% alcance. Atira mais rápido, mas exige chegar mais perto.'], en: ['TRADE-OFF: LESS RANGE FOR MORE SHOTS/SEC', '+24% shots per second · -22% range. Fires faster, but requires closer positioning.'],
      fn: (p) => { p.baseRate = Math.max(0.14, p.baseRate / 1.24); p.range = Math.round(p.range * 0.78); } },
    { id: 'PROTOCOLO SUCATEIRO', cat: 'tactical', icon: '🧲', maxLv: 1, pt: ['PROTOCOLO SUCATEIRO', '+25% Sucata e +20% XP · Inimigos +18% rápidos'], en: ['SALVAGE PROTOCOL', '+25% Scrap & +20% XP · Foes +18% faster'],
      fn: (p) => { p.scrapMult += 0.25; p.xpMult += 0.20; p.enemySpdBonus += 0.18; } },
    { id: 'SOBRECARGA NÚCLEO', cat: 'tactical', icon: '⚡', maxLv: 1, pt: ['SOBRECARGA DE NÚCLEO', '+18% Velocidade e +12% Crítico · -12% HP'], en: ['CORE OVERDRIVE', '+18% Speed & +12% Crit · -12% HP'],
      fn: (p) => { p.spd *= 1.18; p.critChance = Math.min(0.55, p.critChance + 0.12); p.maxHp = Math.max(40, Math.round(p.maxHp * 0.88)); p.hp = Math.min(p.hp, p.maxHp); } }
];

export const FALLBACK_CARDS: CardDef[] = [
    { id: 'SURTO_EMP', cat: 'passive', noSlot: true, icon: '⚡', pt: ['SURTO DE SOBRECARGA', 'Sobrecarga 5s + recarrega EMP'], en: ['OVERCHARGE SURGE', '5s Overcharge + resets EMP'],
      fn: (_p, _m, ctx) => { ctx?.triggerOvercharge?.(5); ctx?.resetEmp?.(); } },
    { id: 'RESERVA_SUCATA', cat: 'passive', noSlot: true, icon: '⚙️', pt: ['CÉLULA DE SUCATA', '+4 Sucata ⚙ e +10 HP'], en: ['SCRAP CELL', '+4 Scrap ⚙ & +10 HP'],
      fn: (p, _m, ctx) => { ctx?.awardScrap?.(4, p.x, p.y, true); p.hp = Math.min(p.maxHp, p.hp + 10); } },
    { id: 'AJUSTE_FINO', cat: 'passive', noSlot: true, maxLv: 8, icon: '🔧', pt: ['CALIBRAÇÃO FINA', '+3% Dano e +2% Velocidade'], en: ['FINE TUNING', '+3% Damage & +2% Move Speed'],
      fn: (p) => { p.dmg *= 1.03; p.spd *= 1.02; } }
];

export const EVOLUTIONS: EvoDef[] = [
    { id: 'EVO_PLASMA_STORM', weapon: 'TIRO EM LEQUE', wMin: 2, passive: 'CADÊNCIA', pMin: 1, icon: '🌟',
      pt: ['TEMPESTADE DE PLASMA', 'Rajada neon ampliada (+1 feixe, +12% cadência)'], en: ['PLASMA STORM', 'Expanded neon plasma volley (+1 beam, +12% rate)'],
      fn: (p) => { p.evos.plasmaStorm = true; p.baseRate = Math.max(0.13, p.baseRate * 0.89); p.dmg *= 1.10; } },
    { id: 'EVO_SINGULARITY', weapon: 'ESCUDO ORBITAL', wMin: 2, passive: null, pMin: 0, icon: '🪐',
      pt: ['SINGULARIDADE ORBITAL', '4 esferas amplificadas puxam cristais próximos'], en: ['ORBITAL SINGULARITY', '4 amplified orbs pull nearby crystals'],
      fn: (p) => { p.evos.singularity = true; p.orbits = Math.max(p.orbits, 4); } },
    { id: 'EVO_TESLA_COIL', weapon: 'RAIO EM CADEIA', wMin: 2, passive: 'ARMA PESADA', pMin: 1, icon: '🌩️',
      pt: ['BOBINA DE TESLA', '+1 salto elétrico e micro-atordoamento'], en: ['TESLA COIL', '+1 lightning jump & brief stun'],
      fn: (p) => { p.evos.teslaCoil = true; p.chain += 1; p.dmg *= 1.10; } },
    { id: 'EVO_THERMOBARIC', weapon: 'MÍSSEIS TELEGUIADOS', wMin: 2, passive: 'TIRO PERFURANTE', pMin: 1, icon: '☄️',
      pt: ['SALVA TERMOBÁRICA', 'Foguetes explodem em área de alto impacto'], en: ['THERMOBARIC SALVO', 'Rockets detonate in heavy AoE blasts'],
      fn: (p) => { p.evos.thermobaric = true; p.missiles = Math.min(4, p.missiles + 1); } },
    { id: 'EVO_GRAV_PULSE', weapon: 'CAPACITOR EMP', wMin: 2, passive: null, pMin: 0, icon: '🌌',
      pt: ['PULSO GRAVITACIONAL', 'EMP puxa cristais e eletrifica o chão por 3s'], en: ['GRAVITY PULSE', 'EMP pulls crystals & electrifies floor 3s'],
      fn: (p) => { p.evos.gravPulse = true; p.empRad = Math.round(p.empRad * 1.2); } }
];

export interface CombatTuning {
    playerInvTime: number;
    spreadSideScale: number;
    spreadFixCountBug: boolean;
    minFireRate: number;
    chainCooldown: number;
    chainMaxArcs: number;
    chainRadius: number;
    chainHopScale: number;
    chainHopDecay: number;
    wingmanDmgScale: number;
    wingmanCooldownBase: number;
    wingmanCooldownStep: number;
    wingmanCooldownMin: number;
    orbitTickCd: number;
    orbitDmgScale: number;
    armorCap: number;
}

export const COMBAT_TUNING: CombatTuning = {
    playerInvTime: 0.74,
    spreadSideScale: 0.50,
    spreadFixCountBug: true,
    minFireRate: 0.135,
    chainCooldown: 0.14,
    chainMaxArcs: 5,
    chainRadius: 190,
    chainHopScale: 0.50,
    chainHopDecay: 0.82,
    wingmanDmgScale: 0.72,
    wingmanCooldownBase: 0.72,
    wingmanCooldownStep: 0.08,
    wingmanCooldownMin: 0.45,
    orbitTickCd: 0.65,
    orbitDmgScale: 1.0,
    armorCap: 0.50
};

export function pickUpgradeChoices(params: {
    player: PlayerStats;
    upgradePicks: Record<string, number>;
    unlockedEvos: Record<string, boolean>;
    weaponSlotsUsed: Set<string>;
    passiveSlotsUsed: Set<string>;
    cards?: CardDef[];
    fallbackCards?: CardDef[];
    evos?: EvoDef[];
    rng?: () => number;
    forceRepair?: boolean;
    choicesPerPick?: number;
}): UpgradeChoice[] {
    const {
        player, upgradePicks, unlockedEvos, weaponSlotsUsed, passiveSlotsUsed,
        cards = CARDS, fallbackCards = FALLBACK_CARDS, evos = EVOLUTIONS,
        rng = Math.random, forceRepair = false, choicesPerPick = STAGE_CARD_CONFIG.choicesPerPick
    } = params;
    const shouldOfferRepair = forceRepair || player.hp <= player.maxHp * 0.60;

    const cardLv = (id: string) => upgradePicks[id] || 0;
    const readyEvos = evos.filter(ev => {
        if (unlockedEvos[ev.id]) return false;
        const wLv = cardLv(ev.weapon);
        const pLv = ev.passive ? cardLv(ev.passive) : 1;
        return wLv >= ev.wMin && pLv >= ev.pMin;
    });

    const pool = cards.filter(c => {
        if (c.id === 'REPARO' && !shouldOfferRepair) return false;
        if (c.maxLv && cardLv(c.id) >= c.maxLv) return false;
        if (c.cat === 'weapon' && !weaponSlotsUsed.has(c.id) && weaponSlotsUsed.size >= 4) return false;
        if (c.cat === 'passive' && !c.noSlot && !passiveSlotsUsed.has(c.id) && passiveSlotsUsed.size >= 4) return false;
        return true;
    });

    const makeChoice = (c: CardDef): UpgradeChoice => {
        let rarity: Rarity = 'common';
        let mult = 1;
        if (c.cat === 'tactical') {
            rarity = 'epic';
        } else if (c.rarityScalable) {
            const roll = rng();
            if (roll > 0.86) { rarity = 'epic'; mult = 1.75; }
            else if (roll > 0.58) { rarity = 'rare'; mult = 1.35; }
        }
        return { isEvo: false, card: c, rarity, mult };
    };

    const picked: UpgradeChoice[] = [];
    const chosenIds = new Set<string>();
    if (readyEvos.length > 0) {
        picked.push({ isEvo: true, evo: readyEvos[0], rarity: 'evo', mult: 1 });
    }

    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    if (shouldOfferRepair) {
        const repairIndex = shuffled.findIndex(c => c.id === 'REPARO');
        if (repairIndex >= 0 && picked.length < choicesPerPick) {
            const repair = shuffled.splice(repairIndex, 1)[0];
            picked.push(makeChoice(repair));
            chosenIds.add(repair.id);
        }
    }

    if (player.lv <= 4 && weaponSlotsUsed.size < 2 && picked.length < choicesPerPick) {
        const wIdx = shuffled.findIndex(c => c.cat === 'weapon');
        if (wIdx !== -1) {
            const wc = shuffled.splice(wIdx, 1)[0];
            picked.push(makeChoice(wc));
            chosenIds.add(wc.id);
        }
    }

    let tacticalCount = 0;
    while (picked.length < choicesPerPick && shuffled.length > 0) {
        const c = shuffled.shift()!;
        if (chosenIds.has(c.id)) continue;
        if (c.cat === 'tactical' && tacticalCount >= 1 && shuffled.some(x => x.cat !== 'tactical')) {
            continue;
        }
        if (c.cat === 'tactical') tacticalCount++;
        chosenIds.add(c.id);
        picked.push(makeChoice(c));
    }

    if (picked.length < choicesPerPick) {
        const fbPool = [...fallbackCards]
            .filter(c => {
                if (c.id === 'REPARO' && !shouldOfferRepair) return false;
                if (c.maxLv && cardLv(c.id) >= c.maxLv) return false;
                return !chosenIds.has(c.id);
            })
            .sort(() => 0.5 - rng());
        while (picked.length < choicesPerPick && fbPool.length > 0) {
            const fc = fbPool.shift()!;
            chosenIds.add(fc.id);
            picked.push({ isEvo: false, card: fc, rarity: 'common', mult: 1 });
        }
    }

    if (picked.length < choicesPerPick) {
        const anyFb = fallbackCards.filter(c => !chosenIds.has(c.id));
        while (picked.length < choicesPerPick && anyFb.length > 0) {
            const fc = anyFb.shift()!;
            chosenIds.add(fc.id);
            picked.push({ isEvo: false, card: fc, rarity: 'common', mult: 1 });
        }
    }

    return picked;
}
