import type { CampaignProgress } from './villains';
import type { Lang } from './balance';

export type RobotId =
    | 'interceptor'
    | 'parasita'
    | 'tesla'
    | 'sombra'
    | 'carrasco'
    | 'fenix'
    | 'guardiao'
    | 'vortice'
    | 'chronos'
    | 'robot_10';

export interface RobotCharacteristics {
    typePt: string;
    typeEn: string;
    weaponPt: string;
    weaponEn: string;
    movementPt: string;
    movementEn: string;
    passivePt: string;
    passiveEn: string;
    specialsPt: string;
    specialsEn: string;
}

export interface RobotCatalogDef {
    id: RobotId;
    number: number;
    namePt: string;
    nameEn: string;
    unlockWave: number;
    unlockBossNumber: number;
    lockedPlaceholder: boolean;
    spriteRightSrc: string | null;
    spriteLeftSrc: string | null;
    /** Shared combat baseline while unique robot powers are reserved for a later update. */
    hpMult: number;
    dmgMult: number;
    spdMult: number;
    armor: number;
    crit: number;
    chain: number;
    empMult: number;
    descPt: string;
    descEn: string;
    pal: {
        main: string;
        dark: string;
        light: string;
        visor: string;
        visorGlow: string;
        accent: string;
    };
    characteristics: RobotCharacteristics;
}

const SHARED_ROBOT_STATS = {
    hpMult: 1.0,
    dmgMult: 1.0,
    spdMult: 1.0,
    armor: 0,
    crit: 0.06,
    chain: 0,
    empMult: 1.0
} as const;

const SHARED_TBD_CHARACTERISTICS: RobotCharacteristics = {
    typePt: 'Unidade Bípede de Combate',
    typeEn: 'Bipedal Combat Unit',
    weaponPt: 'Canhão de Pulso Padrão (poderes únicos a definir)',
    weaponEn: 'Standard Pulse Cannon (unique powers TBD)',
    movementPt: 'Mobilidade tática 360° (sprite direcional esquerda/direita)',
    movementEn: 'Tactical 360° mobility (left/right directional sprites)',
    passivePt: 'A definir — atributos base padronizados',
    passiveEn: 'TBD — standardized base attributes',
    specialsPt: 'Habilidades especiais exclusivas a definir',
    specialsEn: 'Exclusive special skills TBD'
};

