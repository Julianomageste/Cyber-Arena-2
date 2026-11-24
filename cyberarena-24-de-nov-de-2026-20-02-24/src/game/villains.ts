import type { Lang } from './balance';

export const CAMPAIGN_STRUCTURE = {
    totalStages: 10,
    wavesPerStage: 5,
    usesWaveTimerForBosses: false,
    unlockRule: 'last_defeated_boss',
} as const;

export interface VillainAbilityDef {
    id: string;
    namePt: string;
    nameEn: string;
    descPt: string;
    descEn: string;
}

export interface VillainEncounterDef {
    id: string;
    number: number;
    stage: number;
    waveRange: readonly [number, number];
    isNormalWave: false;
    usesWaveTimer: false;
    nameSlot: {
        pt: string;
        en: string;
    };
    codePt: string;
    codeEn: string;
    descriptionPt: string;
    descriptionEn: string;
    abilities: VillainAbilityDef[];
    /**
     * Optional 2D image path. Keep null while placeholder art is active so the
     * catalog does not trigger missing-asset network requests. Replace with a
     * relative path (e.g. './assets/bosses/boss_01.png') when ready.
     */
    spriteSrc: string | null;
    spritePlaceholderPath: string;
    visualZoom: number;
    accentColor: string;
}

export interface VillainEncounterProgress {
    defeated: boolean;
    totalCombatTimeSec: number | null;
    lastBattleTimeSec: number | null;
    attemptsToVictory: number | null;
    totalAttempts: number;
}

export interface CampaignProgress {
    lastDefeatedBossNumber: number;
    encounters: Record<string, VillainEncounterProgress>;
}

export interface SpriteBounds {
    sw: number;
    sh: number;
}

export interface TargetFrameBox {
    width: number;
    height: number;
}

export interface NormalizedSpritePlacement {
    drawW: number;
    drawH: number;
    dx: number;
    dy: number;
    scale: number;
}

const ACCENT_PALETTE = [
    '#38d6f5',
    '#ff4d6d',
    '#f6c453',
    '#b57bff',
    '#00e5a3',
    '#ff7b54',
    '#5ce1e6',
    '#ff5c8a',
    '#ffd166',
    '#a78bfa',
] as const;

const VILLAIN_SPRITE_CONFIG: ReadonlyArray<{ src: string; zoom: number }> = [
    { src: './assets/aistudio/Chef_o_1_864e4346.png', zoom: 0.98 },
    { src: './assets/aistudio/Chef_o_2_123d0e8b.png', zoom: 1.04 },
    { src: './assets/aistudio/Chef_o_3_d352f48b.png', zoom: 1.04 },
    { src: './assets/aistudio/Chef_o_4.1_a538b052.png', zoom: 1.02 },
    { src: './assets/aistudio/Chef_o_5_0aadf527.png', zoom: 1.00 },
    { src: './assets/aistudio/Chef_o_6_16252d8e.png', zoom: 1.05 },
    { src: './assets/aistudio/Chef_o_7_d3246dd6.png', zoom: 1.04 },
    { src: './assets/aistudio/Chef_o_8_adfc10fd.png', zoom: 0.90 },
    { src: './assets/aistudio/Chef_o_9.1_f746e923.png', zoom: 0.96 },
    { src: './assets/aistudio/Chef_o_10_07b6c79d.png', zoom: 0.96 },
];

const VILLAIN_BOSS_NAMES: ReadonlyArray<{ pt: string; en: string }> = [
    { pt: 'Titãnos', en: 'Titãnos' },
    { pt: 'Meduza', en: 'Meduza' },
    { pt: 'Coringa', en: 'Joker' },
    { pt: 'Xenodermus', en: 'Xenodermus' },
    { pt: 'Cephalotus', en: 'Cephalotus' },
    { pt: 'Nêmeses', en: 'Nêmeses' },
    { pt: 'Mundus', en: 'Mundus' },
    { pt: 'A Entidade', en: 'The Entity' },
    { pt: 'Vulcano', en: 'Vulcano' },
    { pt: 'Rei dos Mortos', en: 'King of the Dead' },
];

