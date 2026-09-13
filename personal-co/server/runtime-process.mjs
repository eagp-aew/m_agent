import { spawn } from 'node:child_process';
import net from 'node:net';

const check = (value, code) => { if (!value) throw new Error(code); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export function validateEndpoint(value) {
  const match = typeof value === 'string' && /^ws:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})\/ws$/.exec(value);
  check(match && match[0] === value && Number(match[1]) <= 65535, 'invalid_endpoint');
  return value;
}

/** Owned detached process group; never shells, scans processes, or kills by name.
 * All injections in this file are trusted tests, not runtime/client input. */
export function startOwned(spec, { spawnImpl = spawn, signalGroup = process.kill.bind(process),
  startupMs = 15000, stopMs = 1000, maxLogBytes = 65536 } = {}) {
  check(Number.isInteger(startupMs) && startupMs > 0 && startupMs <= 15000
    && Number.isInteger(stopMs) && stopMs > 0 && stopMs <= 2000
    && Number.isInteger(maxLogBytes) && maxLogBytes > 0 && maxLogBytes <= 65536, 'invalid_process_bounds');
  const child = spawnImpl(spec.command, [...spec.args], { ...spec.options, env: { ...spec.options.env },
    stdio: [...spec.options.stdio] });
  const pid = child.pid;
  let complete = false;
  let failure;
  let output = '';
  let bytes = 0;
  let result;
  let notifyFailure;
  const failed = new Promise(resolve => { notifyFailure = code => resolve(Object.freeze({ code })); });
  const listeners = new Set();
  const notify = () => { for (const fn of [...listeners]) fn(); };
  const fail = code => { failure ??= code; notifyFailure(failure); notify(); };
  function parsedEndpoint() {
    const lines = output.split('\n');
    lines.pop(); // Never accept partial lines.
    const listening = lines.filter(line => line.startsWith('Listening on '));
    const websocket = lines.filter(line => line.startsWith('WebSocket: '));
    check(listening.length <= 1 && websocket.length <= 1, 'multiple_endpoints');
    const base = listening.length ? validateEndpoint(`${listening[0].slice(13)}/ws`) : undefined;
    const control = websocket.length ? validateEndpoint(websocket[0].slice(11)) : undefined;
    if (base === undefined || control === undefined) return undefined;
    check(base === control, 'endpoint_mismatch');
    return control;
  }
  const done = new Promise(resolve => {
    child.once('error', () => fail('child_error'));
    child.once('close', (code, signal) => {
      complete = true; result = { code, signal }; resolve(result); notifyFailure('child_exited'); notify();
    });
  });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
    bytes += Buffer.byteLength(chunk);
    if (bytes > maxLogBytes) return fail('log_limit');
    output += chunk.toString();
    // Continue validating announcements after readiness, without polling.
    try { parsedEndpoint(); } catch { return fail('invalid_child_output'); }
    notify();
  });
  async function until(read, timeoutCode) {
    return new Promise((resolve, reject) => {
      const finish = (error, value) => { clearTimeout(timer); listeners.delete(poll); error ? reject(new Error(error)) : resolve(value); };
      const poll = () => {
        if (failure) return finish(failure);
        let value;
        try { value = read(); } catch { return finish('invalid_child_output'); }
        if (value !== undefined) return finish(null, value);
        if (complete) finish('child_exited');
      };
      const timer = setTimeout(() => finish(timeoutCode), startupMs);
      listeners.add(poll); poll();
    });
  }
  let stopping;
  return {
    pid, done, failed,
    endpoint: () => until(parsedEndpoint, 'startup_timeout'),
    output: () => until(() => complete ? (check(result.code === 0, 'child_failed'), output) : undefined, 'child_timeout'),
    stop() {
      stopping ??= (async () => {
        if (!Number.isInteger(pid) || pid <= 1) {
          check(complete || failure === 'child_error', 'missing_child_pid');
          if (!complete) await Promise.race([done, delay(stopMs)]);
          check(complete, 'cleanup_incomplete');
          return { pid: null, reaped: true, groupGone: true };
        }
        const signal = value => { try { signalGroup(-pid, value); return true; }
          catch (error) { if (error.code === 'ESRCH') return false; throw new Error('cleanup_signal_failed'); } };
        if (signal(0)) signal('SIGTERM');
        if (!complete) await Promise.race([done, delay(stopMs)]);
        if (signal(0)) signal('SIGKILL');
        if (!complete) await Promise.race([done, delay(stopMs)]);
        // Allow the kernel to reap short-lived group descendants after SIGKILL.
        for (let i = 0; i < 10 && signal(0); i++) await delay(20);
        check(complete && !signal(0), 'cleanup_incomplete');
        return { pid, reaped: true, groupGone: true, exit: result, logBytes: bytes };
      })();
      return stopping;
    },
  };
}

export async function listenerGone(endpoint, { connect = net.connect } = {}) {
  validateEndpoint(endpoint);
  return new Promise((resolve, reject) => {
    const socket = connect({ host: '127.0.0.1', port: Number(new URL(endpoint).port) });
    const timer = setTimeout(() => { socket.destroy(); reject(new Error('listener_check_timeout')); }, 1000);
    socket.once('connect', () => { clearTimeout(timer); socket.destroy(); reject(new Error('listener_remains')); });
    socket.once('error', error => { clearTimeout(timer); socket.destroy();
      error.code === 'ECONNREFUSED' ? resolve(true) : reject(new Error('listener_check_failed')); });
  });
}
