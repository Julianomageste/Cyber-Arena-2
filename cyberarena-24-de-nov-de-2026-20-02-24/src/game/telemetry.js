const SCHEMA_VERSION = 3;
const MAX_COUNTER_KEYS = 32;

function randomRunId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
function round(value, places = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const factor = 10 ** places;
  return Math.round(n * factor) / factor;
}
function increment(map, key, amount = 1) {
  const safeKey = String(key || 'unknown').slice(0, 48);
  if (!Object.hasOwn(map, safeKey) && Object.keys(map).length >= MAX_COUNTER_KEYS) return;
  map[safeKey] = (map[safeKey] || 0) + (Number(amount) || 0);
}
function compact(map) {
  const entries = Object.entries(map || {}).map(([k, v]) => [k, round(v, 2)]).slice(0, MAX_COUNTER_KEYS);
  while (entries.length) {
    const encoded = JSON.stringify(Object.fromEntries(entries));
    if (encoded.length <= 740) return encoded;
    entries.pop();
  }
  return '{}';
}
function averageMap(map) {
  return compact(Object.fromEntries(Object.entries(map || {}).map(([key, value]) => [key, value.count ? value.total / value.count : 0])));
}

export function createGameTelemetry(runtime, options = {}) {
  const gameVersion = options.gameVersion || '1.7.0-progression-scrap-boss-sprite-fix';
  const platformId = options.platformId || runtime?.getPlatformId?.() || 'unknown';
  const platformLanguage = options.platformLanguage || runtime?.platformLanguage?.() || 'unknown';
  const deviceInfo = options.deviceInfo || runtime?.getDeviceInfo?.() || { device_type: 'unknown', device_os: 'unknown', orientation: 'unknown' };
  let runId = null;
  let runContext = {};
  let waveContext = null;
  let phase = 'menu';
  let playerLevel = 1;
  let runStartedAt = 0;
  let waveStartedAt = 0;
  let activeRunMs = 0;
  let activeRunSegmentStartedAt = 0;
  let pausedAt = 0;
  let pausedDurationMs = 0;
  let pausedBySource = {};
  let currentPauseSource = 'unknown';
  let waveActiveMs = 0;
  let waveActiveSegmentStartedAt = 0;
  let runFinalized = true;
  let activeLevel = null;
  let lifecyclePaused = false;
  let runTotals;
  let waveTotals;
  let frameSamples = [];
  let sampleStartAt = 0;
  let samplePeaks = { enemies: 0, projectiles: 0, hazards: 0 };
  const sentAchievements = new Set();

  const emptyTotals = () => ({
    damageDealt: 0, damageReceived: 0, healing: 0,
    xpGenerated: 0, xpCollected: 0, xpExpired: 0,
    xpGeneratedBySource: {}, xpCollectedBySource: {}, xpExpiredBySource: {},
    scrapEarned: 0, scrapSpent: 0,
    enemiesSpawned: {}, enemiesKilled: {},
    damageTakenBySource: {}, damageTakenByEnemyType: {},
    damageByWeapon: {}, damageByEnemyType: {}, healingBySource: {}, scrapBySource: {},
    enemyTtk: {}, bossAttacks: {}, eventsStarted: {}, eventsCompleted: {}, eventsFailed: {},
    upgradesOffered: {}, upgradesSelected: {},
    crystalsGenerated: 0, crystalsCollected: 0, crystalsExpired: 0,
    damageEvents: 0, hitCount: 0, kills: 0, bossesKilled: 0, minibossesKilled: 0,
    maxEnemies: 0, maxProjectiles: 0, maxHazards: 0,
  });
  const resetTotals = () => emptyTotals();
  runTotals = resetTotals();
  waveTotals = resetTotals();

  function currentActiveRunMs(now = Date.now()) {
    return activeRunMs + (activeRunSegmentStartedAt > 0 && !lifecyclePaused ? Math.max(0, now - activeRunSegmentStartedAt) : 0);
  }
  function currentPausedMs(now = Date.now()) {
    return pausedDurationMs + (pausedAt > 0 ? Math.max(0, now - pausedAt) : 0);
  }
  function stopWaveActiveSegment(now = Date.now()) {
    if (waveActiveSegmentStartedAt > 0) {
      waveActiveMs += Math.max(0, now - waveActiveSegmentStartedAt);
      waveActiveSegmentStartedAt = 0;
    }
  }
  function context(extra = {}) {
    const now = Date.now();
    return {
      schema_version: SCHEMA_VERSION,
      game_build_version: gameVersion,
      platform_id: platformId,
      platform_language: platformLanguage,
      device_type: String(deviceInfo.device_type || 'unknown'),
      device_os: String(deviceInfo.device_os || 'unknown'),
      orientation: String(deviceInfo.orientation || 'unknown'),
      run_id: runId || 'no_run',
      wave: waveContext?.wave ?? extra.wave ?? 0,
      player_level: extra.player_level ?? playerLevel,
      chassis: String(runContext.chassis || 'unknown'),
            game_phase: phase,
      elapsed_sec: round(runStartedAt ? (now - runStartedAt) / 1000 : 0, 1),
      active_gameplay_sec: round(currentActiveRunMs(now) / 1000, 1),
      paused_elapsed_sec: round(currentPausedMs(now) / 1000, 1),
      ...extra,
    };
  }
  function emit(name, data = {}) {
    return runtime?.sendAnalytics?.(name, context(data)) ?? false;
  }
  function applyToBoth(fn) {
    if (runFinalized) return;
    fn(runTotals);
    fn(waveTotals);
  }
  function setPhase(nextPhase) { phase = String(nextPhase || 'unknown').slice(0, 24); }
  function setPlayerLevel(level) { playerLevel = Math.max(1, Number(level) || 1); if (waveContext) waveContext.player_level = playerLevel; }
  function startRun(data = {}) {
    runId = randomRunId();
    runContext = { ...data };
    runStartedAt = Date.now();
    activeRunMs = 0;
    activeRunSegmentStartedAt = runStartedAt;
    pausedAt = 0;
    pausedDurationMs = 0;
    pausedBySource = {};
    currentPauseSource = 'unknown';
    waveActiveMs = 0;
    waveActiveSegmentStartedAt = 0;
    runFinalized = false;
    lifecyclePaused = false;
    activeLevel = null;
    phase = 'playing';
    playerLevel = Math.max(1, Number(data.player_level) || 1);
    runTotals = resetTotals();
    waveTotals = resetTotals();
    frameSamples = [];
    sampleStartAt = runStartedAt;
    samplePeaks = { enemies: 0, projectiles: 0, hazards: 0 };
    emit('run_started', {
      starting_wave: Number(data.starting_wave) || 1,
      initial_scrap: Number(data.initial_scrap) || 0,
      platform_id: String(data.platform_id || platformId || 'unknown'),
      language: String(data.language || platformLanguage || 'unknown'),
      chassis: String(data.chassis || 'unknown'),
      device_type: String(deviceInfo.device_type || 'unknown'),
      device_os: String(deviceInfo.device_os || 'unknown'),
      orientation: String(deviceInfo.orientation || 'unknown'),
      remote_config_supported: Boolean(data.remote_config_supported),
      tuning_source: String(data.tuning_source || 'local_default'),
      lab_hull: Number(data.lab_hull) || 0,
      lab_weapon: Number(data.lab_weapon) || 0,
      lab_engine: Number(data.lab_engine) || 0,
      lab_capacitor: Number(data.lab_capacitor) || 0,
      lab_magnet: Number(data.lab_magnet) || 0,
      lab_emp_core: Number(data.lab_emp_core) || 0,
      lab_salvage: Number(data.lab_salvage) || 0,
    });
  }
  function startWave(wave, level = playerLevel, extra = {}) {
    const n = Math.max(1, Number(wave) || 1);
    playerLevel = Math.max(1, Number(level) || 1);
    waveContext = { wave: n, player_level: playerLevel };
    waveStartedAt = Date.now();
    waveActiveMs = 0;
    waveActiveSegmentStartedAt = waveStartedAt;
    waveTotals = resetTotals();
    activeLevel = n;
    lifecyclePaused = false;
    phase = 'playing';
    runtime?.sendMessage?.('level_started', { world: 'arena', level: String(n) });
    emit('wave_started', { level: n, ...extra });
  }
  function waveSummary(wave, extra = {}) {
    const now = Date.now();
    const wallElapsed = Math.max(0, (now - waveStartedAt) / 1000);
    const activeElapsed = Math.max(0, (waveActiveMs + (waveActiveSegmentStartedAt > 0 && !lifecyclePaused ? now - waveActiveSegmentStartedAt : 0)) / 1000);
    return {
      level: Number(wave) || waveContext?.wave || 1,
      wave_duration_sec: round(activeElapsed, 1),
      wave_active_duration_sec: round(activeElapsed, 1),
      wave_wall_duration_sec: round(wallElapsed, 1),
      wave_paused_sec: round(Math.max(0, wallElapsed - activeElapsed), 1),
      enemies_spawned: compact(waveTotals.enemiesSpawned),
      enemies_killed: compact(waveTotals.enemiesKilled),
      damage_dealt: round(waveTotals.damageDealt),
      damage_received: round(waveTotals.damageReceived),
      healing: round(waveTotals.healing),
      xp_generated: round(waveTotals.xpGenerated),
      xp_collected: round(waveTotals.xpCollected),
      xp_expired: round(waveTotals.xpExpired),
      xp_generated_by_source: compact(waveTotals.xpGeneratedBySource),
      xp_collected_by_source: compact(waveTotals.xpCollectedBySource),
      xp_expired_by_source: compact(waveTotals.xpExpiredBySource),
      scrap_earned: round(waveTotals.scrapEarned),
      scrap_by_source: compact(waveTotals.scrapBySource),
      scrap_spent: round(waveTotals.scrapSpent),
      damage_by_weapon: compact(waveTotals.damageByWeapon),
      damage_by_enemy_type: compact(waveTotals.damageByEnemyType),
      damage_taken_by_source: compact(waveTotals.damageTakenBySource),
      damage_taken_by_enemy: compact(waveTotals.damageTakenByEnemyType),
      healing_by_source: compact(waveTotals.healingBySource),
      crystals_generated: waveTotals.crystalsGenerated,
      crystals_collected: waveTotals.crystalsCollected,
      crystals_expired: waveTotals.crystalsExpired,
      enemy_ttk_avg: averageMap(waveTotals.enemyTtk),
      enemy_attacks: compact(waveTotals.bossAttacks),
      events_started: compact(waveTotals.eventsStarted),
      events_completed: compact(waveTotals.eventsCompleted),
      events_failed: compact(waveTotals.eventsFailed),
      upgrades_offered: compact(waveTotals.upgradesOffered),
      upgrades_selected: compact(waveTotals.upgradesSelected),
      max_enemies: waveTotals.maxEnemies,
      max_projectiles: waveTotals.maxProjectiles,
      max_hazards: waveTotals.maxHazards,
      ...extra,
    };
  }
  function completeWave(wave, extra = {}) {
    const n = Number(wave) || waveContext?.wave || 1;
    stopWaveActiveSegment();
    if (activeLevel === n) {
      runtime?.sendMessage?.('level_completed', { world: 'arena', level: String(n) });
      activeLevel = null;
    }
    emit('wave_summary', waveSummary(n, extra));
    return true;
  }
  function endRun(wave, reason = 'run_ended', failed = false) {
    if (runFinalized || !runId) return false;
    const now = Date.now();
    if (pausedAt > 0) {
      const duration = Math.max(0, now - pausedAt);
      pausedDurationMs += duration;
      increment(pausedBySource, currentPauseSource || 'unknown', duration / 1000);
      pausedAt = 0;
      currentPauseSource = 'unknown';
    }
    if (activeRunSegmentStartedAt > 0) {
      activeRunMs += Math.max(0, now - activeRunSegmentStartedAt);
      activeRunSegmentStartedAt = 0;
    }
    stopWaveActiveSegment(now);
    const n = Math.max(1, Number(wave) || waveContext?.wave || 1);
    if (activeLevel !== null) {
      const finalLevel = activeLevel;
      if (failed) runtime?.sendMessage?.('level_failed', { world: 'arena', level: String(finalLevel) });
      emit('wave_summary', waveSummary(finalLevel, { wave_result: failed ? 'failed' : 'interrupted', partial_wave: true, end_reason: String(reason || 'run_ended') }));
    }
    phase = failed ? 'game_over' : 'ended';
    emit('run_ended', {
      end_reason: String(reason || 'run_ended'),
      level_failed: Boolean(failed),
      final_wave: n,
      run_duration_sec: round((now - runStartedAt) / 1000, 1),
      active_gameplay_sec: round(activeRunMs / 1000, 1),
      paused_duration_sec: round(pausedDurationMs / 1000, 1),
      pause_time_by_source_sec: compact(pausedBySource),
      enemies_killed: runTotals.kills,
      bosses_killed: runTotals.bossesKilled,
      minibosses_killed: runTotals.minibossesKilled,
      enemies_killed_by_type: compact(runTotals.enemiesKilled),
      enemies_spawned_by_type: compact(runTotals.enemiesSpawned),
      damage_dealt: round(runTotals.damageDealt),
      damage_by_weapon: compact(runTotals.damageByWeapon),
      damage_by_enemy_type: compact(runTotals.damageByEnemyType),
      damage_received: round(runTotals.damageReceived),
      damage_taken_by_source: compact(runTotals.damageTakenBySource),
      damage_taken_by_enemy: compact(runTotals.damageTakenByEnemyType),
      healing: round(runTotals.healing),
      healing_by_source: compact(runTotals.healingBySource),
      xp_generated: round(runTotals.xpGenerated),
      xp_collected: round(runTotals.xpCollected),
      xp_expired: round(runTotals.xpExpired),
      xp_generated_by_source: compact(runTotals.xpGeneratedBySource),
      xp_collected_by_source: compact(runTotals.xpCollectedBySource),
      xp_expired_by_source: compact(runTotals.xpExpiredBySource),
      scrap_earned: round(runTotals.scrapEarned),
      scrap_by_source: compact(runTotals.scrapBySource),
      scrap_spent: round(runTotals.scrapSpent),
      events_started: compact(runTotals.eventsStarted),
      events_completed: compact(runTotals.eventsCompleted),
      events_failed: compact(runTotals.eventsFailed),
      upgrades_offered: compact(runTotals.upgradesOffered),
      upgrades_selected: compact(runTotals.upgradesSelected),
    });
    runFinalized = true;
    activeLevel = null;
    return true;
  }
  function failLevel(wave, reason = 'player_death') { return endRun(wave, reason, true); }
  function pause(wave, source = 'player') {
    if (runFinalized || lifecyclePaused) return false;
    const now = Date.now();
    if (activeRunSegmentStartedAt > 0) {
      activeRunMs += Math.max(0, now - activeRunSegmentStartedAt);
      activeRunSegmentStartedAt = 0;
    }
    stopWaveActiveSegment(now);
    pausedAt = now;
    currentPauseSource = String(source || 'unknown');
    lifecyclePaused = true;
    phase = source === 'upgrade' ? 'upgrade' : 'paused';
    if (activeLevel !== null) runtime?.sendMessage?.('level_paused', { world: 'arena', level: String(Number(wave) || activeLevel) });
    emit('game_paused', { pause_source: source });
    return true;
  }
  function resume(wave, source = 'player') {
    if (runFinalized || !lifecyclePaused) return false;
    const now = Date.now();
    if (pausedAt > 0) {
      const duration = Math.max(0, now - pausedAt);
      pausedDurationMs += duration;
      increment(pausedBySource, currentPauseSource || 'unknown', duration / 1000);
      pausedAt = 0;
      currentPauseSource = 'unknown';
    }
    activeRunSegmentStartedAt = now;
    if (activeLevel !== null) waveActiveSegmentStartedAt = now;
    lifecyclePaused = false;
    phase = 'playing';
    if (activeLevel !== null) runtime?.sendMessage?.('level_resumed', { world: 'arena', level: String(Number(wave) || activeLevel) });
    emit('game_resumed', { resume_source: source });
    return true;
  }
  function achievement(id = 'unknown') {
    const key = String(id || 'unknown');
    if (sentAchievements.has(key)) return false;
    sentAchievements.add(key);
    runtime?.sendMessage?.('player_got_achievement');
    emit('achievement_unlocked', { achievement_id: key });
    return true;
  }
  function event(name, data = {}) { return emit(name, data); }
  function enemySpawned(type, hp, extra = {}) {
    const enemyType = String(type || 'unknown');
    applyToBoth(t => increment(t.enemiesSpawned, enemyType));
    if (enemyType === 'boss') emit('boss_spawned', { enemy_type: enemyType, enemy_hp: round(hp), boss_variant: String(extra?.bossVariant || extra?.boss_variant || 'unknown') });
    else if (enemyType === 'miniboss') emit('miniboss_spawned', { enemy_type: enemyType, enemy_hp: round(hp) });
  }
  function enemyKilled(type, ttkSec, extra = {}) {
    const enemyType = String(type || 'unknown');
    applyToBoth(t => {
      increment(t.enemiesKilled, enemyType);
      t.kills++;
      if (Number.isFinite(ttkSec)) {
        const current = t.enemyTtk[enemyType] || { total: 0, count: 0 };
        t.enemyTtk[enemyType] = { total: current.total + Math.max(0, ttkSec), count: current.count + 1 };
      }
      if (enemyType === 'boss') t.bossesKilled++;
      if (enemyType === 'miniboss') t.minibossesKilled++;
    });
    if (enemyType === 'boss') emit('boss_defeated', { boss_variant: String(extra?.bossVariant || extra?.boss_variant || 'unknown'), time_to_kill_sec: round(ttkSec) });
    if (enemyType === 'miniboss') emit('miniboss_defeated', { time_to_kill_sec: round(ttkSec) });
  }
  function damageDealt(source, enemyType, amount) {
    const dmg = Math.max(0, Number(amount) || 0);
    applyToBoth(t => {
      t.damageDealt += dmg;
      increment(t.damageByWeapon, source, dmg);
      increment(t.damageByEnemyType, enemyType, dmg);
      t.damageEvents++;
    });
  }
  function damageReceived(source, enemyType, amount, hpAfter) {
    const dmg = Math.max(0, Number(amount) || 0);
    applyToBoth(t => {
      t.damageReceived += dmg;
      increment(t.damageTakenBySource, source, dmg);
      increment(t.damageTakenByEnemyType, enemyType, dmg);
      t.hitCount++;
    });
    if (hpAfter !== undefined && Number(hpAfter) <= 0) emit('player_damage_lethal', { damage_source: source, attacker_type: enemyType, damage_amount: round(dmg) });
  }
  function enemyAttack(enemyType, attackType, count = 1) {
    applyToBoth(t => increment(t.bossAttacks, `${enemyType}:${attackType}`, count));
  }
  function healed(source, amount, hpAfter, hpMax) {
    const value = Math.max(0, Number(amount) || 0);
    if (!value) return;
    const sourceName = String(source || 'unknown');
    const after = Number(hpAfter) || 0;
    const before = after - value;
    const max = Number(hpMax) || 0;
    // Regeneration is applied every frame; aggregate it locally instead of
    // generating hundreds of Analytics events per minute.
    applyToBoth(t => { t.healing += value; increment(t.healingBySource, sourceName, value); });
    if (sourceName !== 'regeneration') {
      emit('player_healed', { healing_source: sourceName, healing_amount: round(value), hp_after: round(after), hp_max: round(max) });
    }
    if (max > 0 && before <= max * 0.3 && after > max * 0.3) {
      emit('player_hp_recovered', { healing_source: sourceName, hp_after: round(after), hp_max: round(max) });
    }
  }
  function xpGenerated(amount, source = 'unknown') {
    const v = Math.max(0, Number(amount) || 0);
    const key = String(source || 'unknown');
    applyToBoth(t => { t.xpGenerated += v; t.crystalsGenerated++; increment(t.xpGeneratedBySource, key, v); });
  }
  function xpCollected(amount, source = 'unknown') {
    const v = Math.max(0, Number(amount) || 0);
    const key = String(source || 'unknown');
    applyToBoth(t => { t.xpCollected += v; t.crystalsCollected++; increment(t.xpCollectedBySource, key, v); });
  }
  function xpExpired(amount, source = 'unknown') {
    const v = Math.max(0, Number(amount) || 0);
    const key = String(source || 'unknown');
    applyToBoth(t => { t.xpExpired += v; t.crystalsExpired++; increment(t.xpExpiredBySource, key, v); });
  }
  function scrapEarned(amount, source = 'unknown') {
    const v = Math.max(0, Number(amount) || 0);
    applyToBoth(t => { t.scrapEarned += v; increment(t.scrapBySource, source, v); });
  }
  function scrapSpent(amount, purpose = 'unknown') {
    const v = Math.max(0, Number(amount) || 0);
    if (!v) return;
    applyToBoth(t => { t.scrapSpent += v; });
    emit('scrap_spent', { scrap_amount: round(v), spend_purpose: String(purpose || 'unknown') });
  }
  function upgradeOffered(choices = [], extra = {}) {
    const ids = choices.map(x => x?.isEvo ? `evo:${x.evo?.id}` : x?.card?.id || 'unknown');
    const recoveryIds = new Set(['REPARO', 'HP MÁXIMO', 'NANO-REGENERAÇÃO', 'RESERVA_SUCATA']);
    const recoveryOffered = ids.some(id => recoveryIds.has(id));
    applyToBoth(t => ids.forEach(id => increment(t.upgradesOffered, id)));
    emit('upgrade_offered', { option_count: ids.length, offered_ids: JSON.stringify(ids), recovery_option_offered: recoveryOffered, critical_repair_offered: ids.includes('REPARO'), ...extra });
    if (recoveryOffered) emit('healing_option_offered', { healing_options: JSON.stringify(ids.filter(id => recoveryIds.has(id))), hp_percent: Number(extra.hp_percent) || 0 });
  }
  function upgradeSelected(id, category, rarity, alternatives = []) {
    const key = String(id || 'unknown');
    applyToBoth(t => increment(t.upgradesSelected, key));
    emit('upgrade_selected', { upgrade_id: key, upgrade_category: category || 'unknown', rarity: rarity || 'unknown', alternatives: JSON.stringify(alternatives) });
    if (['REPARO', 'HP MÁXIMO', 'NANO-REGENERAÇÃO', 'RESERVA_SUCATA'].includes(key)) emit('healing_option_selected', { upgrade_id: key, upgrade_category: category || 'unknown' });
  }
  function buildSnapshot(snapshot = {}) {
    emit('build_snapshot', {
      weapon_levels: JSON.stringify(snapshot.weapon_levels || {}),
      passive_levels: JSON.stringify(snapshot.passive_levels || {}),
      tactical_levels: JSON.stringify(snapshot.tactical_levels || {}),
      unlocked_evolutions: JSON.stringify(snapshot.unlocked_evolutions || []),
      weapon_slots_used: Number(snapshot.weapon_slots_used) || 0,
      passive_slots_used: Number(snapshot.passive_slots_used) || 0,
      upgrade_count: Number(snapshot.upgrade_count) || 0,
    });
  }
  function arenaEventStarted(type) { applyToBoth(t => increment(t.eventsStarted, type)); emit('arena_event_started', { arena_event: type }); }
  function arenaEventCompleted(type) { applyToBoth(t => increment(t.eventsCompleted, type)); emit('arena_event_completed', { arena_event: type }); }
  function arenaEventFailed(type, extra = {}) { applyToBoth(t => increment(t.eventsFailed, type)); emit('arena_event_failed', { arena_event: type, ...extra }); }
  function performanceSample({ fps, frameMs, enemies, projectiles, hazards }) {
    if (runFinalized) return;
    const now = Date.now();
    if (Number.isFinite(fps) && Number.isFinite(frameMs) && frameMs >= 0) frameSamples.push({ fps, frameMs });
    samplePeaks.enemies = Math.max(samplePeaks.enemies, Number(enemies) || 0);
    samplePeaks.projectiles = Math.max(samplePeaks.projectiles, Number(projectiles) || 0);
    samplePeaks.hazards = Math.max(samplePeaks.hazards, Number(hazards) || 0);
    applyToBoth(t => {
      t.maxEnemies = Math.max(t.maxEnemies, Number(enemies) || 0);
      t.maxProjectiles = Math.max(t.maxProjectiles, Number(projectiles) || 0);
      t.maxHazards = Math.max(t.maxHazards, Number(hazards) || 0);
    });
    if (now - sampleStartAt < 30000) return;
    const fpsValues = frameSamples.map(x => x.fps).filter(v => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
    const frameValues = frameSamples.map(x => x.frameMs).filter(v => Number.isFinite(v) && v >= 0).sort((a, b) => a - b);
    const percentile = (arr, p) => arr.length ? arr[Math.min(arr.length - 1, Math.floor((arr.length - 1) * p))] : 0;
    emit('performance_sample', {
      sample_duration_sec: round((now - sampleStartAt) / 1000, 1),
      sample_count: frameSamples.length,
      fps_avg: round(fpsValues.reduce((a, b) => a + b, 0) / Math.max(1, fpsValues.length), 1),
      fps_min: round(fpsValues[0] || 0, 1),
      frame_time_p95_ms: round(percentile(frameValues, 0.95), 1),
      frame_time_max_ms: round(frameValues.at(-1) || 0, 1),
      enemies_peak: samplePeaks.enemies,
      projectiles_peak: samplePeaks.projectiles,
      hazards_peak: samplePeaks.hazards,
      viewport_width: Number(globalThis.window?.innerWidth) || 0,
      viewport_height: Number(globalThis.window?.innerHeight) || 0,
      device_pixel_ratio: round(Number(globalThis.window?.devicePixelRatio) || 1, 2),
      device_type: String(deviceInfo.device_type || 'unknown'),
      device_os: String(deviceInfo.device_os || 'unknown'),
      orientation: String(deviceInfo.orientation || 'unknown'),
    });
    frameSamples = [];
    samplePeaks = { enemies: 0, projectiles: 0, hazards: 0 };
    sampleStartAt = now;
  }
  function snapshot() {
    return {
      run_id: runId || '', final_wave: waveContext?.wave || 0, player_level: playerLevel,
      chassis: String(runContext.chassis || 'unknown'),       elapsed_sec: round(runStartedAt ? (Date.now() - runStartedAt) / 1000 : 0, 1),
      active_gameplay_sec: round(currentActiveRunMs() / 1000, 1),
      paused_elapsed_sec: round(currentPausedMs() / 1000, 1),
      enemies_killed: runTotals.kills,
      damage_dealt: round(runTotals.damageDealt), damage_by_weapon: compact(runTotals.damageByWeapon),
      damage_received: round(runTotals.damageReceived), damage_taken_by_source: compact(runTotals.damageTakenBySource),
      healing: round(runTotals.healing), xp_generated: round(runTotals.xpGenerated),
      xp_collected: round(runTotals.xpCollected), xp_expired: round(runTotals.xpExpired),
      xp_generated_by_source: compact(runTotals.xpGeneratedBySource),
      xp_collected_by_source: compact(runTotals.xpCollectedBySource),
      xp_expired_by_source: compact(runTotals.xpExpiredBySource),
      scrap_earned: round(runTotals.scrapEarned), scrap_spent: round(runTotals.scrapSpent),
      enemies_spawned_by_type: compact(runTotals.enemiesSpawned), enemies_killed_by_type: compact(runTotals.enemiesKilled),
    };
  }
  return {
    startRun, startWave, completeWave, failLevel, endRun, pause, resume, achievement, setPhase, setPlayerLevel,
    event, enemySpawned, enemyKilled, enemyAttack, damageDealt, damageReceived, healed,
    xpGenerated, xpCollected, xpExpired, scrapEarned, scrapSpent,
    upgradeOffered, upgradeSelected, buildSnapshot, arenaEventStarted, arenaEventCompleted, arenaEventFailed,
    performanceSample, snapshot,
    get runId() { return runId; },
    get isRunActive() { return !runFinalized && !!runId; },
    get isPaused() { return lifecyclePaused; },
  };
}
