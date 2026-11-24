import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const runtimeSource = fs.readFileSync(path.join(root, 'src/game/playgama-runtime.js'), 'utf8');
const telemetrySource = fs.readFileSync(path.join(root, 'src/game/telemetry.js'), 'utf8');
const bridgeConfig = JSON.parse(fs.readFileSync(path.join(root, 'playgama-bridge-config.json'), 'utf8'));
const publicConfig = JSON.parse(fs.readFileSync(path.join(root, 'public/playgama-bridge-config.json'), 'utf8'));

test('Bridge CDN and a classic bootstrap execute before the game ES module', () => {
  const bridgeScriptIndex = indexHtml.indexOf('https://bridge.playgama.com/v2/stable/playgama-bridge.js');
  const bootstrapOpen = indexHtml.indexOf('<script id="playgama-bridge-bootstrap">');
  const bootstrapClose = indexHtml.indexOf('</script>', bootstrapOpen);
  const moduleIndex = indexHtml.indexOf('<script type="module">');
  assert.ok(bridgeScriptIndex >= 0 && bridgeScriptIndex < bootstrapOpen);
  assert.ok(bootstrapOpen >= 0 && bootstrapOpen < bootstrapClose && bootstrapClose < moduleIndex);
  assert.ok(indexHtml.slice(0, moduleIndex).includes('<head>'));
  assert.doesNotMatch(indexHtml.slice(bootstrapOpen, bootstrapClose), /type="module"/);
});

