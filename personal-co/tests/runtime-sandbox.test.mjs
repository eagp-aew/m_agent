import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeSandbox, RUNTIME_PIN, captureLocalChatConfig, deriveLocalChatSandbox, createLocalChatProviderGuard } from '../server/runtime-sandbox.mjs';

const roots = { dependencyRoot: '/private/tmp/installed/node_modules',
  stateRoot: '/private/tmp/synthetic/state', protectedRoot: '/private/tmp/synthetic/protected' };
function environment(change = {}) {
  return { platform: 'darwin', uid: 501, nodePath: '/usr/local/bin/node', nodeVersion: '24.15.0',
    digest: () => RUNTIME_PIN.cliSha256,
    io: {
      lstat: async file => ({ uid: 501, nlink: 1, mode: file === roots.dependencyRoot ? 0o755 : 0o700,
        isDirectory: () => Object.values(roots).includes(file), isFile: () => !Object.values(roots).includes(file) }),
      realpath: async value => value,
      readFile: async file => file.endsWith('package.json')
        ? JSON.stringify({ name: '@letta-ai/letta-code', version: '0.32.5', engines: { node: '>=22.19.0' } }) : Buffer.from('fixture CLI'),
    }, ...change };
}

test('deny-default spec pins command/argv, clean environment and separate permissions', async () => {
  const inherited = process.env.LETTA_API_KEY;
  process.env.LETTA_API_KEY = 'synthetic-must-not-inherit';
  try {
    const spec = await createRuntimeSandbox(roots, environment());
    assert.equal(spec.command, '/usr/bin/sandbox-exec');
    assert.deepEqual(spec.args, ['-p', spec.profile, RUNTIME_PIN.nodePath,
      `${roots.dependencyRoot}/@letta-ai/letta-code/letta.js`, 'server', '--backend', 'local', '--listen', 'ws://127.0.0.1:0']);
    assert.deepEqual(spec.options.env, { PATH: '/Library/Developer/CommandLineTools/usr/bin:/usr/local/bin:/usr/bin:/bin',
      LETTA_LOCAL_BACKEND_DIR: roots.stateRoot, LETTA_LOCAL_BACKEND_EXPERIMENTAL: '1',
      GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' });
    assert.equal(spec.options.cwd, roots.stateRoot);
    assert.equal(spec.options.shell, false);
    assert.equal(spec.options.detached, true);
    assert.ok(Object.isFrozen(spec.args) && Object.isFrozen(spec.options.env));
    assert.match(spec.profile, /\(deny default\)/);
    assert.match(spec.profile, /\(allow file-write\* \(subpath "\/private\/tmp\/synthetic\/state"\) \(literal "\/dev\/null"\)\)/);
    assert.match(spec.profile, /\(deny file-read\* \(subpath "\/private\/tmp\/synthetic\/protected"\)/);
    assert.doesNotMatch(spec.profile, /network-outbound|allow default|\(subpath "\/(?:usr|Library|System|Users)"\)/);
    assert.match(spec.profile, /network-bind \(local ip "localhost:\*"\)/);
    assert.match(spec.profileSha256, /^[a-f0-9]{64}$/);
  } finally {
    if (inherited === undefined) delete process.env.LETTA_API_KEY; else process.env.LETTA_API_KEY = inherited;
  }
});

test('optional chat preserves baseline sandbox exactly except literal loopback port and clean provider environment', async () => {
  const base = await createRuntimeSandbox(roots, environment());
  const config = captureLocalChatConfig({ model: 'lmstudio/synthetic/model', providerPort: 12345 });
  const derived = deriveLocalChatSandbox(base, config);
  assert.ok(Object.isFrozen(config));
  assert.equal(derived.profile, `${base.profile}(allow network-outbound (remote ip "127.0.0.1:12345"))\n`
    + `(deny file-read-data (subpath "${roots.stateRoot}/providers"))\n(deny file-write* (subpath "${roots.stateRoot}/providers"))\n`);
  assert.deepEqual(derived.args, ['-p', derived.profile, ...base.args.slice(2)]);
  assert.deepEqual(derived.options, { ...base.options, env: { ...base.options.env, LMSTUDIO_BASE_URL: 'http://127.0.0.1:12345/v1', LETTA_DISABLE_MODS: '1' } });
  assert.equal(derived.roots, base.roots); assert.notEqual(derived.profileSha256, base.profileSha256);
  assert.ok(Object.isFrozen(derived.options.env) && Object.isFrozen(derived.args));
  assert.ok(!base.options.env.LMSTUDIO_BASE_URL && !base.profile.includes('network-outbound'));
});

test('provider admission is metadata-only and rechecks canonical private parent/root identity', async () => {
  const absent = () => { throw Object.assign(new Error('synthetic missing'), { code: 'ENOENT' }); };
  for (const mode of ['absent', 'directory', 'auth-file', 'auth-link', 'auth-error', 'parent-link', 'owner', 'mode', 'alias', 'swap-root', 'swap-parent']) {
    let changed = false; let rootReads = 0;
    const directory = ino => ({ ino, dev: 1, uid: 501, mode: 0o700, isDirectory: () => true });
    const io = {
      async lstat(file) {
        if (file === roots.stateRoot) { rootReads++; return directory(mode === 'swap-root' && changed ? 9 : 1); }
        if (file.endsWith('/auth.json')) {
          if (mode === 'auth-error') throw Object.assign(new Error('PRIVATE'), { code: 'EACCES' });
          if (mode.startsWith('auth-')) return { isFile: () => mode === 'auth-file' };
          return absent();
        }
        if (mode === 'absent') return absent();
        return { ...directory(mode === 'swap-parent' && changed ? 10 : 2),
          ...(mode === 'owner' ? { uid: 999 } : mode === 'mode' ? { mode: 0o755 } : mode === 'parent-link' ? { isDirectory: () => false } : {}) };
      },
      async realpath(file) { return mode === 'alias' && file.endsWith('/providers') ? '/different' : file; },
      readFile() { assert.fail('provider contents must never be read'); },
    };
    if (['absent', 'directory', 'swap-root', 'swap-parent'].includes(mode)) {
      const guard = await createLocalChatProviderGuard(roots.stateRoot, { io, uid: 501 });
      assert.ok(rootReads >= 2); changed = true;
      if (mode.startsWith('swap-')) await assert.rejects(guard.check(), /provider admission failed/);
      else await guard.check();
    } else await assert.rejects(createLocalChatProviderGuard(roots.stateRoot, { io, uid: 501 }), /provider admission failed/);
  }
});

test('chat operator configuration rejects endpoint, fallback, getters, hidden fields and out-of-range ports', () => {
  for (const model of ['local/default', 'lmstudio/default', 'lmstudio/auto', 'lmstudio/unselected', 'openai/x',
    'lmstudio/x\n', 'lmstudio/../x', 'http://127.0.0.1:12345', 'lmstudio/x?token=y']) {
    assert.throws(() => captureLocalChatConfig({ model, providerPort: 12345 }));
  }
  for (const providerPort of [0, 65536, 1.5, '12345', NaN]) assert.throws(() => captureLocalChatConfig({ model: 'lmstudio/x', providerPort }));
  assert.throws(() => captureLocalChatConfig({ model: 'lmstudio/x', providerPort: 12345, apiKey: 'private' }));
  let read = false;
  assert.throws(() => captureLocalChatConfig({ get model() { read = true; return 'lmstudio/x'; }, providerPort: 12345 }));
  assert.equal(read, false);
  assert.throws(() => captureLocalChatConfig(Object.defineProperty({ model: 'lmstudio/x' }, 'providerPort', { value: 12345 })));
});

test('unsupported platform and incompatible Node fail before filesystem access', async () => {
  const io = new Proxy({}, { get() { assert.fail('unexpected filesystem access'); } });
  for (const platform of ['linux', 'win32']) await assert.rejects(createRuntimeSandbox(roots, environment({ platform, io })), /unsupported_platform/);
  for (const change of [{ nodeVersion: '22.18.0' }, { nodeVersion: '24.16.0' }, { nodePath: '/other/node' }]) {
    await assert.rejects(createRuntimeSandbox(roots, environment({ ...change, io })), /node_pin_mismatch/);
  }
});

test('rejects broad, aliased, normalized-away, injection and control paths', async () => {
  for (const value of ['/', '/private/tmp', '/private/tmp/one', '/Users/user/private/state', '/tmp/x/state',
    'relative', '/private/tmp/a/../state', '/private/tmp/a/state/', '/private/tmp/a/"state',
    '/private/tmp/a/(state)', '/private/tmp/a/state\n', '/private/tmp/a/state\0', '/private/tmp/a/\\state']) {
    await assert.rejects(createRuntimeSandbox({ ...roots, stateRoot: value }, environment()), /unsafe_path|unsafe_root/);
  }
});

test('rejects overlap even when directories otherwise validate', async () => {
  for (const stateRoot of [roots.dependencyRoot, `${roots.dependencyRoot}/state`, '/private/tmp/installed']) {
    const env = environment();
    env.io.lstat = async () => ({ uid: 501, mode: 0o700, isDirectory: () => true });
    await assert.rejects(createRuntimeSandbox({ ...roots, stateRoot }, env), /overlapping_roots|unsafe_root/);
  }
  await assert.rejects(createRuntimeSandbox({ ...roots, protectedRoot: roots.stateRoot }, environment()), /overlapping_roots/);
});

test('rejects symlink roots, wrong owner, permissive state, writable or special dependencies', async () => {
  for (const change of [
    { realpath: async () => '/different' },
    { lstat: async () => ({ uid: 501, mode: 0o700, isDirectory: () => false }) },
    { lstat: async () => ({ uid: 502, mode: 0o700, isDirectory: () => true }) },
    { lstat: async () => ({ uid: 501, mode: 0o755, isDirectory: () => true }) },
    { lstat: async () => ({ uid: 501, mode: 0o777, isDirectory: () => true }) },
    { lstat: async () => ({ uid: 501, mode: 0o2700, isDirectory: () => true }) },
  ]) {
    const env = environment(); Object.assign(env.io, change);
    await assert.rejects(createRuntimeSandbox(roots, env), /unsafe_root|root_not_private/);
  }
});

test('rejects CLI/package/node symlinks, hardlinks, writable files and pin mismatches', async () => {
  for (const target of [RUNTIME_PIN.nodePath, `${roots.dependencyRoot}/@letta-ai/letta-code/letta.js`,
    `${roots.dependencyRoot}/@letta-ai/letta-code/package.json`]) {
    const env = environment(); env.io.realpath = async file => file === target ? `${file}-elsewhere` : file;
    await assert.rejects(createRuntimeSandbox(roots, env), /unsafe_executable/);
  }
  for (const change of [{ nlink: 2 }, { mode: 0o666 }, { uid: 502 }, { isFile: () => false }]) {
    const env = environment(); const original = env.io.lstat;
    env.io.lstat = async file => ({ ...await original(file), ...(!Object.values(roots).includes(file) ? change : {}) });
    await assert.rejects(createRuntimeSandbox(roots, env), /unsafe_executable/);
  }
  for (const manifest of [{ name: 'wrong', version: '0.32.5' },
    { name: '@letta-ai/letta-code', version: '0.32.6' },
    { name: '@letta-ai/letta-code', version: '0.32.5', engines: { node: '>=22' } }]) {
    const env = environment(); env.io.readFile = async () => JSON.stringify(manifest);
    await assert.rejects(createRuntimeSandbox(roots, env), /runtime_pin_mismatch/);
  }
  await assert.rejects(createRuntimeSandbox(roots, environment({ digest: () => 'bad' })), /runtime_hash_mismatch/);
});
