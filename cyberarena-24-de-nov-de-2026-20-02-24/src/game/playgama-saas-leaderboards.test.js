import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'playgama-bridge-config.json'), 'utf8'));
const publicConfig = JSON.parse(fs.readFileSync(path.join(root, 'public/playgama-bridge-config.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('SaaS leaderboard token is configured for Playgama and QA Tool', () => {
  assert.equal(config.saas?.publicToken, 'cmwlhbm030yzak00h71xnc8sm');
  assert.deepEqual(config.saas?.leaderboards?.platforms, ['playgama', 'qa_tool']);
  assert.deepEqual(publicConfig, config);
});

test('survival_time leaderboard id is configured and marked main', () => {
  assert.ok(config.leaderboards?.some(board => board.id === 'survival_time' && board.isMain === true));
});

test('visible login and World Ranking actions are present in the game UI', () => {
  assert.match(html, /id="player-auth-btn"[^>]*onclick="authorizePlayer\(\)"/);
  assert.match(html, /id="open-world-ranking-btn"[^>]*onclick="openWorldRanking\(\)"/);
  assert.match(html, /id="world-ranking-screen"/);
});

test('opening the in-game ranking calls getEntries with the configured id', () => {
  assert.match(html, /getLeaderboardEntries\(SURVIVAL_TIME_LEADERBOARD_ID\)/);
  assert.match(html, /const SURVIVAL_TIME_LEADERBOARD_ID = 'survival_time'/);
});

test('Time leaderboard submits survival seconds instead of best wave', () => {
  assert.match(html, /submitLeaderboardScore\(finalLeaderboardScore\)/);
  assert.match(html, /playgamaRuntime\.submitScore\(SURVIVAL_TIME_LEADERBOARD_ID, numericScore\)/);
});


test('leaderboard screen presents the current-player card and table headings', () => {
  assert.match(html, /id="world-ranking-player-record"/);
  assert.match(html, /id="world-ranking-player-hint"/);
  assert.match(html, /data-i18n="rankingPosition"/);
  assert.match(html, /data-i18n="rankingPlayer"/);
  assert.match(html, /data-i18n="rankingTime"/);
});

test('game-over screen provides direct access to the custom ranking UI', () => {
  assert.match(html, /id="go-world-ranking-btn"[^>]*onclick="openWorldRanking\(\)"/);
  assert.match(html, /id="go-leaderboard-status"/);
});

test('opening the ranking triggers a fresh platform entries request and displays an empty state', () => {
  assert.match(html, /void window\.refreshWorldRanking\(\)/);
  assert.match(html, /getLeaderboardEntries\(SURVIVAL_TIME_LEADERBOARD_ID\)/);
  assert.match(html, /Ainda não existem recordes registrados/);
});

test('leaderboard submission uses active gameplay seconds and records the result', () => {
  assert.match(html, /finalLeaderboardScore = Math\.floor\(Telemetry\.snapshot\(\)\.active_gameplay_sec \|\| 0\)/);
  assert.match(html, /leaderboard_score_submission/);
  assert.match(html, /submitLeaderboardScore\(finalLeaderboardScore\)/);
});


test('ranking click initiates getEntries before any asynchronous wait', () => {
  const start = html.indexOf('window.refreshWorldRanking = async function');
  const end = html.indexOf('/* ================= AUDIO', start);
  assert.ok(start >= 0 && end > start, 'refresh handler must exist');
  const handler = html.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const requestCall = handler.indexOf('playgamaRuntime.getLeaderboardEntries(SURVIVAL_TIME_LEADERBOARD_ID)');
  const firstAwait = handler.search(/\bawait\b/);
  assert.ok(requestCall >= 0, 'must request platform leaderboard entries');
  assert.ok(firstAwait < 0 || requestCall < firstAwait, 'getEntries must be initiated before the first await');
});

test('opening World Ranking returns the request initiated by the button action', () => {
  const start = html.indexOf('window.openWorldRanking = function');
  const end = html.indexOf('window.closeWorldRanking = function', start);
  assert.ok(start >= 0 && end > start, 'open handler must exist');
  const handler = html.slice(start, end);
  assert.match(handler, /return window\.refreshWorldRanking\('open_button'\)/);
});

test('ranking request records platform type and request source for QA diagnosis', () => {
  assert.match(html, /leaderboard_entries_request_started/);
  assert.match(html, /getLeaderboardDiagnostics\(\)/);
  assert.match(html, /platform_id: diagnostics\.platformId/);
  assert.match(html, /request_source: requestSource/);
});
