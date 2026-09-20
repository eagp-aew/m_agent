import { pathToFileURL } from 'node:url';
import { startLocalReadHost } from './local-read-host.mjs';

// Operator-only CLI: roots are explicit, never inferred or created/deleted.
export async function runLocalReadCli(argv = process.argv.slice(2)) {
  const names = ['dependencyRoot', 'stateRoot', 'protectedRoot', 'webRoot'];
  const config = {};
  if (argv.length !== 8) throw new Error('Usage: --dependencyRoot PATH --stateRoot PATH --protectedRoot PATH --webRoot PATH');
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index].slice(2);
    if (!argv[index].startsWith('--') || !names.includes(name) || config[name] !== undefined) throw new Error('Invalid local host arguments.');
    config[name] = argv[index + 1];
  }
  const controller = new AbortController(); const stop = () => controller.abort();
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  let host;
  try {
    host = await startLocalReadHost(config, { signal: controller.signal });
    // Deliberate capability delivery to the local operator, never native token.
    process.stdout.write(`打开本地只读助手（请勿分享此链接）：\n${host.launchUrl}\n`);
    const result = await host.terminal;
    if (!result.confirmed) throw new Error('Local host cleanup unconfirmed.');
  } finally {
    await host?.close(); process.off('SIGINT', stop); process.off('SIGTERM', stop);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runLocalReadCli().catch(() => { process.stderr.write('本地助手未启动或清理未确认；请检查受信任的启动配置。\n'); process.exitCode = 1; });
}
