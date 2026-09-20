import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLocalReadArguments } from '../server/local-read-cli.mjs';

const roots = ['--dependencyRoot', '/private/tmp/install/node_modules', '--stateRoot', '/private/tmp/unit/state',
  '--protectedRoot', '/private/tmp/unit/protected', '--webRoot', '/private/tmp/unit/web'];
test('operator roots remain read-only by default; chat requires paired exact model and port', () => {
  assert.equal(parseLocalReadArguments(roots).chat, undefined);
  const config = parseLocalReadArguments([...roots, '--providerPort', '12345', '--model', 'lmstudio/exact/model']);
  assert.deepEqual(config.chat, { providerPort: 12345, model: 'lmstudio/exact/model' });
  assert.ok(Object.isFrozen(config) && Object.isFrozen(config.chat));
  for (const extra of [['--providerPort', '12345'], ['--model', 'lmstudio/x'],
    ['--providerPort', '0', '--model', 'lmstudio/x'], ['--providerPort', '0123', '--model', 'lmstudio/x'],
    ['--providerPort', '65536', '--model', 'lmstudio/x'], ['--providerPort', '12345', '--model', 'lmstudio/default'],
    ['--providerPort', 'http://127.0.0.1:12345', '--model', 'lmstudio/x'],
    ['--apiKey', 'forbidden', '--model', 'lmstudio/x'], ['--model', 'lmstudio/x', '--model', 'lmstudio/x']]) {
    assert.throws(() => parseLocalReadArguments([...roots, ...extra]));
  }
  assert.throws(() => parseLocalReadArguments([...roots.slice(0, -2), '--model', 'lmstudio/x']));
});