export const VILLAIN_ENCOUNTERS: readonly VillainEncounterDef[] = Array.from(
    { length: CAMPAIGN_STRUCTURE.totalStages },
    (_, index): VillainEncounterDef => {
        const number = index + 1;
        const padded = String(number).padStart(2, '0');
        const waveStart = index * CAMPAIGN_STRUCTURE.wavesPerStage + 1;
        const waveEnd = waveStart + CAMPAIGN_STRUCTURE.wavesPerStage - 1;
        const spriteCfg = VILLAIN_SPRITE_CONFIG[index];
        const bossName = VILLAIN_BOSS_NAMES[index] ?? { pt: '', en: '' };
        return {
            id: `boss_${padded}`,
            number,
            stage: number,
            waveRange: [waveStart, waveEnd],
            isNormalWave: false,
            usesWaveTimer: false,
            nameSlot: {
                pt: bossName.pt,
                en: bossName.en,
            },
            codePt: `CHEFÃO ${padded}`,
            codeEn: `BOSS ${padded}`,
            descriptionPt: `Encontro final da Etapa ${number}, após as ondas ${waveStart}–${waveEnd}. Confronto dedicado sem temporizador de onda; dossiê narrativo reservado para definição final.`,
            descriptionEn: `Final encounter of Stage ${number}, following waves ${waveStart}–${waveEnd}. Dedicated showdown without a wave timer; narrative dossier reserved for final naming.`,
            abilities: [
                {
                    id: `boss_${padded}_ability_1`,
                    namePt: `Habilidade Tática 01 — A definir`,
                    nameEn: `Tactical Ability 01 — TBD`,
                    descPt: `Espaço reservado para a habilidade primária do Chefão ${padded}.`,
                    descEn: `Reserved slot for Boss ${padded} primary ability.`,
                },
                {
                    id: `boss_${padded}_ability_2`,
                    namePt: `Habilidade Tática 02 — A definir`,
                    nameEn: `Tactical Ability 02 — TBD`,
                    descPt: `Espaço reservado para a habilidade especial do Chefão ${padded}.`,
                    descEn: `Reserved slot for Boss ${padded} special ability.`,
                },
            ],
            spriteSrc: spriteCfg?.src ?? null,
            spritePlaceholderPath: `./assets/bosses/chefao_${number}.png`,
            visualZoom: spriteCfg?.zoom ?? 1,
            accentColor: ACCENT_PALETTE[index % ACCENT_PALETTE.length],
        };
    }
);

export function createDefaultEncounterProgress(): VillainEncounterProgress {
    return {
        defeated: false,
        totalCombatTimeSec: null,
        lastBattleTimeSec: null,
        attemptsToVictory: null,
        totalAttempts: 0,
    };
}

export function createDefaultCampaignProgress(): CampaignProgress {
    return {
        lastDefeatedBossNumber: 0,
        encounters: {},
    };
}

function toFiniteNonNegativeOrNull(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
    return value;
}

export function normalizeCampaignProgress(raw: unknown): CampaignProgress {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return createDefaultCampaignProgress();
    }
    const obj = raw as Record<string, unknown>;
    const rawLast = typeof obj.lastDefeatedBossNumber === 'number' && Number.isFinite(obj.lastDefeatedBossNumber)
        ? Math.floor(obj.lastDefeatedBossNumber)
        : 0;
    const clampedLast = Math.max(0, Math.min(CAMPAIGN_STRUCTURE.totalStages, rawLast));

    const encounters: Record<string, VillainEncounterProgress> = {};
    const rawEncounters = obj.encounters;
    if (rawEncounters && typeof rawEncounters === 'object' && !Array.isArray(rawEncounters)) {
        for (const def of VILLAIN_ENCOUNTERS) {
            const entry = (rawEncounters as Record<string, unknown>)[def.id];
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
            const eObj = entry as Record<string, unknown>;
            const totalAttemptsRaw = toFiniteNonNegativeOrNull(eObj.totalAttempts);
            const attemptsToVictoryRaw = toFiniteNonNegativeOrNull(eObj.attemptsToVictory);
            encounters[def.id] = {
                defeated: eObj.defeated === true,
                totalCombatTimeSec: toFiniteNonNegativeOrNull(eObj.totalCombatTimeSec),
                lastBattleTimeSec: toFiniteNonNegativeOrNull(eObj.lastBattleTimeSec),
                attemptsToVictory: attemptsToVictoryRaw === null ? null : Math.floor(attemptsToVictoryRaw),
                totalAttempts: totalAttemptsRaw === null ? 0 : Math.floor(totalAttemptsRaw),
            };
        }
    }

    return {
        lastDefeatedBossNumber: clampedLast,
        encounters,
    };
}

