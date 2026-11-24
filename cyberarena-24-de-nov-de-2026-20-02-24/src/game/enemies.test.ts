import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
    ACTIVE_ENEMY_CATALOG_DEFS,
    UPCOMING_ENEMY_CATALOG_DEFS,
    ENEMY_CATALOG_DEFS,
    createDefaultEnemyKills,
    normalizeEnemyKills,
    recordEnemyKill,
    getEnemyKillCount,
    getTotalCatalogKills,
    getEnemyCatalogById,
    getEnemyCatalogName,
    hasAffordableLabUpgrade
} from './enemies';
import { LAB_UPGRADES, labCost } from './balance';

const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');

test('ENEMY_CATALOG_DEFS includes 8 active enemies (Drone renamed) and 17 locked upcoming enemies', () => {
    assert.equal(ACTIVE_ENEMY_CATALOG_DEFS.length, 8);
    assert.equal(UPCOMING_ENEMY_CATALOG_DEFS.length, 17);
    assert.equal(ENEMY_CATALOG_DEFS.length, 25);

    assert.deepEqual(
        ACTIVE_ENEMY_CATALOG_DEFS.map(e => e.id),
        ['drone', 'kamikaze', 'gunner', 'sniper', 'artillery', 'bastion', 'tank', 'miniboss']
    );
    assert.equal(getEnemyCatalogName(ACTIVE_ENEMY_CATALOG_DEFS[0], 'pt'), 'Drone');
    assert.equal(getEnemyCatalogName(ACTIVE_ENEMY_CATALOG_DEFS[0], 'en'), 'Drone');

    for (let i = 1; i < ACTIVE_ENEMY_CATALOG_DEFS.length; i++) {
        assert.ok(
            ACTIVE_ENEMY_CATALOG_DEFS[i].baseHp >= ACTIVE_ENEMY_CATALOG_DEFS[i - 1].baseHp,
            `Expected ${ACTIVE_ENEMY_CATALOG_DEFS[i].id} HP >= previous`
        );
    }
    for (const def of UPCOMING_ENEMY_CATALOG_DEFS) {
        assert.equal(def.locked, true);
        assert.equal(getEnemyCatalogName(def, 'pt'), 'Bloqueado');
        assert.ok(def.spriteSrc);
        const diskPath = path.join(process.cwd(), 'public', def.spriteSrc.replace(/^\.\//, ''));
        assert.ok(fs.existsSync(diskPath), `Missing upcoming enemy asset: ${diskPath}`);
    }
});

test('enemy kill counts accumulate permanently and never reset across deaths or checkpoints', () => {
    const kills = createDefaultEnemyKills();
    recordEnemyKill(kills, 'drone');
    recordEnemyKill(kills, 'drone');
    recordEnemyKill(kills, 'tank');
    recordEnemyKill(kills, 'miniboss');
    recordEnemyKill(kills, 'boss'); // Bosses belong to Villains Catalog, should not throw

    assert.equal(getEnemyKillCount(kills, 'drone'), 2);
    assert.equal(getEnemyKillCount(kills, 'tank'), 1);
    assert.equal(getEnemyKillCount(kills, 'miniboss'), 1);
    assert.equal(getEnemyKillCount(kills, 'upcoming_1'), 0);
    assert.equal(getTotalCatalogKills(kills), 4);

    // Simulates loading persistent state after player death / boss checkpoint
    const persisted = normalizeEnemyKills({ drone: 14, gunner: 5, tank: 2 }, 7);
    assert.equal(persisted.drone, 14);
    assert.equal(persisted.gunner, 5);
    assert.equal(persisted.tank, 7);
    recordEnemyKill(persisted, 'tank');
    assert.equal(persisted.tank, 8);
    assert.equal(getEnemyCatalogById('drone')?.locked, false);
});

test('hasAffordableLabUpgrade returns true only when scrap covers a non-maxed permanent Lab upgrade', () => {
    const cheapest = Math.min(...LAB_UPGRADES.map(u => labCost(u, 0))); // 35
    assert.equal(hasAffordableLabUpgrade(cheapest - 1, {}), false);
    assert.equal(hasAffordableLabUpgrade(cheapest - 0.1, {}), false);
    assert.equal(hasAffordableLabUpgrade(4, { weapon: 3, capacitor: 2, engine: 1, salvage: 1 }), false);
    assert.equal(hasAffordableLabUpgrade(cheapest, {}), true);

    const allMaxed = Object.fromEntries(LAB_UPGRADES.map(u => [u.id, u.maxLv]));
    assert.equal(hasAffordableLabUpgrade(9999, allMaxed), false);

    // Only salvage left at Lv0 (cost 54 after +20%), others maxed
    const almostMaxed = Object.fromEntries(LAB_UPGRADES.map(u => [u.id, u.id === 'salvage' ? 0 : u.maxLv]));
    assert.equal(hasAffordableLabUpgrade(53, almostMaxed), false);
    assert.equal(hasAffordableLabUpgrade(54, almostMaxed), true);
});

test('index.html wires redesigned enemy cards, B&W locked styling, and Enemy Detail screen with blue pedestal and 5 fields', () => {
    assert.match(html, /id="open-enemies-btn"[^>]*onclick="openEnemiesCatalog\(\)"/);
    assert.match(html, /id="hangar-enemies-btn"[^>]*onclick="openEnemiesCatalog\(\)"/);
    assert.match(html, /id="enemies-screen" class="menu-screen hidden"/);
    assert.match(html, /id="enemy-detail-screen" class="menu-screen hidden"/);
    assert.match(html, /id="enemy-detail-back-btn"[^>]*onclick="closeEnemyDetail\(\)"/);
    assert.match(html, /class="enemy-pedestal-beam"/);
    assert.match(html, /class="enemy-pedestal"/);
    assert.match(html, /id="enemy-detail-kills"/);
    assert.match(html, /id="enemy-detail-type"/);
    assert.match(html, /id="enemy-detail-attack"/);
    assert.match(html, /id="enemy-detail-movement"/);
    assert.match(html, /id="enemy-detail-difficulty"/);
    assert.match(html, /id="enemy-detail-specials"/);
    assert.match(html, /\.enemy-kills-tag/);
    assert.doesNotMatch(html, /class="enemy-hp-tag"/);
    assert.doesNotMatch(html, /enemyFirstWave/);
    assert.match(html, /\.enemy-card\.is-locked \.enemy-art-stage\s*\{[^}]*grayscale\(1\)/);
    assert.doesNotMatch(html, /\.enemy-card\s*\{[^}]*#d3af37/);
    assert.match(html, /id="go-lab-hint"/);
    assert.match(html, /window\.closeHangar\s*=\s*function\(\)\s*\{[\s\S]*updateGameOverLabHint\(\)/);
    assert.match(html, /window\.buyLabUpgrade\s*=\s*function\(id\)\s*\{[\s\S]*updateGameOverLabHint\(\)/);
});
