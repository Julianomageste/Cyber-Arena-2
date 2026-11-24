import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameTelemetry } from './telemetry.js';

function makeRuntime() {
  const messages = [];
  const analytics = [];
  return {
    messages, analytics,
    getPlatformId: () => 'playgama',
    platformLanguage: () => 'pt-br',
    getDeviceInfo: () => ({ device_type: 'desktop', device_os: 'windows', orientation: 'landscape' }),
    sendMessage: (name, params) => { messages.push({ name, params }); return true; },
    sendAnalytics: (name, data) => { analytics.push({ name, data }); return true; },
  };
}

test('records complete wave context and gameplay aggregates without duplicate lifecycle analytics', () => {
  const runtime = makeRuntime();
  const telemetry = createGameTelemetry(runtime, { gameVersion: 'test-build' });
  telemetry.startRun({ starting_wave: 1, chassis: 'interceptor', player_level: 1 });
  telemetry.startWave(1, 1);
  telemetry.enemySpawned('drone', 12);
  telemetry.enemyKilled('drone', 1.5);
  telemetry.damageDealt('chain_lightning', 'drone', 18);
  telemetry.damageReceived('sniper_bolt', 'sniper', 7, 43);
  telemetry.healed('supply_pod', 12, 55);
  telemetry.xpGenerated(10, 'common_drone');
  telemetry.xpCollected(8, 'common_drone');
  telemetry.xpExpired(2, 'common_drone');
  telemetry.scrapEarned(3, 'enemy_drone');
  telemetry.upgradeOffered([{ card: { id: 'chain_lightning' } }, { card: { id: 'repair' } }]);
  telemetry.upgradeSelected('chain_lightning', 'weapon', 'rare', ['repair']);
  telemetry.arenaEventStarted('ion_storm');
  telemetry.arenaEventFailed('ion_storm', { progress_percent: 25 });
  telemetry.completeWave(1);

  assert.deepEqual(runtime.messages.filter(x => x.name === 'level_started').length, 1);
  assert.deepEqual(runtime.messages.filter(x => x.name === 'level_completed').length, 1);
  assert.equal(runtime.messages.some(x => x.name === 'game_start' || x.name === 'game_stop'), false);
  const summary = runtime.analytics.find(x => x.name === 'wave_summary');
  assert.ok(summary);
  assert.equal(summary.data.device_type, 'desktop');
  assert.equal(summary.data.damage_dealt, 18);
  assert.equal(summary.data.damage_received, 7);
  assert.equal(summary.data.xp_generated, 10);
  assert.equal(summary.data.xp_collected, 8);
  assert.equal(summary.data.xp_expired, 2);
  assert.match(summary.data.xp_generated_by_source, /common_drone/);
  assert.match(summary.data.xp_collected_by_source, /common_drone/);
  assert.match(summary.data.xp_expired_by_source, /common_drone/);
  assert.equal(summary.data.crystals_generated, 1);
  assert.equal(summary.data.crystals_collected, 1);
  assert.equal(summary.data.crystals_expired, 1);
  assert.match(summary.data.damage_by_weapon, /chain_lightning/);
  assert.match(summary.data.damage_taken_by_source, /sniper_bolt/);
  assert.match(summary.data.upgrades_offered, /repair/);
});

test('pause and resume lifecycle events are idempotent', () => {
  const runtime = makeRuntime();
  const telemetry = createGameTelemetry(runtime);
  telemetry.startRun();
  telemetry.startWave(2, 4);
  assert.equal(telemetry.pause(2, 'player'), true);
  assert.equal(telemetry.pause(2, 'platform'), false);
  assert.equal(telemetry.resume(2, 'player'), true);
  assert.equal(telemetry.resume(2, 'platform'), false);
  assert.deepEqual(runtime.messages.filter(x => x.name === 'level_paused').length, 1);
  assert.deepEqual(runtime.messages.filter(x => x.name === 'level_resumed').length, 1);
});

test('death followed by revive does not fail the level; final death does', () => {
  const runtime = makeRuntime();
  const telemetry = createGameTelemetry(runtime);
  telemetry.startRun();
  telemetry.startWave(6, 3);
  telemetry.pause(6, 'game_over');
  telemetry.resume(6, 'revive');
  telemetry.endRun(6, 'player_quit_after_death', true);
  assert.equal(runtime.messages.filter(x => x.name === 'level_failed').length, 1);
  const finalSummary = runtime.analytics.find(x => x.name === 'wave_summary');
  assert.equal(finalSummary.data.partial_wave, true);
  assert.equal(finalSummary.data.wave_result, 'failed');
});

test('interrupted run emits a partial wave summary but not level_failed', () => {
  const runtime = makeRuntime();
  const telemetry = createGameTelemetry(runtime);
  telemetry.startRun();
  telemetry.startWave(4, 2);
  telemetry.damageReceived('enemy_collision', 'drone', 5, 10);
  telemetry.endRun(4, 'page_exit', false);
  assert.equal(runtime.messages.filter(x => x.name === 'level_failed').length, 0);
  const summary = runtime.analytics.find(x => x.name === 'wave_summary');
  assert.equal(summary.data.partial_wave, true);
  assert.equal(summary.data.damage_received, 5);
});