export const ROBOT_CATALOG_DEFS: readonly RobotCatalogDef[] = [
    {
        id: 'interceptor',
        number: 1,
        namePt: 'INTERCEPTOR',
        nameEn: 'INTERCEPTOR',
        unlockWave: 1,
        unlockBossNumber: 0,
        lockedPlaceholder: false,
        spriteRightSrc: './assets/aistudio/1_INTERCEPTOR2_a41f206e.png',
        spriteLeftSrc: './assets/aistudio/INTERCEPTOR_3d2541e0.png',
        ...SHARED_ROBOT_STATS,
        descPt: 'Unidade inicial da campanha. Atributos padronizados; habilidades exclusivas em definição.',
        descEn: 'Starter campaign unit. Standardized combat attributes; unique abilities TBD.',
        pal: { main: '#ea580c', dark: '#27272a', light: '#fed7aa', visor: '#09151e', visorGlow: '#38d6f5', accent: '#38bdf8' },
        characteristics: {
            ...SHARED_TBD_CHARACTERISTICS,
            typePt: 'Unidade #01 · Linha de Frente',
            typeEn: 'Unit #01 · Frontline'
        }
    },
    {
        id: 'parasita',
        number: 2,
        namePt: 'PARASITA',
        nameEn: 'PARASITE',
        unlockWave: 6,
        unlockBossNumber: 1,
        lockedPlaceholder: false,
        spriteRightSrc: './assets/aistudio/2_PARASITA2_2b6ef3e8.png',
        spriteLeftSrc: './assets/aistudio/PARASITA_d375e522.png',
        ...SHARED_ROBOT_STATS,
        descPt: 'Desbloqueado após derrotar o Chefão 01 (Checkpoint da onda 6). Poderes exclusivos em definição.',
        descEn: 'Unlocked after defeating Boss 01 (Wave 6 checkpoint). Exclusive powers TBD.',
        pal: { main: '#16a34a', dark: '#14261c', light: '#bbf7d0', visor: '#052e16', visorGlow: '#4ade80', accent: '#84cc16' },
        characteristics: {
            ...SHARED_TBD_CHARACTERISTICS,
            typePt: 'Unidade #02 · Bio-Tec',
            typeEn: 'Unit #02 · Bio-Tech'
        }
    },
    {
        id: 'tesla',
        number: 3,
        namePt: 'TESLA',
        nameEn: 'TESLA',
        unlockWave: 11,
        unlockBossNumber: 2,
        lockedPlaceholder: false,
        spriteRightSrc: './assets/aistudio/3_TESLA2_35e729b5.png',
        spriteLeftSrc: './assets/aistudio/TESLA_3b955dc3.png',
        ...SHARED_ROBOT_STATS,
        descPt: 'Desbloqueado após derrotar o Chefão 02 (Checkpoint da onda 11). Poderes exclusivos em definição.',
        descEn: 'Unlocked after defeating Boss 02 (Wave 11 checkpoint). Exclusive powers TBD.',
        pal: { main: '#2563eb', dark: '#111827', light: '#bfdbfe', visor: '#082f49', visorGlow: '#38bdf8', accent: '#facc15' },
        characteristics: {
            ...SHARED_TBD_CHARACTERISTICS,
            typePt: 'Unidade #03 · Arco Voltaico',
            typeEn: 'Unit #03 · Voltaic Arc'
        }
    },
    {
        id: 'sombra',
        number: 4,
        namePt: 'SOMBRA',
        nameEn: 'SHADOW',
        unlockWave: 16,
        unlockBossNumber: 3,
        lockedPlaceholder: false,
        spriteRightSrc: './assets/aistudio/4_SOMBRA2_0889e61a.png',
        spriteLeftSrc: './assets/aistudio/SOMBRA_54b87df7.png',
        ...SHARED_ROBOT_STATS,
        descPt: 'Desbloqueado após derrotar o Chefão 03 (Checkpoint da onda 16). Poderes exclusivos em definição.',
        descEn: 'Unlocked after defeating Boss 03 (Wave 16 checkpoint). Exclusive powers TBD.',
        pal: { main: '#7c3aed', dark: '#0f172a', light: '#ddd6fe', visor: '#1e1b4b', visorGlow: '#a855f7', accent: '#c084fc' },
        characteristics: {
            ...SHARED_TBD_CHARACTERISTICS,
            typePt: 'Unidade #04 · Furtivo',
            typeEn: 'Unit #04 · Stealth'
        }
    },
    {
        id: 'carrasco',
        number: 5,
        namePt: 'CARRASCO',
        nameEn: 'EXECUTIONER',
        unlockWave: 21,
        unlockBossNumber: 4,
        lockedPlaceholder: false,
        spriteRightSrc: './assets/aistudio/6_CARRASCO_de73af53.png',
        spriteLeftSrc: './assets/aistudio/CARRASCO2_ec56d203.png',
        ...SHARED_ROBOT_STATS,
        descPt: 'Desbloqueado após derrotar o Chefão 04 (Checkpoint da onda 21). Poderes exclusivos em definição.',
        descEn: 'Unlocked after defeating Boss 04 (Wave 21 checkpoint). Exclusive powers TBD.',
        pal: { main: '#78716c', dark: '#1c1917', light: '#d6d3d1', visor: '#292524', visorGlow: '#f97316', accent: '#fb923c' },
        characteristics: {
            ...SHARED_TBD_CHARACTERISTICS,
            typePt: 'Unidade #05 · Artilharia Pesada',
            typeEn: 'Unit #05 · Heavy Ordnance'
        }
    },
    {
        id: 'fenix',
        number: 6,
        namePt: 'FÊNIX',
        nameEn: 'PHOENIX',
        unlockWave: 26,
        unlockBossNumber: 5,
        lockedPlaceholder: false,
        spriteRightSrc: './assets/aistudio/7_F_NIX2_d3e577b3.png',
        spriteLeftSrc: './assets/aistudio/F_NIX_b6ad0a11.png',
        ...SHARED_ROBOT_STATS,
        descPt: 'Desbloqueado após derrotar o Chefão 05 (Checkpoint da onda 26). Poderes exclusivos em definição.',
        descEn: 'Unlocked after defeating Boss 05 (Wave 26 checkpoint). Exclusive powers TBD.',
        pal: { main: '#f59e0b', dark: '#27170d', light: '#fde68a', visor: '#451a03', visorGlow: '#fb923c', accent: '#ef4444' },
        characteristics: {
            ...SHARED_TBD_CHARACTERISTICS,
            typePt: 'Unidade #06 · Núcleo Solar',
            typeEn: 'Unit #06 · Solar Core'
        }
    },
    {
        id: 'guardiao',
        number: 7,
        namePt: 'GUARDIÃO',
        nameEn: 'GUARDIAN',
        unlockWave: 31,
        unlockBossNumber: 6,
        lockedPlaceholder: false,
        spriteRightSrc: './assets/aistudio/8_GUARDI_O2_84fdec84.png',
        spriteLeftSrc: './assets/aistudio/GUARDI_O_69254823.png',
        ...SHARED_ROBOT_STATS,
        descPt: 'Desbloqueado após derrotar o Chefão 06 (Checkpoint da onda 31). Poderes exclusivos em definição.',
        descEn: 'Unlocked after defeating Boss 06 (Wave 31 checkpoint). Exclusive powers TBD.',
        pal: { main: '#0284c7', dark: '#1e293b', light: '#e2e8f0', visor: '#082f49', visorGlow: '#38bdf8', accent: '#93c5fd' },
        characteristics: {
            ...SHARED_TBD_CHARACTERISTICS,
            typePt: 'Unidade #07 · Bastião',
            typeEn: 'Unit #07 · Bastion'
        }
    },
    {
        id: 'vortice',
        number: 8,
        namePt: 'VÓRTICE',
        nameEn: 'VORTEX',
        unlockWave: 36,
        unlockBossNumber: 7,
        lockedPlaceholder: false,
        spriteRightSrc: './assets/aistudio/9_V_RTICE_5e9f93c2.png',
        spriteLeftSrc: './assets/aistudio/V_RTICE2_b0b71e08.png',
        ...SHARED_ROBOT_STATS,
        descPt: 'Desbloqueado após derrotar o Chefão 07 (Checkpoint da onda 36). Poderes exclusivos em definição.',
        descEn: 'Unlocked after defeating Boss 07 (Wave 36 checkpoint). Exclusive powers TBD.',
        pal: { main: '#6d28d9', dark: '#111827', light: '#c4b5fd', visor: '#1e1b4b', visorGlow: '#d946ef', accent: '#8b5cf6' },
        characteristics: {
            ...SHARED_TBD_CHARACTERISTICS,
            typePt: 'Unidade #08 · Singularidade',
            typeEn: 'Unit #08 · Singularity'
        }
    },
    {
        id: 'chronos',
        number: 9,
        namePt: 'CHRONOS',
        nameEn: 'CHRONOS',
        unlockWave: 41,
        unlockBossNumber: 8,
        lockedPlaceholder: false,
        spriteRightSrc: './assets/aistudio/10_CHRONOS2_44f7c64b.png',
        spriteLeftSrc: './assets/aistudio/CHRONOS_26f2b595.png',
        ...SHARED_ROBOT_STATS,
        descPt: 'Desbloqueado após derrotar o Chefão 08 (Checkpoint da onda 41). Poderes exclusivos em definição.',
        descEn: 'Unlocked after defeating Boss 08 (Wave 41 checkpoint). Exclusive powers TBD.',
        pal: { main: '#0ea5e9', dark: '#0f172a', light: '#f1f5f9', visor: '#082f49', visorGlow: '#22d3ee', accent: '#38bdf8' },
        characteristics: {
            ...SHARED_TBD_CHARACTERISTICS,
            typePt: 'Unidade #09 · Crono-Núcleo',
            typeEn: 'Unit #09 · Chrono-Core'
        }
    },
    {
        id: 'robot_10',
        number: 10,
        namePt: 'Unidade #10',
        nameEn: 'Unit #10',
        unlockWave: 46,
        unlockBossNumber: 9,
        lockedPlaceholder: true,
        spriteRightSrc: null,
        spriteLeftSrc: null,
        ...SHARED_ROBOT_STATS,
        descPt: 'Desbloqueado após derrotar o Chefão 09 (Checkpoint da onda 46). Visual e poderes a definir.',
        descEn: 'Unlocked after defeating Boss 09 (Wave 46 checkpoint). Artwork and powers TBD.',
        pal: { main: '#10b981', dark: '#064e3b', light: '#a7f3d0', visor: '#022c22', visorGlow: '#34d399', accent: '#6ee7b7' },
        characteristics: {
            typePt: 'Unidade #10 · A definir',
            typeEn: 'Unit #10 · TBD',
            weaponPt: 'A definir',
            weaponEn: 'TBD',
            movementPt: 'A definir',
            movementEn: 'TBD',
            passivePt: 'A definir',
            passiveEn: 'TBD',
            specialsPt: 'Espaço reservado para o 10º robô jogável',
            specialsEn: 'Reserved slot for the 10th playable robot'
        }
    }
];

