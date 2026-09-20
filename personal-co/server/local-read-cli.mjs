import { pathToFileURL } from 'node:url';
import { startLocalReadHost } from './local-read-host.mjs';
import { captureLocalChatConfig } from './runtime-sandbox.mjs';

// Operator-only CLI: roots are explicit, never inferred or created/deleted.
export function parseLocalReadArguments(argv) {
  const roots = ['dependencyRoot', 'stateRoot', 'protectedRoot', 'webRoot'];
  const names = [...roots, 'providerPort', 'model'];
  const config = {};
  if (![8, 12].includes(argv.length)) throw new Error('Invalid local host arguments.');
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index].slice(2);
    if (!argv[index].startsWith('--') || !names.includes(name) || config[name] !== undefined) throw new Error('Invalid local host arguments.');
    config[name] = argv[index + 1];
  }
  if (!roots.every(name => typeof config[name] === 'string' && config[name].length > 0)) throw new Error('Invalid local host arguments.');
  if (argv.length === 12) {
    if (!/^[1-9][0-9]{0,4}$/.test(config.providerPort)) throw new Error('Invalid local host arguments.');
    config.chat = captureLocalChatConfig({ providerPort: Number(config.providerPort), model: config.model });
    delete config.providerPort; delete config.model;
  }
  return Object.freeze(config);
}
export async function runLocalReadCli(argv = process.argv.slice(2)) {
  const config = parseLocalReadArguments(argv);
  const controller = new AbortController(); const stop = () => controller.abort();
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  let host;
  try {
    host = await startLocalReadHost(config, { signal: controller.signal });
    // Deliberate capability delivery to the local operator, never native token.
    process.stdout.write(`打开本地${config.chat ? '已保留会话' : '只读'}助手（请勿分享此链接）：\n${host.launchUrl}\n`);
    const result = await host.terminal;
    if (!result.confirmed) throw new Error('Local host cleanup unconfirmed.');
  } finally {
    await host?.close(); process.off('SIGINT', stop); process.off('SIGTERM', stop);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runLocalReadCli().catch(() => { process.stderr.write('本地助手未启动或清理未确认；请检查受信任的启动配置。\n'); process.exitCode = 1; });
}
