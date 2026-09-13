import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const RUNTIME_PIN = Object.freeze({
  version: '0.32.5', gitHead: '1cf724938689a8f2bdb63bc03807db79a73d8f2d',
  cliSha256: '00e243ec4d963dec0e5130556e25916c478671507e7dc27e7513a9187703e1df',
  nodeVersion: '24.15.0', nodePath: '/usr/local/bin/node',
});
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const requireValue = (value, code) => { if (!value) throw new Error(code); };
const inside = (parent, child) => child === parent || child.startsWith(`${parent}/`);
const overlap = (a, b) => inside(a, b) || inside(b, a);

function safePath(value) {
  requireValue(typeof value === 'string' && /^\/[A-Za-z0-9/_. -]+$/.test(value)
    && path.normalize(value) === value && !value.endsWith('/'), 'unsafe_path');
}

/**
 * Offline disposable macOS experiment only. No import-time I/O or spawning.
 * Roots must already exist, be canonical, and remain host-controlled throughout
 * launch. This does not defend against a separate hostile process of this uid
 * swapping dependencies after validation. The whole transitive install is a
 * trusted reviewed prerequisite; the digest pins its published CLI entry point.
 * The second argument is a trusted unit-test seam, never client/model input.
 */
export async function createRuntimeSandbox({ dependencyRoot, stateRoot, protectedRoot } = {}, {
  io = fs, platform = process.platform, uid = process.getuid?.(),
  nodePath = process.execPath, nodeVersion = process.versions.node, digest = sha256,
} = {}) {
  requireValue(platform === 'darwin', 'unsupported_platform');
  requireValue(nodePath === RUNTIME_PIN.nodePath && nodeVersion === RUNTIME_PIN.nodeVersion, 'node_pin_mismatch');
  const roots = [dependencyRoot, stateRoot, protectedRoot];
  for (const root of roots) {
    safePath(root);
    // Deliberately excludes home, system trees, /tmp aliases, and broad roots.
    requireValue(/^\/private\/tmp\/[^/]+\/[^/]+(?:\/[^/]+)*$/.test(root), 'unsafe_root');
    const stat = await io.lstat(root);
    requireValue(stat.isDirectory() && stat.uid === uid && (stat.mode & 0o7022) === 0
      && await io.realpath(root) === root, 'unsafe_root');
    if (root !== dependencyRoot) requireValue((stat.mode & 0o7777) === 0o700, 'root_not_private');
  }
  requireValue(path.basename(dependencyRoot) === 'node_modules'
    && !roots.some((a, index) => roots.slice(index + 1).some(b => overlap(a, b))), 'overlapping_roots');
  const packageRoot = path.join(dependencyRoot, '@letta-ai/letta-code');
  const cliPath = path.join(packageRoot, 'letta.js');
  async function regular(file) {
    const stat = await io.lstat(file);
    requireValue(stat.isFile() && (stat.mode & 0o7022) === 0 && stat.nlink === 1
      && (stat.uid === uid || stat.uid === 0) && await io.realpath(file) === file, 'unsafe_executable');
  }
  await regular(nodePath);
  const manifestPath = path.join(packageRoot, 'package.json');
  await regular(manifestPath);
  await regular(cliPath);
  const manifest = JSON.parse(await io.readFile(manifestPath, 'utf8'));
  requireValue(manifest.name === '@letta-ai/letta-code' && manifest.version === RUNTIME_PIN.version
    && manifest.engines?.node === '>=22.19.0', 'runtime_pin_mismatch');
  requireValue(digest(await io.readFile(cliPath)) === RUNTIME_PIN.cliSha256, 'runtime_hash_mismatch');

  const metadata = new Set(['/private', '/private/tmp', '/usr', '/usr/local', '/usr/local/bin',
    '/System', '/System/Library', '/Library', '/Library/Developer',
    '/Library/Developer/CommandLineTools', '/Library/Developer/CommandLineTools/usr', '/bin', '/dev']);
  for (const root of roots) {
    for (let parent = path.dirname(root); parent !== '/'; parent = path.dirname(parent)) metadata.add(parent);
  }
  const literals = ['/', nodePath, '/bin/sh', '/System/Library/CoreServices/SystemVersion.plist',
    '/System/Library/OpenSSL/openssl.cnf', '/dev/null', '/dev/random', '/dev/urandom', '/dev/tty'];
  const subpaths = ['/usr/lib', '/System/Library/Frameworks', '/System/Library/PrivateFrameworks',
    '/Library/Developer/CommandLineTools/usr/bin', '/Library/Developer/CommandLineTools/usr/lib',
    '/Library/Developer/CommandLineTools/usr/libexec', '/Library/Developer/CommandLineTools/usr/share/git-core',
    '/dev/fd', dependencyRoot, stateRoot];
  requireValue(!subpaths.some(root => overlap(root, protectedRoot)), 'protected_grant_overlap');
  const filters = (type, values) => values.map(value => `  (${type} "${value}")`).join('\n');
  const profile = `(version 1)
(deny default)
(allow process-exec)
(allow process-fork)
(allow sysctl-read)
(allow mach-lookup (global-name "com.apple.system.opendirectoryd.libinfo"))
(allow file-read-metadata
${filters('literal', [...metadata].sort())})
(allow file-read*
${filters('literal', literals)}
${filters('subpath', subpaths)})
(allow file-write* (subpath "${stateRoot}") (literal "/dev/null"))
(deny file-read* (subpath "${protectedRoot}") (subpath "/Library/Keychains"))
(deny file-write* (subpath "${protectedRoot}"))
(allow network-inbound (local ip "localhost:*"))
(allow network-bind (local ip "localhost:*"))
`;
  const env = Object.freeze({
    PATH: '/Library/Developer/CommandLineTools/usr/bin:/usr/local/bin:/usr/bin:/bin',
    LETTA_LOCAL_BACKEND_DIR: stateRoot, LETTA_LOCAL_BACKEND_EXPERIMENTAL: '1',
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
  });
  return Object.freeze({ command: '/usr/bin/sandbox-exec',
    args: Object.freeze(['-p', profile, nodePath, cliPath, 'server', '--backend', 'local', '--listen', 'ws://127.0.0.1:0']),
    options: Object.freeze({ cwd: stateRoot, env, shell: false, detached: true, stdio: Object.freeze(['ignore', 'pipe', 'pipe']) }),
    profile, profileSha256: sha256(profile), cliPath, pin: RUNTIME_PIN,
    roots: Object.freeze({ dependencyRoot, stateRoot, protectedRoot }),
  });
}