export function getVillainEncounterById(id: string): VillainEncounterDef | undefined {
    return VILLAIN_ENCOUNTERS.find(v => v.id === id);
}

export function getEncounterProgress(progress: CampaignProgress | undefined | null, villainId: string): VillainEncounterProgress {
    const normalized = progress ?? createDefaultCampaignProgress();
    return normalized.encounters[villainId] ?? createDefaultEncounterProgress();
}

/**
 * Campaign stage unlock depends strictly on the last defeated boss number,
 * never on the player's highest reached wave in endless/survival runs.
 */
export function isStageUnlockedByBoss(stageNumber: number, progress: CampaignProgress | undefined | null): boolean {
    if (!Number.isFinite(stageNumber)) return false;
    const stage = Math.floor(stageNumber);
    if (stage < 1 || stage > CAMPAIGN_STRUCTURE.totalStages) return false;
    const lastDefeated = Math.max(0, Math.floor(progress?.lastDefeatedBossNumber ?? 0));
    return stage <= lastDefeated + 1;
}

export function isVillainDefeated(villainId: string, progress: CampaignProgress | undefined | null): boolean {
    return getEncounterProgress(progress, villainId).defeated === true;
}

/**
 * Catalog card reveal state: cards stay locked (grayscale + padlock) until
 * the corresponding boss has been defeated.
 */
export function isVillainCardUnlocked(villain: VillainEncounterDef, progress: CampaignProgress | undefined | null): boolean {
    return isVillainDefeated(villain.id, progress);
}

export function getVillainDisplayName(villain: VillainEncounterDef, lang: Lang): { text: string; isPlaceholder: boolean } {
    const raw = (lang === 'en' ? villain.nameSlot.en : villain.nameSlot.pt).trim();
    if (raw.length > 0) {
        return { text: raw, isPlaceholder: false };
    }
    return {
        text: lang === 'en' ? 'Name TBD' : 'Nome a definir',
        isPlaceholder: true,
    };
}

/**
 * Computes uniform visual framing inside a card/detail box so sprites with
 * different source dimensions or aspect ratios appear visually balanced,
 * close-up, and completely uncropped.
 */
export function computeNormalizedSpritePlacement(
    bounds: SpriteBounds,
    box: TargetFrameBox,
    fillRatio = 0.90,
    visualZoom = 1
): NormalizedSpritePlacement {
    const sw = Math.max(1, bounds.sw);
    const sh = Math.max(1, bounds.sh);
    const safeRatio = Math.max(0.2, Math.min(0.96, fillRatio));
    const safeZoom = Math.max(0.4, Math.min(2.0, visualZoom || 1));

    const maxW = Math.max(1, box.width * safeRatio);
    const maxH = Math.max(1, box.height * safeRatio);
    const baseScale = Math.min(maxW / sw, maxH / sh);
    const scale = Math.min(baseScale * safeZoom, Math.min(box.width / sw, box.height / sh));
    const drawW = sw * scale;
    const drawH = sh * scale;

    return {
        drawW,
        drawH,
        dx: (box.width - drawW) * 0.5,
        dy: (box.height - drawH) * 0.5,
        scale,
    };
}

export function formatCombatStatTime(seconds: number | null | undefined): string {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
        return '--:--';
    }
    const whole = Math.floor(seconds);
    const mins = Math.floor(whole / 60);
    const secs = whole % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function formatAttemptsStat(attempts: number | null | undefined): string {
    if (typeof attempts !== 'number' || !Number.isFinite(attempts) || attempts < 0) {
        return '--';
    }
    return String(Math.floor(attempts));
}
