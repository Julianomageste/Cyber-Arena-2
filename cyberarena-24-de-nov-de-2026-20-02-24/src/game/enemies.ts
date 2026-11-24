import {
    ENEMY_BASE_DAMAGE,
    ENEMY_BASE_HP,
    ENEMY_DISPLAY_NAMES,
    LAB_UPGRADES,
    SCAVENGER_TUNING,
    labCost,
    type Lang
} from './balance';

export type ActiveCatalogEnemyType =
    | 'drone'
    | 'kamikaze'
    | 'gunner'
    | 'scavenger'
    | 'sniper'
    | 'artillery'
    | 'bastion'
    | 'miniboss'
    | 'tank';

export type CatalogEnemyType = ActiveCatalogEnemyType | `upcoming_${number}`;

export interface EnemyDetailCharacteristics {
    enemyTypePt: string;
    enemyTypeEn: string;
    attackTypePt: string;
    attackTypeEn: string;
    movementPt: string;
    movementEn: string;
    difficultyPt: string;
    difficultyEn: string;
    specialsPt: string;
    specialsEn: string;
}

export interface EnemyCatalogDef {
    id: CatalogEnemyType;
    spriteKey: ActiveCatalogEnemyType | null;
    spriteSrc?: string;
    locked: boolean;
    baseHp: number;
    baseDmg: number;
    unlockWave: number;
    namePt: string;
    nameEn: string;
    rolePt: string;
    roleEn: string;
    characteristics?: Partial<EnemyDetailCharacteristics>;
}

export type EnemyKillsMap = Record<ActiveCatalogEnemyType, number>;