export function getRobotById(id: string): RobotCatalogDef {
    return ROBOT_CATALOG_DEFS.find(r => r.id === id) || ROBOT_CATALOG_DEFS[0];
}

export function getRobotDisplayName(robot: RobotCatalogDef, lang: Lang): string {
    return lang === 'en' ? robot.nameEn : robot.namePt;
}

export function isRobotUnlocked(
    robot: RobotCatalogDef,
    campaignProgress: Pick<CampaignProgress, 'lastDefeatedBossNumber'> | undefined | null
): boolean {
    const defeated = Math.max(0, Math.floor(campaignProgress?.lastDefeatedBossNumber ?? 0));
    return defeated >= robot.unlockBossNumber;
}

export function isRobotSelectable(
    robot: RobotCatalogDef,
    campaignProgress: Pick<CampaignProgress, 'lastDefeatedBossNumber'> | undefined | null
): boolean {
    return !robot.lockedPlaceholder && isRobotUnlocked(robot, campaignProgress);
}

export function getUnlockedRobotIds(
    campaignProgress: Pick<CampaignProgress, 'lastDefeatedBossNumber'> | undefined | null
): RobotId[] {
    return ROBOT_CATALOG_DEFS
        .filter(r => isRobotUnlocked(r, campaignProgress))
        .map(r => r.id);
}

export function getRobotSpriteKeys(robotId: string): { right: string; left: string } {
    const robot = getRobotById(robotId);
    const id = robot.lockedPlaceholder ? 'interceptor' : robot.id;
    return {
        right: `robot_${id}_right`,
        left: `robot_${id}_left`
    };
}