test('achievements are emitted once per achievement ID', () => {
  const runtime = makeRuntime();
  const telemetry = createGameTelemetry(runtime);
  assert.equal(telemetry.achievement('survivor_1'), true);
  assert.equal(telemetry.achievement('survivor_1'), false);
  assert.equal(runtime.messages.filter(x => x.name === 'player_got_achievement').length, 1);
});


test('tracks healing offers, critical recovery and build composition', () => {
  const runtime = makeRuntime();
  const telemetry = createGameTelemetry(runtime);
  telemetry.startRun({ chassis: 'tesla' });
  telemetry.startWave(3, 5);
  telemetry.upgradeOffered([{ card: { id: 'REPARO' } }, { card: { id: 'ARMA PESADA' } }], { hp_percent: 22 });
  telemetry.upgradeSelected('REPARO', 'passive', 'common', ['ARMA PESADA']);
  telemetry.healed('REPARO', 30, 55, 100);
  telemetry.buildSnapshot({ weapon_levels: { 'RAIO EM CADEIA': 2 }, passive_levels: { 'REPARO': 1 }, unlocked_evolutions: ['tesla_coil'], weapon_slots_used: 1, passive_slots_used: 0, upgrade_count: 3 });
  assert.ok(runtime.analytics.some(x => x.name === 'healing_option_offered' && x.data.critical_repair_offered === undefined));
  assert.ok(runtime.analytics.some(x => x.name === 'healing_option_selected'));
  assert.ok(runtime.analytics.some(x => x.name === 'player_hp_recovered'));
  const build = runtime.analytics.find(x => x.name === 'build_snapshot');
  assert.ok(build);
  assert.match(build.data.weapon_levels, /RAIO EM CADEIA/);
  assert.match(build.data.unlocked_evolutions, /tesla_coil/);
});


test('regeneration is aggregated without per-frame Analytics spam', () => {
  const runtime = makeRuntime();
  const telemetry = createGameTelemetry(runtime);
  telemetry.startRun();
  telemetry.startWave(2, 4);
  for (let i = 1; i <= 20; i++) telemetry.healed('regeneration', 0.5, 19.5 + i * 0.5, 100);
  assert.equal(runtime.analytics.filter(x => x.name === 'player_healed').length, 0);
  assert.equal(runtime.analytics.filter(x => x.name === 'player_hp_recovered').length, 0);
  telemetry.healed('regeneration', 1, 30.5, 100);
  assert.equal(runtime.analytics.filter(x => x.name === 'player_hp_recovered').length, 1);
  telemetry.completeWave(2);
  const summary = runtime.analytics.find(x => x.name === 'wave_summary');
  assert.equal(summary.data.healing, 11);
  assert.match(summary.data.healing_by_source, /regeneration/);
});


test('run start includes platform, starting wave and initial progression context', () => {
  const runtime = makeRuntime();
  const telemetry = createGameTelemetry(runtime);
  telemetry.startRun({ starting_wave: 6, initial_scrap: 42, chassis: 'tesla', platform_id: 'playgama', language: 'pt' });
  const started = runtime.analytics.find(x => x.name === 'run_started');
  assert.equal(started.data.starting_wave, 6);
  assert.equal(started.data.initial_scrap, 42);
  assert.equal(started.data.platform_id, 'playgama');
  assert.equal(started.data.language, 'pt');
  assert.equal(started.data.chassis, 'tesla');
});


test('separates wall-clock duration from active gameplay and pause time', () => {
  const runtime = makeRuntime();
  const telemetry = createGameTelemetry(runtime);
  const originalNow = Date.now;
  let now = 100000;
  Date.now = () => now;
  try {
    telemetry.startRun();
    telemetry.startWave(1, 1);
    now += 10000;
    telemetry.pause(1, 'upgrade');
    now += 5000;
    telemetry.resume(1, 'upgrade_closed');
    now += 20000;
    telemetry.completeWave(1);
    telemetry.endRun(1, 'test_complete', false);
    const wave = runtime.analytics.find(x => x.name === 'wave_summary');
    const run = runtime.analytics.find(x => x.name === 'run_ended');
    assert.equal(wave.data.wave_active_duration_sec, 30);
    assert.equal(wave.data.wave_wall_duration_sec, 35);
    assert.equal(wave.data.wave_paused_sec, 5);
    assert.equal(run.data.run_duration_sec, 35);
    assert.equal(run.data.active_gameplay_sec, 30);
    assert.equal(run.data.paused_duration_sec, 5);
    assert.match(run.data.pause_time_by_source_sec, /upgrade/);
  } finally {
    Date.now = originalNow;
  }
});
