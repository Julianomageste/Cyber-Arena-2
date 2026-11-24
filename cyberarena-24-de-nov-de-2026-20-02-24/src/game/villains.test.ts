import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
    CAMPAIGN_STRUCTURE,
    VILLAIN_ENCOUNTERS,
    createDefaultCampaignProgress,
    normalizeCampaignProgress,
    getVillainEncounterById,
    getEncounterProgress,
    isStageUnlockedByBoss,
    isVillainDefeated,
    isVillainCardUnlocked,
    getVillainDisplayName,
    computeNormalizedSpritePlacement,
    formatCombatStatTime,
    formatAttemptsStat,
} from './villains';

const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');

test('campaign defines 10 independent encounters numbered 1 to 10 with 5 normal waves each and no wave timer', () => {
    assert.equal(CAMPAIGN_STRUCTURE.totalStages, 10);
    assert.equal(CAMPAIGN_STRUCTURE.wavesPerStage, 5);
    assert.equal(CAMPAIGN_STRUCTURE.usesWaveTimerForBosses, false);
    assert.equal(VILLAIN_ENCOUNTERS.length, 10);

    const ids = new Set<string>();
    VILLAIN_ENCOUNTERS.forEach((v, idx) => {
        const expectedNumber = idx + 1;
        assert.equal(v.number, expectedNumber);
        assert.equal(v.stage, expectedNumber);
        assert.equal(v.isNormalWave, false);
        assert.equal(v.usesWaveTimer, false);
        assert.deepEqual(v.waveRange, [idx * 5 + 1, idx * 5 + 5]);
        assert.equal(ids.has(v.id), false);
        ids.add(v.id);
    });
});

test('default campaign progress does not invent victory records and keeps all 10 cards locked', () => {
    const progress = createDefaultCampaignProgress();
    assert.equal(progress.lastDefeatedBossNumber, 0);
    assert.deepEqual(progress.encounters, {});

    for (const v of VILLAIN_ENCOUNTERS) {
        assert.equal(isVillainDefeated(v.id, progress), false);
        assert.equal(isVillainCardUnlocked(v, progress), false);
        const enc = getEncounterProgress(progress, v.id);
        assert.equal(enc.defeated, false);
        assert.equal(enc.totalCombatTimeSec, null);
        assert.equal(enc.lastBattleTimeSec, null);
        assert.equal(enc.attemptsToVictory, null);
    }
});

test('stage unlock depends strictly on lastDefeatedBossNumber rather than bestWave', () => {
    const legacySave = {
        bestWave: 42,
        campaign: undefined,
    };
    const progress = normalizeCampaignProgress(legacySave.campaign);

    assert.equal(progress.lastDefeatedBossNumber, 0);
    assert.equal(isStageUnlockedByBoss(1, progress), true);
    assert.equal(isStageUnlockedByBoss(2, progress), false);
    assert.equal(isStageUnlockedByBoss(10, progress), false);

    const afterBoss3 = normalizeCampaignProgress({
        lastDefeatedBossNumber: 3,
        encounters: {
            boss_01: { defeated: true, totalCombatTimeSec: 94, lastBattleTimeSec: 45, attemptsToVictory: 2, totalAttempts: 2 },
            boss_02: { defeated: true, totalCombatTimeSec: 120, lastBattleTimeSec: 60, attemptsToVictory: 3, totalAttempts: 3 },
            boss_03: { defeated: true, totalCombatTimeSec: 88, lastBattleTimeSec: 88, attemptsToVictory: 1, totalAttempts: 1 },
        },
    });

    assert.equal(isStageUnlockedByBoss(4, afterBoss3), true);
    assert.equal(isStageUnlockedByBoss(5, afterBoss3), false);
    assert.equal(isVillainCardUnlocked(getVillainEncounterById('boss_03')!, afterBoss3), true);
    assert.equal(isVillainCardUnlocked(getVillainEncounterById('boss_04')!, afterBoss3), false);
});

test('boss encounters expose the 10 sequential names and support TBD fallback when empty', () => {
    const expectedPtNames = [
        'Titãnos',
        'Meduza',
        'Coringa',
        'Xenodermus',
        'Cephalotus',
        'Nêmeses',
        'Mundus',
        'A Entidade',
        'Vulcano',
        'Rei dos Mortos',
    ];
    const expectedEnNames = [
        'Titãnos',
        'Meduza',
        'Joker',
        'Xenodermus',
        'Cephalotus',
        'Nêmeses',
        'Mundus',
        'The Entity',
        'Vulcano',
        'King of the Dead',
    ];
    assert.deepEqual(
        VILLAIN_ENCOUNTERS.map(v => getVillainDisplayName(v, 'pt')),
        expectedPtNames.map(text => ({ text, isPlaceholder: false }))
    );
    assert.deepEqual(
        VILLAIN_ENCOUNTERS.map(v => getVillainDisplayName(v, 'en')),
        expectedEnNames.map(text => ({ text, isPlaceholder: false }))
    );

    const boss1 = getVillainEncounterById('boss_01')!;
    const emptySlot = { ...boss1, nameSlot: { pt: '', en: '' } };
    assert.deepEqual(getVillainDisplayName(emptySlot, 'pt'), { text: 'Nome a definir', isPlaceholder: true });
    assert.deepEqual(getVillainDisplayName(emptySlot, 'en'), { text: 'Name TBD', isPlaceholder: true });
});