const RAW_ACTIVE_ENEMY_CATALOG: EnemyCatalogDef[] = [
    {
        id: 'drone',
        spriteKey: 'drone',
        locked: false,
        baseHp: ENEMY_BASE_HP.drone,
        baseDmg: ENEMY_BASE_DAMAGE.drone,
        unlockWave: 1,
        namePt: 'Drone',
        nameEn: 'Drone',
        rolePt: 'Enxame ágil',
        roleEn: 'Agile swarm',
        characteristics: {
            specialsPt: 'Não deixa sucata; solta Cápsula de Reparo ao cair.',
            specialsEn: 'Drops 0 scrap; leaves a Repair Capsule on defeat.'
        }
    },
    {
        id: 'kamikaze',
        spriteKey: 'kamikaze',
        locked: false,
        baseHp: ENEMY_BASE_HP.kamikaze,
        baseDmg: ENEMY_BASE_DAMAGE.kamikaze,
        unlockWave: 6,
        namePt: ENEMY_DISPLAY_NAMES.kamikaze.pt,
        nameEn: ENEMY_DISPLAY_NAMES.kamikaze.en,
        rolePt: 'Explosivo rápido',
        roleEn: 'Fast explosive'
    },
    {
        id: 'scavenger',
        spriteKey: null,
        locked: false,
        baseHp: ENEMY_BASE_HP.scavenger,
        baseDmg: ENEMY_BASE_DAMAGE.scavenger,
        unlockWave: SCAVENGER_TUNING.unlockWave,
        namePt: ENEMY_DISPLAY_NAMES.scavenger.pt,
        nameEn: ENEMY_DISPLAY_NAMES.scavenger.en,
        rolePt: 'Ladrão de sucata',
        roleEn: 'Scrap thief',
        characteristics: {
            enemyTypePt: 'Coletor Tático (Etapa 2+)',
            enemyTypeEn: 'Tactical Collector (Stage 2+)',
            attackTypePt: 'Contato direto leve; prioriza sucata no chão',
            attackTypeEn: 'Light contact hit; prioritizes ground scrap',
            movementPt: 'Rota magnética até sucata solta ou jogador',
            movementEn: 'Moves toward dropped scrap or player',
            difficultyPt: 'Médio — ganha resistência se roubar sucata',
            difficultyEn: 'Medium — gains durability when stealing scrap',
            specialsPt: '+2% HP base a cada 10 sucatas roubadas (máx +30%). Devolve 75% ao morrer.',
            specialsEn: '+2% base HP per 10 stolen scrap (cap +30%). Returns 75% on death.'
        }
    },
    {
        id: 'gunner',
        spriteKey: 'gunner',
        locked: false,
        baseHp: ENEMY_BASE_HP.gunner,
        baseDmg: ENEMY_BASE_DAMAGE.gunner,
        unlockWave: 1,
        namePt: 'Atirador Curto',
        nameEn: 'Short Gunner',
        rolePt: 'Rajada curta',
        roleEn: 'Close burst'
    },
    {
        id: 'sniper',
        spriteKey: 'sniper',
        locked: false,
        baseHp: ENEMY_BASE_HP.sniper,
        baseDmg: ENEMY_BASE_DAMAGE.sniper,
        unlockWave: 1,
        namePt: 'Sniper',
        nameEn: 'Long-Range Sniper',
        rolePt: 'Disparo preciso',
        roleEn: 'Precision shot'
    },
    {
        id: 'artillery',
        spriteKey: 'artillery',
        locked: false,
        baseHp: ENEMY_BASE_HP.artillery,
        baseDmg: ENEMY_BASE_DAMAGE.artillery,
        unlockWave: 16,
        namePt: ENEMY_DISPLAY_NAMES.artillery.pt,
        nameEn: ENEMY_DISPLAY_NAMES.artillery.en,
        rolePt: 'Cabo arpoador',
        roleEn: 'Tether harpoon'
    },
    {
        id: 'bastion',
        spriteKey: 'bastion',
        locked: false,
        baseHp: ENEMY_BASE_HP.bastion,
        baseDmg: ENEMY_BASE_DAMAGE.bastion,
        unlockWave: 11,
        namePt: ENEMY_DISPLAY_NAMES.bastion.pt,
        nameEn: ENEMY_DISPLAY_NAMES.bastion.en,
        rolePt: 'Escudo frontal',
        roleEn: 'Front shield'
    },
    {
        id: 'miniboss',
        spriteKey: 'miniboss',
        locked: false,
        baseHp: ENEMY_BASE_HP.miniboss,
        baseDmg: ENEMY_BASE_DAMAGE.miniboss,
        unlockWave: 12,
        namePt: ENEMY_DISPLAY_NAMES.miniboss.pt,
        nameEn: ENEMY_DISPLAY_NAMES.miniboss.en,
        rolePt: 'Lâmina de elite',
        roleEn: 'Elite blade'
    },
    {
        id: 'tank',
        spriteKey: 'tank',
        locked: false,
        baseHp: ENEMY_BASE_HP.tank,
        baseDmg: ENEMY_BASE_DAMAGE.tank,
        unlockWave: 1,
        namePt: 'Tanque Blindado',
        nameEn: 'Heavy Tank',
        rolePt: 'Canhão 360°',
        roleEn: '360° cannon'
    }
];

export const ACTIVE_ENEMY_CATALOG_DEFS: readonly EnemyCatalogDef[] = [...RAW_ACTIVE_ENEMY_CATALOG].sort(
    (a, b) => a.baseHp - b.baseHp || a.unlockWave - b.unlockWave
);

const UPCOMING_ENEMY_ASSETS: readonly string[] = [
    './assets/aistudio/base_b1aca657.png',
    './assets/aistudio/base_5e5e6dd3.png',
    './assets/aistudio/base_49566b01.png',
    './assets/aistudio/base_42bb46b6.png',
    './assets/aistudio/base_e640c3c0.png',
    './assets/aistudio/base_a7fcb8d4.png',
    './assets/aistudio/base_33c28737.png',
    './assets/aistudio/base_6dbefca9.png',
    './assets/aistudio/base_6b32d685.png',
    './assets/aistudio/base_c47b6e29.png',
    './assets/aistudio/base_5ed980df.png',
    './assets/aistudio/base_a7c9117c.png',
    './assets/aistudio/base_0b846661.png',
    './assets/aistudio/base_67a2ad05.png',
    './assets/aistudio/base_b5810797.png',
    './assets/aistudio/base_61e19858.png',
    './assets/aistudio/base_e804d066.png'
];

