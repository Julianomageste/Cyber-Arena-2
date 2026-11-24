import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlaygamaRuntime, toFlatAnalyticsData } from './playgama-runtime.js';

function makeBridge(overrides = {}) {
  const calls = { messages: [], analytics: [], storageGets: [], storageSets: [], achievements: [], scores: [], leaderboardQueries: [], authorizations: [] };
  const platformListeners = new Map();
  const adListeners = new Map();
  const bridge = {
    EVENT_NAME: {
      PAUSE_STATE_CHANGED: 'pause',
      AUDIO_STATE_CHANGED: 'audio',
      REWARDED_STATE_CHANGED: 'rewarded-state',
      INTERSTITIAL_STATE_CHANGED: 'interstitial-state',
    },
    initialize: async () => true,
    platform: {
      id: 'playgama', language: 'pt-br', isAudioEnabled: true,
      sendMessage: (...args) => { calls.messages.push(args); },
      on: (event, callback) => platformListeners.set(event, callback),
    },
    device: { type: 'desktop', os: 'windows', orientation: 'landscape' },
    analytics: { send: (name, data) => calls.analytics.push({ name, data }) },
    storage: {
      get: async keys => { calls.storageGets.push(keys); return keys.map(key => ({ [key]: `value:${key}` })[key]); },
      set: async (keys, values) => { calls.storageSets.push({ keys, values }); },
    },
    advertisement: {
      isRewardedSupported: true,
      isInterstitialSupported: true,
      rewardedState: 'opened',
      on: (event, callback) => adListeners.set(event, callback),
      off: (event, callback) => { if (adListeners.get(event) === callback) adListeners.delete(event); },
      showRewarded: async () => true,
      showInterstitial: async () => true,
    },
    player: { isAuthorizationSupported: true, isAuthorized: false, id: 'player-1', name: 'Test Player', photos: [], authorize: async options => { calls.authorizations.push(options); bridge.player.isAuthorized = true; } },
    leaderboards: { type: 'in_game', setScore: async (id, score) => calls.scores.push({ id, score }), getEntries: async id => { calls.leaderboardQueries.push(id); return [{ id: 'p1', name: 'Player One', photo: '', score: 125, rank: 1 }]; } },
    achievements: { unlock: async id => calls.achievements.push(id) },
    ...overrides,
  };
  return { bridge, calls, platformListeners, adListeners };
}

test('initializes Bridge before exposing platform APIs and reads device metadata', async () => {
  const { bridge, calls } = makeBridge();
  const runtime = createPlaygamaRuntime({ bridge });
  const result = await runtime.initialize();
  assert.equal(result.ready, true);
  assert.equal(runtime.isReady(), true);
  assert.equal(runtime.platformLanguage(), 'pt-br');
  assert.equal(runtime.getPlatformId(), 'playgama');
  assert.deepEqual(runtime.getDeviceInfo(), { device_type: 'desktop', device_os: 'windows', orientation: 'landscape' });
  runtime.sendMessage('game_ready');
  assert.deepEqual(calls.messages[0], ['game_ready']);
});

test('exposes player authorization support and calls authorize from the app action', async () => {
  const { bridge, calls } = makeBridge();
  const runtime = createPlaygamaRuntime({ bridge });
  await runtime.initialize();
  assert.equal(runtime.isAuthorizationSupported(), true);
  assert.equal(runtime.isPlayerAuthorized(), false);
  const result = await runtime.authorizePlayer({});
  assert.deepEqual(calls.authorizations, [{}]);
  assert.equal(result.authorized, true);
  assert.equal(result.profile.id, 'player-1');
  assert.equal(result.profile.name, 'Test Player');
  assert.equal(runtime.isPlayerAuthorized(), true);
});

test('does not invoke authorization on platforms that do not support it', async () => {
  let authorizeCalls = 0;
  const { bridge } = makeBridge({ player: {
    isAuthorizationSupported: false, isAuthorized: false, id: null, name: null, photos: [],
    authorize: async () => { authorizeCalls += 1; },
  } });
  const runtime = createPlaygamaRuntime({ bridge });
  await runtime.initialize();
  assert.equal(runtime.isAuthorizationSupported(), false);
  await assert.rejects(runtime.authorizePlayer({}), /does not support/);
  assert.equal(authorizeCalls, 0);
});

test('requests leaderboard entries by configured id when in-game leaderboard is active', async () => {
  const { bridge, calls } = makeBridge();
  const runtime = createPlaygamaRuntime({ bridge });
  await runtime.initialize();
  assert.equal(runtime.getLeaderboardType(), 'in_game');
  const entries = await runtime.getLeaderboardEntries('survival_time');
  assert.deepEqual(calls.leaderboardQueries, ['survival_time']);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].score, 125);
});