test('sprite zoom normalization produces uniform uncropped visual sizing across rectangular card frames', () => {
    const box = { width: 180, height: 225 };
    const small = computeNormalizedSpritePlacement({ sw: 48, sh: 48 }, box);
    const large = computeNormalizedSpritePlacement({ sw: 512, sh: 512 }, box);
    const tall = computeNormalizedSpritePlacement({ sw: 180, sh: 320 }, box);
    const wide = computeNormalizedSpritePlacement({ sw: 360, sh: 160 }, box);

    assert.equal(Math.round(small.drawH), Math.round(large.drawH));
    assert.ok(tall.drawW <= box.width && tall.drawH <= box.height);
    assert.ok(wide.drawW <= box.width && wide.drawH <= box.height);
    assert.equal(formatCombatStatTime(null), '--:--');
    assert.equal(formatCombatStatTime(125), '2:05');
    assert.equal(formatAttemptsStat(null), '--');
    assert.equal(formatAttemptsStat(4), '4');
});

test('index.html exposes Villains Catalog from Main Menu and Hangar with hidden detail layout and B&W locked styling', () => {
    assert.match(html, /id="open-villains-btn"[^>]*onclick="openVillainsCatalog\(\)"/);
    assert.match(html, /id="hangar-villains-btn"[^>]*onclick="openVillainsCatalog\(\)"/);
    assert.match(html, /id="villains-screen" class="menu-screen hidden"/);
    assert.match(html, /id="villain-detail-screen" class="menu-screen hidden"/);
    assert.match(html, /id="villains-back-btn"[^>]*onclick="closeVillainsCatalog\(\)"/);
    assert.match(html, /id="villain-detail-back-btn"[^>]*onclick="closeVillainDetail\(\)"/);
    assert.match(html, /\.villain-card \{[^}]*background:\s*#d3af37/);
    assert.match(html, /\.villain-stage-tag \{[^}]*background:\s*#231f12[^}]*color:\s*#faf5dc/);
    assert.match(html, /\.villain-name-slot \{[^}]*background:\s*#231f12/);
    assert.match(html, /\.villain-name-text \{[^}]*color:\s*#faf5dc/);
    assert.match(html, /\.villain-art-frame \{[^}]*aspect-ratio:\s*4 \/ 5/);
    assert.match(html, /\.villain-card\.is-locked \.villain-art-stage \{[^}]*grayscale\(1\)/);
    assert.match(html, /\.villain-lock-badge \{[^}]*width:\s*56px;\s*height:\s*56px/);
    assert.match(html, /Tempo total de combate até a vitória/);
    assert.match(html, /Tempo de combate da última batalha/);
    assert.match(html, /Número de tentativas até a vitória/);
    assert.doesNotMatch(html, /\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/);
});

test('all 10 boss sprite assets exist in public/ and stay uncropped with balanced visual scale', () => {
    const measuredBounds = [
        { sw: 563, sh: 791 },
        { sw: 413, sh: 779 },
        { sw: 401, sh: 803 },
        { sw: 473, sh: 749 },
        { sw: 527, sh: 839 },
        { sw: 479, sh: 563 },
        { sw: 371, sh: 833 },
        { sw: 557, sh: 767 },
        { sw: 575, sh: 713 },
        { sw: 521, sh: 701 },
    ];
    const cardBox = { width: 180, height: 225 };

    VILLAIN_ENCOUNTERS.forEach((v, idx) => {
        assert.ok(v.spriteSrc, `Expected spriteSrc for ${v.id}`);
        assert.ok(v.spriteSrc.startsWith('./assets/aistudio/'), `Relative asset path required for ${v.id}`);
        const diskPath = path.join(process.cwd(), 'public', v.spriteSrc.replace(/^\.\//, ''));
        assert.ok(fs.existsSync(diskPath), `Missing boss sprite on disk: ${diskPath}`);
        assert.ok(v.visualZoom >= 0.85 && v.visualZoom <= 1.15, `Balanced visualZoom expected for ${v.id}`);

        const placement = computeNormalizedSpritePlacement(measuredBounds[idx], cardBox, 0.90, v.visualZoom);
        assert.ok(placement.drawW <= cardBox.width + 0.001, `Width overflow on ${v.id}`);
        assert.ok(placement.drawH <= cardBox.height + 0.001, `Height overflow on ${v.id}`);
        assert.ok(placement.drawH >= 150, `Boss too small on ${v.id}: ${placement.drawH}`);
    });
});