test('classic bootstrap initializes Bridge independently before module imports', () => {
  const bootstrapOpen = indexHtml.indexOf('<script id="playgama-bridge-bootstrap">');
  const bootstrapClose = indexHtml.indexOf('</script>', bootstrapOpen);
  const bootstrap = indexHtml.slice(bootstrapOpen, bootstrapClose);
  const moduleCode = indexHtml.slice(indexHtml.indexOf('<script type="module">'));
  assert.match(bootstrap, /window\.playgamaBridgeReady\s*=\s*\(async\s*\(\)\s*=>/);
  assert.match(bootstrap, /await\s+window\.bridge\.initialize\(\)/);
  assert.match(moduleCode, /await\s+window\.playgamaBridgeReady/);
  assert.doesNotMatch(moduleCode, /await\s+window\.bridge\.initialize\(\)/);
  assert.ok(indexHtml.indexOf('window.playgamaBridgeReady') < indexHtml.indexOf('<script type="module">'));
});

test('runtime adopts classic bootstrap result and never initializes Bridge twice', () => {
  assert.match(runtimeSource, /explicitInitResult\?\.attempted\s*===\s*true/);
  assert.match(runtimeSource, /explicitInitResult\.succeeded\s*===\s*true/);
  assert.match(runtimeSource, /setMinimumDelayBetweenInterstitial\(60\)/);
  assert.equal((runtimeSource.match(/\.initialize\(\)/g) || []).length, 1, 'runtime retains only its standalone fallback initializer');
});

test('archive paths are relative so imports and sprites resolve under a nested Playgama URL', () => {
  assert.match(indexHtml, /from '\.\/src\/game\//);
  assert.doesNotMatch(indexHtml, /from '\/src\/game\//);
  assert.doesNotMatch(indexHtml, /:\s*'\/assets\//);
  assert.match(fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8'), /base:\s*'\.\/'/);
});

test('published game code does not use browser local persistence APIs', () => {
  const sources = [indexHtml, runtimeSource, telemetrySource];
  for (const source of sources) {
    assert.doesNotMatch(source, /\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b|document\.cookie/);
  }
  const publicAssets = fs.readdirSync(path.join(root, 'public/assets/aistudio'));
  assert.ok(publicAssets.length >= 8, 'gameplay sprite assets must remain in the public build');
  assert.ok(publicAssets.every(name => name.endsWith('.png')), 'old prototype HTML must not ship as a public asset');
});

test('official lifecycle messages are present and legacy names are absent', () => {
  for (const name of ['game_ready', 'level_started', 'level_completed', 'level_failed', 'level_paused', 'level_resumed', 'player_got_achievement']) {
    assert.ok(indexHtml.includes(`'${name}'`) || telemetrySource.includes(`'${name}'`), `missing ${name}`);
  }
  assert.doesNotMatch(indexHtml + telemetrySource, /'game_start'|'game_stop'|'gameplay_started'|'gameplay_stopped'/);
  assert.match(indexHtml, /requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => \{/);
});

test('Bridge config is identical at project root and public build path', () => {
  assert.deepEqual(publicConfig, bridgeConfig);
  assert.equal(bridgeConfig.$schema, 'https://bridge.playgama.com/v2/stable/schema.json');
  assert.equal(bridgeConfig.sendAnalyticsEvents, true);
  assert.equal(bridgeConfig.platforms.youtube.sendAnalyticsEvents, false);
  assert.equal(bridgeConfig.platforms.facebook.sendAnalyticsEvents, false);
  assert.equal(bridgeConfig.platforms.yandex.sendAnalyticsEvents, false);
});

test('Bridge config uses documented v2 placement IDs for rewarded and interstitial ads', () => {
  assert.deepEqual(publicConfig, bridgeConfig);
  assert.equal(bridgeConfig.$schema, 'https://bridge.playgama.com/v2/stable/schema.json');
  assert.equal(bridgeConfig.sendAnalyticsEvents, true);
  assert.equal(bridgeConfig.platforms.youtube.sendAnalyticsEvents, false);
  assert.equal(bridgeConfig.platforms.facebook.sendAnalyticsEvents, false);
  assert.equal(bridgeConfig.platforms.yandex.sendAnalyticsEvents, false);
  const interstitial = bridgeConfig.advertisement.interstitial;
  const rewarded = bridgeConfig.advertisement.rewarded;
  assert.equal(typeof interstitial.preloadOnStart, 'string');
  assert.equal(typeof rewarded.preloadOnStart, 'string');
  assert.equal(interstitial.preloadOnStart, 'game_over');
  assert.equal(interstitial.placements.some(x => x.id === 'level_completed'), false);
  assert.equal(interstitial.placements.some(x => x.id === 'game_over'), true);
  assert.equal(interstitial.placements.some(x => x.id === 'return_to_menu'), true);
  assert.equal(rewarded.placements.some(x => x.id === 'revive'), true);
  assert.equal(rewarded.placements.some(x => x.id === 'double_scrap'), true);
  assert.equal(rewarded.placements.some(x => x.id === rewarded.preloadOnStart), true);
  assert.equal(bridgeConfig.advertisement.minimumDelayBetweenInterstitial, 60);
});

test('reward code invokes Bridge from the click path and grants only on rewarded state', () => {
  assert.match(runtimeSource, /bridge\.advertisement\.showRewarded\(requestedPlacement\)/);
  assert.match(runtimeSource, /rewarded: state === 'rewarded'/);
  assert.match(runtimeSource, /getRewardedPlacement/);
  assert.match(indexHtml, /showRewardedAd\('revive'\)/);
  assert.match(indexHtml, /showRewardedAd\('double_scrap'\)/);
  assert.match(indexHtml, /result\.rewarded && result\.placement === 'revive'/);
  assert.match(indexHtml, /!result\.rewarded \|\| result\.placement !== 'double_scrap'/);
  assert.match(indexHtml, /Bridge showRewarded is invoked synchronously/);
  assert.doesNotMatch(indexHtml, /onRewarded\(true\)/);
});


test('game module contains no invalid async-let syntax and rewarded controls are wired', () => {
  assert.doesNotMatch(indexHtml, /\basync\s+let\b/, 'async let is not valid JavaScript syntax');
  assert.match(indexHtml, /let rewardedRequestInProgress = false/);
  assert.match(indexHtml, /id=\"btn-revive-ad\"[^>]*onclick=\"reviveWithAd\(\)\"/);
  assert.match(indexHtml, /id=\"btn-double-scrap\"[^>]*onclick=\"claimDoubleScrap\(\)\"/);
  assert.match(indexHtml, /window\.reviveWithAd\s*=/);
  assert.match(indexHtml, /window\.claimDoubleScrap\s*=/);
});

test('root index.html exposes the classic Bridge initialize call for archive validation', () => {
  assert.match(indexHtml, /await\s+window\.bridge\.initialize\(\)/);
  assert.match(indexHtml, /<script src=\"https:\/\/bridge\.playgama\.com\/v2\/stable\/playgama-bridge\.js\"><\/script>/);
});


test('continuous wave transitions never request interstitial ads', () => {
  const start = indexHtml.indexOf('function trackPlaygamaWaveCompleted(');
  const end = indexHtml.indexOf('function startTelemetryRun(', start);
  const waveCompleted = indexHtml.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(waveCompleted, /showInterstitialSafe|requestInterstitialForRun/);
  assert.match(waveCompleted, /Waves flow continuously/);
});

test('interstitial calls are locked and throttled to avoid repeated host overlays', () => {
  assert.match(indexHtml, /let interstitialRequestInProgress = false/);
  assert.match(indexHtml, /INTERSTITIAL_APP_COOLDOWN_MS = 60000/);
  assert.match(indexHtml, /reason: 'another_ad_in_progress'/);
  assert.match(indexHtml, /reason: 'application_cooldown'/);
  assert.match(indexHtml, /void showInterstitialSafe\(placement\)/);
});

test('external pause and document visibility are independent, idempotent pause sources', () => {
  assert.match(indexHtml, /let platformPauseRequested = false/);
  assert.match(indexHtml, /let documentVisibilityPaused = Boolean\(document\.hidden\)/);
  assert.match(indexHtml, /function synchronizeExternalPause\(/);
  assert.match(indexHtml, /externalPauseOwnsGameplayState/);
  assert.match(indexHtml, /synchronizeExternalPause\('visibility'\)/);
  assert.match(indexHtml, /synchronizeExternalPause\('platform'\)/);
  assert.doesNotMatch(indexHtml, /platformPauseActive|window\.pauseGame\(true\)/);
});

test('main game loop uses a single guarded animation-frame scheduler', () => {
  assert.match(indexHtml, /function scheduleGameLoop\(\)/);
  assert.match(indexHtml, /if \(state !== 'PLAYING' \|\| gameLoopRafId\) return false/);
  assert.match(indexHtml, /function cancelScheduledGameLoop\(\)/);
  assert.match(indexHtml, /gameLoopRafId = 0;\s*if \(state !== 'PLAYING'\) return;/);
  assert.equal((indexHtml.match(/requestAnimationFrame\(loop\)/g) || []).length, 1);
});
