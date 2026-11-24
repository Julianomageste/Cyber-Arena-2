import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const match = html.match(/<script id="playgama-bridge-bootstrap">([\s\S]*?)<\/script>/);

function runBootstrap(bridge) {
  const logs = [];
  const context = {
    window: { bridge },
    console: {
      info: (...args) => logs.push(['info', ...args]),
      warn: (...args) => logs.push(['warn', ...args]),
      error: (...args) => logs.push(['error', ...args]),
    },
  };
  vm.runInNewContext(match[1], context);
  return { promise: context.window.playgamaBridgeReady, window: context.window, logs };
}

test('classic bootstrap initializes a loaded Bridge exactly once', async () => {
  let calls = 0;
  const bridge = { initialize: async () => { calls += 1; } };
  const { promise, window } = runBootstrap(bridge);
  const result = await promise;
  assert.equal(calls, 1);
  assert.equal(result.ready, true);
  assert.equal(result.bridge, bridge);
  assert.equal(window.playgamaBridge, bridge);
  assert.equal(bridge.gameVersion, '1.7.0');
});

test('classic bootstrap reports missing SDK without throwing', async () => {
  const { promise, window } = runBootstrap(null);
  const result = await promise;
  assert.equal(result.ready, false);
  assert.equal(result.bridge, null);
  assert.ok(result.error instanceof Error || result.error?.message);
  assert.equal(window.playgamaBridge, undefined);
});

test('classic bootstrap preserves initialization errors for diagnostics', async () => {
  const failure = new Error('mock initialization failure');
  const bridge = { initialize: async () => { throw failure; } };
  const { promise } = runBootstrap(bridge);
  const result = await promise;
  assert.equal(result.ready, false);
  assert.equal(result.error, failure);
});
