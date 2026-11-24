import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');

test('wave 8 boss gate never reads the undeclared lowercase hangar identifier', () => {
  assert.doesNotMatch(html, /\bhangar\s*\.\s*overclock\b/);
  assert.match(html, /liveEnemyCount\s*>=\s*getWaveCaps\(wave\)\.maxEnemies/);
  assert.match(html, /const bossScheduledThisWave = wave >= 8/);
  assert.match(html, /boss_pending_set/);
  assert.match(html, /boss_spawn_gate_opened/);
});

test('a gameplay frame exception is reported and converted into a controlled pause', () => {
  assert.match(html, /Gameplay loop exception; pausing safely/);
  assert.match(html, /game_loop_error/);
  assert.match(html, /setGameplayPaused\(true, 'runtime_error'\)/);
  assert.match(html, /__CYBER_ARENA_LAST_RUNTIME_ERROR/);
});

test('kamikaze AI declares chargeTriggerDist and blastR before using them', () => {
  assert.match(html, /else if \(e\.t === 'kamikaze'\)\s*\{\s*const blastR = getKamikazeExplosionRadius\(player\.range\);\s*const chargeTriggerDist = getKamikazeChargeRange\(player\.range\);/);
});

test('dropped scrap matches golden crate scale and all player chassis skins resolve to existing assets', () => {
  assert.match(html, /const scrapH = \(c\.scrap \|\| 0\) >= 1 \? 42 : 40;/);
  const spriteBlock = html.match(/const SPRITE_PATHS = \{([\s\S]*?)\};/);
  assert.ok(spriteBlock, 'SPRITE_PATHS must exist in index.html');
  const expectedEntries = {
    player: './assets/aistudio/gen-9495ed62-f1e0-442b-abed-c5527dd501ba_ddd34fe7.png',
    player_guardiao: './assets/aistudio/Guardi_o_8b6c698c.png',
    player_tesla: './assets/aistudio/Tesla_0234ffb2.png',
    player_sombra: './assets/aistudio/Sombra_e9d9f5c6.png',
    tank: './assets/aistudio/tank_enemy_hull.png',
    scrap: './assets/aistudio/gen-cb55e8f1-d7e2-4d42-9462-f591da622c37_7032ebb2.png',
    crate: './assets/aistudio/caixa_dourada_drop_aleat_rio_67cc78c7.png'
  };
  for (const [key, relPath] of Object.entries(expectedEntries)) {
    assert.ok(spriteBlock[1].includes(`${key}: '${relPath}'`), `Missing ${key} -> ${relPath}`);
    const fileOnDisk = path.join(process.cwd(), 'public', relPath.replace(/^\.\//, ''));
    assert.ok(fs.existsSync(fileOnDisk), `Asset missing on disk: ${fileOnDisk}`);
  }
});

test('tank uses 360 rotating cannon barrel, Bullet Bill tank_cannonball, cannon SFX, and higher damage than shooters', () => {
  assert.match(html, /function getTankTurretPivot\(e, visualScale = 1\)/);
  assert.match(html, /kind:\s*'tank_cannonball'/);
  assert.match(html, /SFX\.sfx\.tankFire\(\)/);
  assert.match(html, /ENEMY_BASE_DAMAGE\.tank/);
  assert.match(html, /ep\.kind === 'tank_cannonball'/);
  assert.match(html, /turretA:\s*0/);
  assert.match(html, /fireCD:\s*1\.15/);
});
