const BRIDGE_INIT_TIMEOUT_MS = 15000;
const MAX_EVENT_STRING_LENGTH = 800;

function withTimeout(promise, timeoutMs, label) {
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs); }),
  ]).finally(() => { if (timer) clearTimeout(timer); });
}

function toFlatAnalyticsData(input = {}) {
  const output = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string') output[key] = value.slice(0, MAX_EVENT_STRING_LENGTH);
    else if (typeof value === 'number' && Number.isFinite(value)) output[key] = value;
    else if (typeof value === 'boolean') output[key] = value;
    else {
      try {
        output[key] = JSON.stringify(value).slice(0, MAX_EVENT_STRING_LENGTH);
      } catch {
        output[key] = String(value).slice(0, MAX_EVENT_STRING_LENGTH);
      }
    }
  }
  return output;
}

export function createPlaygamaRuntime(win = globalThis.window, options = {}) {
  const rewardedTimeoutMs = Math.max(1000, Number(options.rewardedTimeoutMs) || 120000);
  const rewardedPollMs = Math.max(50, Number(options.rewardedPollMs) || 500);
  let bridge = win?.bridge || null;
  let ready = false;
  let initialized = false;
  let pauseHandlerBound = false;
  let audioHandlerBound = false;
  let interstitialStateHandlerBound = false;
  let storageQueue = Promise.resolve();

  async function initialize(explicitInitResult = null) {
    if (initialized) return { ready, bridge: ready ? bridge : null };
    initialized = true;
    bridge = win?.bridge || bridge;

    // Bridge is initialized by the classic bootstrap in index.html before the
    // ES module executes. This runtime adopts that result and never initializes twice.
    if (explicitInitResult?.attempted === true) {
      bridge = explicitInitResult.bridge || bridge;
      ready = explicitInitResult.succeeded === true && !!bridge;
      if (ready && typeof bridge?.advertisement?.setMinimumDelayBetweenInterstitial === 'function') {
        try { bridge.advertisement.setMinimumDelayBetweenInterstitial(60); }
        catch (error) { console.warn('[Playgama Ads] Could not set interstitial delay:', error); }
      }
      return { ready, bridge: ready ? bridge : null };
    }

    if (!bridge || typeof bridge.initialize !== 'function') {
      return { ready: false, bridge: null };
    }
    try {
      await withTimeout(Promise.resolve(bridge.initialize()), BRIDGE_INIT_TIMEOUT_MS, 'Playgama Bridge initialization');
      ready = true;
    } catch (error) {
      console.warn('[Playgama Bridge] Initialization unavailable; running standalone:', error);
      ready = false;
    }
    return { ready, bridge: ready ? bridge : null };
  }

  function isReady() {
    return ready && !!bridge;
  }

  function platformLanguage() {
    if (!isReady()) return '';
    return String(bridge?.platform?.language || '').toLowerCase();
  }

  function platformAudioEnabled() {
    if (!isReady()) return true;
    return bridge?.platform?.isAudioEnabled !== false;
  }

  function sendMessage(name, params) {
    if (!isReady() || typeof bridge?.platform?.sendMessage !== 'function') return false;
    try {
      const result = params && Object.keys(params).length
        ? bridge.platform.sendMessage(name, params)
        : bridge.platform.sendMessage(name);
      Promise.resolve(result).catch(error => console.warn(`[Playgama Bridge] ${name} failed:`, error));
      return true;
    } catch (error) {
      console.warn(`[Playgama Bridge] ${name} failed:`, error);
      return false;
    }
  }

  function sendAnalytics(name, data = {}) {
    if (!isReady() || typeof bridge?.analytics?.send !== 'function') return false;
    // YouTube Playables explicitly disallows outgoing analytics/network calls.
    // The Bridge remains initialized for the platform integration, but custom
    // game telemetry is intentionally disabled for this destination.
    const platformId = String(bridge?.platform?.id || '').toLowerCase();
    if (platformId === 'youtube' || platformId === 'youtube_playables') return false;
    try {
      bridge.analytics.send(name, toFlatAnalyticsData(data));
      return true;
    } catch (error) {
      console.warn(`[Playgama Analytics] ${name} failed:`, error);
      return false;
    }
  }

  function storageGet(keys) {
    if (!isReady() || typeof bridge?.storage?.get !== 'function') return Promise.resolve(keys.map(() => null));
    const requested = Array.isArray(keys) ? keys : [keys];
    return withTimeout(Promise.resolve(bridge.storage.get(requested)), 10000, 'Storage get').then(values => {
      if (Array.isArray(values)) return values;
      if (requested.length === 1) return [values ?? null];
      return requested.map(() => null);
    }).catch(error => {
      console.warn('[Playgama Storage] get failed:', error);
      return requested.map(() => null);
    });
  }

  function storageSet(keys, values) {
    if (!isReady() || typeof bridge?.storage?.set !== 'function') return Promise.resolve(false);
    const keyList = Array.isArray(keys) ? keys : [keys];
    const valueList = Array.isArray(values) ? values : [values];
    const operation = storageQueue.then(() => withTimeout(Promise.resolve(bridge.storage.set(keyList, valueList)), 12000, 'Storage set'));
    storageQueue = operation.catch(() => undefined);
    return operation.then(() => true).catch(error => {
      console.warn('[Playgama Storage] set failed:', error);
      return false;
    });
  }

  function onPause(callback) {
    if (!isReady() || pauseHandlerBound || typeof callback !== 'function') return false;
    const eventName = bridge?.EVENT_NAME?.PAUSE_STATE_CHANGED;
    if (!eventName || typeof bridge?.platform?.on !== 'function') return false;
    try {
      bridge.platform.on(eventName, value => callback(Boolean(value)));
      pauseHandlerBound = true;
      return true;
    } catch (error) {
      console.warn('[Playgama Bridge] Pause listener failed:', error);
      return false;
    }
  }

  function onAudioState(callback) {
    if (!isReady() || audioHandlerBound || typeof callback !== 'function') return false;
    const eventName = bridge?.EVENT_NAME?.AUDIO_STATE_CHANGED;
    if (!eventName || typeof bridge?.platform?.on !== 'function') return false;
    try {
      bridge.platform.on(eventName, value => callback(Boolean(value)));
      audioHandlerBound = true;
      return true;
    } catch (error) {
      console.warn('[Playgama Bridge] Audio listener failed:', error);
      return false;
    }
  }

  function onInterstitialState(callback) {
    if (!isReady() || interstitialStateHandlerBound || typeof callback !== 'function') return false;
    const eventName = bridge?.EVENT_NAME?.INTERSTITIAL_STATE_CHANGED;
    if (!eventName || typeof bridge?.advertisement?.on !== 'function') return false;
    try {
      bridge.advertisement.on(eventName, value => {
        const state = String(value?.state || value || '').toLowerCase();
        callback(state);
      });
      interstitialStateHandlerBound = true;
      return true;
    } catch (error) {
      console.warn('[Playgama Bridge] Interstitial state listener failed:', error);
      return false;
    }
  }

  function isRewardedSupported() {
    return isReady() && bridge?.advertisement?.isRewardedSupported === true;
  }

  function isInterstitialSupported() {
    return isReady() && bridge?.advertisement?.isInterstitialSupported === true;
  }

  function getRewardedPlacement(fallback = '') {
    const current = bridge?.advertisement?.rewardedPlacement;
    return typeof current === 'string' && current.trim() ? current.trim() : String(fallback || '');
  }

  function showRewarded(placement) {
    const requestedPlacement = String(placement || getRewardedPlacement('revive'));
    if (!isRewardedSupported() || typeof bridge?.advertisement?.showRewarded !== 'function') {
      return Promise.resolve({ rewarded: false, state: 'unsupported', placement: requestedPlacement });
    }
    const eventName = bridge?.EVENT_NAME?.REWARDED_STATE_CHANGED;
    return new Promise(resolve => {
      let settled = false;
      let observedActiveState = false;
      let listener = null;
      let pollTimer = null;
      let hardTimeout = null;
      const finish = state => {
        if (settled) return;
        settled = true;
        if (pollTimer) clearInterval(pollTimer);
        if (hardTimeout) clearTimeout(hardTimeout);
        try {
          if (eventName && listener && typeof bridge.advertisement.off === 'function') {
            bridge.advertisement.off(eventName, listener);
          }
        } catch { /* listener cleanup is best-effort */ }
        resolve({
          rewarded: state === 'rewarded',
          state,
          placement: getRewardedPlacement(requestedPlacement),
        });
      };
      const normalizeState = value => String(value?.state || value || '').toLowerCase();
      const inspectPolledState = value => {
        const normalized = normalizeState(value);
        if (normalized === 'loading' || normalized === 'opened') {
          observedActiveState = true;
          return;
        }
        // Polling may see a stale terminal state from a previous request. Only
        // accept it after this request has entered loading/opened.
        if (observedActiveState && ['rewarded', 'closed', 'failed'].includes(normalized)) finish(normalized);
      };
      if (eventName && typeof bridge?.advertisement?.on === 'function') {
        listener = value => {
          const normalized = normalizeState(value);
          if (normalized === 'loading' || normalized === 'opened') observedActiveState = true;
          // Event callbacks are subscribed immediately before showRewarded(). A
          // terminal event delivered here belongs to the active request.
          if (['rewarded', 'closed', 'failed'].includes(normalized)) finish(normalized);
        };
        try { bridge.advertisement.on(eventName, listener); }
        catch (error) { console.warn('[Playgama Ads] Rewarded state listener failed:', error); listener = null; }
      }
      pollTimer = setInterval(() => inspectPolledState(bridge?.advertisement?.rewardedState), rewardedPollMs);
      hardTimeout = setTimeout(() => finish('timeout'), rewardedTimeoutMs);
      try {
        // Keep the SDK invocation synchronous with the player's click/tap. Do not
        // await or schedule anything between the input event and this call.
        const sdkResult = bridge.advertisement.showRewarded(requestedPlacement);
        Promise.resolve(sdkResult).catch(error => {
          console.warn('[Playgama Ads] Rewarded failed:', error);
          finish('failed');
        });
      } catch (error) {
        console.warn('[Playgama Ads] Rewarded failed:', error);
        finish('failed');
      }
    });
  }

  async function showInterstitial(placement) {
    if (!isInterstitialSupported() || typeof bridge.advertisement.showInterstitial !== 'function') return false;
    try {
      await bridge.advertisement.showInterstitial(placement);
      return true;
    } catch (error) {
      console.warn('[Playgama Ads] Interstitial failed:', error);
      return false;
    }
  }

  function getLeaderboardType() {
    return isReady() ? String(bridge?.leaderboards?.type || 'not_available') : 'not_available';
  }

  function getLeaderboardDiagnostics() {
    const leaderboardApi = bridge?.leaderboards || null;
    return {
      bridgeReady: isReady(),
      platformId: getPlatformId(),
      type: getLeaderboardType(),
      getEntriesAvailable: typeof leaderboardApi?.getEntries === 'function',
      setScoreAvailable: typeof leaderboardApi?.setScore === 'function',
    };
  }

  async function getLeaderboardEntries(id) {
    if (!isReady() || typeof bridge?.leaderboards?.getEntries !== 'function') {
      throw new Error('Leaderboard entries are unavailable in this runtime.');
    }
    if (getLeaderboardType() !== 'in_game') {
      throw new Error(`getEntries requires leaderboard type in_game (current: ${getLeaderboardType()}).`);
    }
    try {
      const entries = await withTimeout(
        Promise.resolve(bridge.leaderboards.getEntries(String(id || ''))),
        12000,
        'Leaderboard getEntries'
      );
      return Array.isArray(entries) ? entries : [];
    } catch (error) {
      console.warn('[Playgama Leaderboards] getEntries failed:', error);
      throw error;
    }
  }

  async function submitScore(id, score) {
    const leaderboardId = String(id || '').trim();
    const numericScore = Number(score);
    if (!isReady() || typeof bridge?.leaderboards?.setScore !== 'function') return false;
    if (!leaderboardId || !Number.isFinite(numericScore) || numericScore <= 0) return false;
    if (getLeaderboardType() === 'not_available') return false;
    try {
      await withTimeout(
        Promise.resolve(bridge.leaderboards.setScore(leaderboardId, Math.floor(numericScore))),
        10000,
        'Leaderboard setScore'
      );
      return true;
    } catch (error) {
      console.warn('[Playgama Leaderboards] setScore failed:', error);
      return false;
    }
  }

  function isAuthorizationSupported() {
    return isReady() && bridge?.player?.isAuthorizationSupported === true;
  }

  function isPlayerAuthorized() {
    return isReady() && bridge?.player?.isAuthorized === true;
  }

  function getPlayerProfile() {
    if (!isReady() || !bridge?.player) return { id: null, name: null, photos: [] };
    const photos = Array.isArray(bridge.player.photos) ? bridge.player.photos : [];
    return {
      id: bridge.player.id == null ? null : String(bridge.player.id),
      name: bridge.player.name == null ? null : String(bridge.player.name),
      photos: photos.filter(photo => typeof photo === 'string' && /^https?:\/\//i.test(photo)),
    };
  }

  function authorizePlayer(options = {}) {
    if (!isReady() || typeof bridge?.player?.authorize !== 'function') {
      return Promise.reject(new Error('Player authorization is unavailable.'));
    }
    if (!isAuthorizationSupported()) {
      return Promise.reject(new Error('This platform does not support player authorization.'));
    }
    try {
      // Keep this call synchronous with the explicit Login button click so the
      // platform can open its authorization UI from a user gesture.
      const authorization = bridge.player.authorize(options || {});
      return withTimeout(Promise.resolve(authorization), 30000, 'Player authorization').then(() => ({
        authorized: isPlayerAuthorized(),
        profile: getPlayerProfile(),
      }));
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async function unlockAchievement(id) {
    if (!isReady() || typeof bridge?.achievements?.unlock !== 'function') return false;
    try {
      await bridge.achievements.unlock(id);
      return true;
    } catch (error) {
      console.warn(`[Playgama Achievements] ${id} failed:`, error);
      return false;
    }
  }

  async function getRemoteConfig(defaults = {}) {
    // Current Bridge docs list Yandex as the only supported Remote Config host.
    if (!isReady() || bridge?.remoteConfig?.isSupported !== true || typeof bridge.remoteConfig.get !== 'function') {
      return { ...defaults, _remote_config_supported: false };
    }
    try {
      const remote = await withTimeout(Promise.resolve(bridge.remoteConfig.get()), 4000, 'Remote Config');
      return { ...defaults, ...(remote && typeof remote === 'object' ? remote : {}), _remote_config_supported: true };
    } catch (error) {
      console.warn('[Playgama Remote Config] Using local defaults:', error);
      return { ...defaults, _remote_config_supported: true, _remote_config_error: true };
    }
  }

  function getPlatformId() {
    return isReady() ? String(bridge?.platform?.id || 'unknown') : 'standalone';
  }

  function getDeviceInfo() {
    if (!isReady()) return { device_type: 'unknown', device_os: 'unknown', orientation: 'unknown' };
    const device = bridge?.device || {};
    return {
      device_type: String(device.type || 'unknown').slice(0, 24),
      device_os: String(device.os || 'unknown').slice(0, 24),
      orientation: String(device.orientation || 'unknown').slice(0, 16),
    };
  }

  return {
    initialize, isReady, platformLanguage, platformAudioEnabled, getPlatformId, getDeviceInfo,
    sendMessage, sendAnalytics, storageGet, storageSet, onPause, onAudioState,
    isRewardedSupported, isInterstitialSupported, onInterstitialState, showRewarded, getRewardedPlacement, showInterstitial,
    submitScore, getLeaderboardType, getLeaderboardDiagnostics, getLeaderboardEntries, unlockAchievement, getRemoteConfig,
    isAuthorizationSupported, isPlayerAuthorized, getPlayerProfile, authorizePlayer,
    get bridge() { return bridge; },
  };
}

export { toFlatAnalyticsData };