test('does not request getEntries when leaderboard type is not in_game', async () => {
  const { bridge, calls } = makeBridge({ leaderboards: {
    type: 'native',
    setScore: async () => {},
    getEntries: async id => { calls.leaderboardQueries.push(id); return []; },
  } });
  const runtime = createPlaygamaRuntime({ bridge });
  await runtime.initialize();
  await assert.rejects(runtime.getLeaderboardEntries('survival_time'), /requires leaderboard type in_game/);
  assert.deepEqual(calls.leaderboardQueries, []);
});

test('uses Bridge Storage batch signatures and preserves key/value order', async () => {
  const { bridge, calls } = makeBridge();
  const runtime = createPlaygamaRuntime({ bridge });
  await runtime.initialize();
  const values = await runtime.storageGet(['hangar', 'settings']);
  assert.deepEqual(calls.storageGets, [['hangar', 'settings']]);
  assert.deepEqual(values, ['value:hangar', 'value:settings']);
  assert.equal(await runtime.storageSet(['hangar', 'settings'], ['a', 'b']), true);
  assert.deepEqual(calls.storageSets[0], { keys: ['hangar', 'settings'], values: ['a', 'b'] });
});

test('does not grant rewarded-ad reward until the Bridge reports rewarded', async () => {
  const { bridge, adListeners } = makeBridge();
  const runtime = createPlaygamaRuntime({ bridge }, { rewardedTimeoutMs: 1100, rewardedPollMs: 50 });
  await runtime.initialize();
  const promise = runtime.showRewarded('revive');
  setTimeout(() => adListeners.get('rewarded-state')?.('loading'), 5);
  setTimeout(() => adListeners.get('rewarded-state')?.('rewarded'), 10);
  const result = await promise;
  assert.deepEqual(result, { rewarded: true, state: 'rewarded', placement: 'revive' });
});

test('closed rewarded-ad flow returns no reward', async () => {
  const { bridge, adListeners } = makeBridge();
  const runtime = createPlaygamaRuntime({ bridge }, { rewardedTimeoutMs: 1100, rewardedPollMs: 50 });
  await runtime.initialize();
  const promise = runtime.showRewarded('double_scrap');
  setTimeout(() => adListeners.get('rewarded-state')?.('opened'), 5);
  setTimeout(() => adListeners.get('rewarded-state')?.('closed'), 10);
  const result = await promise;
  assert.deepEqual(result, { rewarded: false, state: 'closed', placement: 'double_scrap' });
});

test('resolving showRewarded alone does not grant reward', async () => {
  const { bridge } = makeBridge();
  const runtime = createPlaygamaRuntime({ bridge }, { rewardedTimeoutMs: 1000, rewardedPollMs: 100 });
  await runtime.initialize();
  const result = await runtime.showRewarded('revive');
  assert.deepEqual(result, { rewarded: false, state: 'timeout', placement: 'revive' });
});

test('flattens Analytics event values to primitive fields', () => {
  const flattened = toFlatAnalyticsData({ name: 'test', amount: 3, active: true, meta: { wave: 4 } });
  assert.deepEqual(flattened, { name: 'test', amount: 3, active: true, meta: '{"wave":4}' });
});


test('does not send custom telemetry to YouTube Playables', async () => {
  const calls = { analytics: [] };
  const { bridge } = makeBridge({
    platform: {
      id: 'youtube', language: 'en', isAudioEnabled: true,
      sendMessage() {}, on() {},
    },
    analytics: { send: (name, data) => calls.analytics.push({ name, data }) },
  });
  const runtime = createPlaygamaRuntime({ bridge });
  await runtime.initialize();
  assert.equal(runtime.sendAnalytics('run_started', { wave: 1 }), false);
  assert.equal(calls.analytics.length, 0);
});


test('ignores a stale rewarded state from a previous ad request', async () => {
  const { bridge } = makeBridge({ advertisement: {
    isRewardedSupported: true, isInterstitialSupported: true, rewardedState: 'rewarded',
    on() {}, off() {}, showRewarded: async () => true, showInterstitial: async () => true,
  } });
  const runtime = createPlaygamaRuntime({ bridge }, { rewardedTimeoutMs: 1100, rewardedPollMs: 50 });
  await runtime.initialize();
  const result = await runtime.showRewarded('double_scrap');
  assert.deepEqual(result, { rewarded: false, state: 'timeout', placement: 'double_scrap' });
});


