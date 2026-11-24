import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const config = JSON.parse(fs.readFileSync(new URL('../../playgama-bridge-config.json', import.meta.url), 'utf8'));

function placementIds(section) { return (section?.placements || []).map(item => item.id); }

test('rewarded placements are explicitly configured and preload uses a placement id', () => {
  const rewarded = config.advertisement?.rewarded;
  assert.equal(rewarded?.disable, false);
  assert.equal(typeof rewarded?.preloadOnStart, 'string');
  assert.equal(placementIds(rewarded).includes(rewarded.preloadOnStart), true);
  assert.equal(placementIds(rewarded).includes('revive'), true);
  assert.equal(placementIds(rewarded).includes('double_scrap'), true);
  assert.equal(placementIds(rewarded).includes(rewarded.placementFallback), true);
});

test('interstitial placements are explicitly configured and preload uses a placement id', () => {
  const interstitial = config.advertisement?.interstitial;
  assert.equal(interstitial?.disable, false);
  assert.equal(typeof interstitial?.preloadOnStart, 'string');
  assert.equal(placementIds(interstitial).includes(interstitial.preloadOnStart), true);
  for (const id of ['game_over', 'return_to_menu']) assert.equal(placementIds(interstitial).includes(id), true);
  assert.equal(placementIds(interstitial).includes('level_completed'), false);
});