export const UPCOMING_ENEMY_CATALOG_DEFS: readonly EnemyCatalogDef[] = UPCOMING_ENEMY_ASSETS.map(
    (spriteSrc, idx) => ({
        id: `upcoming_${idx + 1}` as CatalogEnemyType,
        spriteKey: null,
        spriteSrc,
        locked: true,
        baseHp: 200 + idx * 10,
        baseDmg: 0,
        unlockWave: 999,
        namePt: 'Bloqueado',
        nameEn: 'Locked',
        rolePt: 'Em breve',
        roleEn: 'Coming soon'
    })
);

export const ENEMY_CATALOG_DEFS: readonly EnemyCatalogDef[] = [
    ...ACTIVE_ENEMY_CATALOG_DEFS,
    ...UPCOMING_ENEMY_CATALOG_DEFS
];

export function createDefaultEnemyKills(): EnemyKillsMap {
    return {
        drone: 0,
        kamikaze: 0,
        scavenger: 0,
        gunner: 0,
        sniper: 0,
        artillery: 0,
        bastion: 0,
        miniboss: 0,
        tank: 0
    };
}

export function normalizeEnemyKills(raw: unknown, legacyTankKills = 0): EnemyKillsMap {
    const out = createDefaultEnemyKills();
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const obj = raw as Record<string, unknown>;
        for (const def of ACTIVE_ENEMY_CATALOG_DEFS) {
            const key = def.id as ActiveCatalogEnemyType;
            const v = obj[key];
            if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
                out[key] = Math.floor(v);
            }
        }
    }
    if (typeof legacyTankKills === 'number' && Number.isFinite(legacyTankKills) && legacyTankKills > 0) {
        out.tank = Math.max(out.tank, Math.floor(legacyTankKills));
    }
    return out;
}

export function recordEnemyKill(kills: EnemyKillsMap, enemyType: string): EnemyKillsMap {
    if (Object.prototype.hasOwnProperty.call(kills, enemyType)) {
        const key = enemyType as ActiveCatalogEnemyType;
        kills[key] = (Number.isFinite(kills[key]) ? kills[key] : 0) + 1;
    }
    return kills;
}

export function getEnemyKillCount(kills: EnemyKillsMap | undefined | null, enemyId: string): number {
    if (!kills || !Object.prototype.hasOwnProperty.call(kills, enemyId)) return 0;
    const val = kills[enemyId as ActiveCatalogEnemyType];
    return typeof val === 'number' && Number.isFinite(val) && val > 0 ? Math.floor(val) : 0;
}

export function getTotalCatalogKills(kills: EnemyKillsMap | undefined | null): number {
    if (!kills) return 0;
    return ACTIVE_ENEMY_CATALOG_DEFS.reduce((sum, def) => {
        return sum + getEnemyKillCount(kills, def.id);
    }, 0);
}

export function getEnemyCatalogById(id: string): EnemyCatalogDef | undefined {
    return ENEMY_CATALOG_DEFS.find(e => e.id === id);
}

export function getEnemyCatalogName(def: EnemyCatalogDef, lang: Lang): string {
    return lang === 'en' ? def.nameEn : def.namePt;
}

export function hasAffordableLabUpgrade(
    scrap: number,
    labLevels: Record<string, number> | undefined | null,
    stageLabPurchases?: Record<string, number> | undefined | null,
    stageLimit = 2
): boolean {
    const availableScrap = Math.floor(Number(scrap));
    if (!Number.isFinite(availableScrap) || availableScrap <= 0) return false;
    const levels = labLevels || {};
    const purchases = stageLabPurchases || {};
    return LAB_UPGRADES.some(u => {
        const rawLv = Number(levels[u.id]);
        const lv = Number.isFinite(rawLv) && rawLv > 0 ? Math.floor(rawLv) : 0;
        if (lv >= u.maxLv) return false;
        const stageBought = Math.max(0, Math.floor(Number(purchases[u.id]) || 0));
        if (stageLabPurchases && stageBought >= stageLimit) return false;
        return availableScrap >= labCost(u, lv);
    });
}