test('adopts a Bridge initialized explicitly by the root index without initializing twice', async () => {
  let initializeCalls = 0;
  const { bridge } = makeBridge({ initialize: async () => { initializeCalls += 1; } });
  const runtime = createPlaygamaRuntime({ bridge });
  const result = await runtime.initialize({ attempted: true, succeeded: true, bridge });
  assert.equal(result.ready, true);
  assert.equal(runtime.isReady(), true);
  assert.equal(initializeCalls, 0, 'runtime must not call initialize a second time');
});


test('calls showRewarded synchronously with the configured placement and returns the Bridge rewardedPlacement', async () => {
  const calls = [];
  let stateListener;
  const { bridge } = makeBridge({
    advertisement: {
      isRewardedSupported: true, isInterstitialSupported: true, rewardedState: 'closed', rewardedPlacement: 'revive',
      on: (event, callback) => { stateListener = callback; }, off() {},
      showRewarded: placement => {
        calls.push({ placement, immediate: true });
        bridge.advertisement.rewardedPlacement = placement;
        setTimeout(() => stateListener?.('loading'), 0);
        setTimeout(() => stateListener?.('rewarded'), 5);
      },
      showInterstitial: async () => true,
    },
  });
  const runtime = createPlaygamaRuntime({ bridge });
  await runtime.initialize();
  const pending = runtime.showRewarded('double_scrap');
  assert.deepEqual(calls, [{ placement: 'double_scrap', immediate: true }], 'SDK must be called before returning control to the event loop');
  const result = await pending;
  assert.deepEqual(result, { rewarded: true, state: 'rewarded', placement: 'double_scrap' });
  assert.equal(runtime.getRewardedPlacement(), 'double_scrap');
});


test('subscribes to interstitial state changes for diagnostics', async () => {
  const { bridge, adListeners } = makeBridge();
  const runtime = createPlaygamaRuntime({ bridge });
  await runtime.initialize();
  const seen = [];
  assert.equal(runtime.onInterstitialState(state => seen.push(state)), true);
  adListeners.get('interstitial-state')?.('opened');
  adListeners.get('interstitial-state')?.({ state: 'failed' });
  assert.deepEqual(seen, ['opened', 'failed']);
});


test('submits a whole-number time score to the configured leaderboard', async () => {
  const { bridge, calls } = makeBridge();
  const runtime = createPlaygamaRuntime({ bridge });
  await runtime.initialize();
  assert.equal(await runtime.submitScore('survival_time', 123.9), true);
  assert.deepEqual(calls.scores, [{ id: 'survival_time', score: 123 }]);
});

test('does not submit scores when leaderboard is unavailable', async () => {
  let submitted = false;
  const { bridge } = makeBridge({ leaderboards: { type: 'not_available', setScore: async () => { submitted = true; }, getEntries: async () => [] } });
  const runtime = createPlaygamaRuntime({ bridge });
  await runtime.initialize();
  assert.equal(await runtime.submitScore('survival_time', 120), false);
  assert.equal(submitted, false);
});


test('rejects zero and invalid leaderboard scores without calling the Bridge', async () => {
  const { bridge, calls } = makeBridge();
  const runtime = createPlaygamaRuntime({ bridge });
  await runtime.initialize();
  assert.equal(await runtime.submitScore('survival_time', 0), false);
  assert.equal(await runtime.submitScore('survival_time', Number.NaN), false);
  assert.deepEqual(calls.scores, []);
});


test('leaderboard diagnostics expose platform, mode and API availability', async () => {
  const { bridge } = makeBridge();
  const runtime = createPlaygamaRuntime({ bridge });
  await runtime.initialize();
  assert.deepEqual(runtime.getLeaderboardDiagnostics(), {
    bridgeReady: true,
    platformId: 'playgama',
    type: 'in_game',
    getEntriesAvailable: true,
    setScoreAvailable: true,
  });
});


test('getEntries SDK method is invoked synchronously before the returned promise settles', async () => {
  let callObserved = false;
  const { bridge, calls } = makeBridge({ leaderboards: {
    type: 'in_game',
    setScore: async () => {},
    getEntries: async id => { callObserved = true; calls.leaderboardQueries.push(id); return []; },
  } });
  const runtime = createPlaygamaRuntime({ bridge });
  await runtime.initialize();
  const request = runtime.getLeaderboardEntries('survival_time');
  assert.equal(callObserved, true, 'bridge.leaderboards.getEntries must be called synchronously');
  await request;
  assert.deepEqual(calls.leaderboardQueries, ['survival_time']);
});
