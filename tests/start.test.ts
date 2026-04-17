import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Import after mock is set up
import { spawn } from 'child_process';
import { start } from '../src/start.js';

const mockSpawn = vi.mocked(spawn);

/** Creates a minimal mock child_process object with stdin/stdout/stderr streams */
function makeProc() {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdin = { write: vi.fn(), end: vi.fn() };
  return proc;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('start', () => {
  it('spawns claude with --print and returns stdout', async () => {
    const proc = makeProc();
    mockSpawn.mockReturnValue(proc);

    const promise = start({ prompt: 'Write something' });

    proc.stdout.emit('data', Buffer.from('Hello from claude'));
    proc.emit('close', 0);

    const result = await promise;

    expect(mockSpawn).toHaveBeenCalledWith(
      'claude',
      expect.arrayContaining(['--print']),
      expect.objectContaining({ timeout: 120_000, stdio: ['pipe', 'pipe', 'pipe'] }),
    );
    expect(result).toBe('Hello from claude');
  });

  it('writes prompt to stdin instead of passing as CLI arg', async () => {
    const proc = makeProc();
    mockSpawn.mockReturnValue(proc);

    const promise = start({ prompt: 'Write something' });
    proc.emit('close', 0);
    await promise;

    // Prompt must NOT appear in the spawned args
    const args = mockSpawn.mock.calls[0][1] as string[];
    expect(args).not.toContain('Write something');
    expect(args).not.toContain('-p');

    // Prompt must be piped via stdin
    expect(proc.stdin.write).toHaveBeenCalledWith('Write something');
    expect(proc.stdin.end).toHaveBeenCalled();
  });

  it('includes model flag when specified', async () => {
    const proc = makeProc();
    mockSpawn.mockReturnValue(proc);

    const promise = start({ prompt: 'Write something', model: 'haiku' });
    proc.emit('close', 0);
    await promise;

    const args = mockSpawn.mock.calls[0][1] as string[];
    expect(args).toContain('--model');
    expect(args).toContain('haiku');
  });

  it('includes output format flag when specified', async () => {
    const proc = makeProc();
    mockSpawn.mockReturnValue(proc);

    const promise = start({ prompt: 'Write something', outputFormat: 'json' });
    proc.stdout.emit('data', Buffer.from('{}'));
    proc.emit('close', 0);
    await promise;

    const args = mockSpawn.mock.calls[0][1] as string[];
    expect(args).toContain('--output-format');
    expect(args).toContain('json');
  });

  it('throws on non-zero exit code', async () => {
    const proc = makeProc();
    mockSpawn.mockReturnValue(proc);

    const promise = start({ prompt: 'Write something' });
    proc.stderr.emit('data', Buffer.from('something went wrong'));
    proc.emit('close', 1);

    await expect(promise).rejects.toThrow('claude exited with code 1');
  });

  it('throws on spawn error', async () => {
    const proc = makeProc();
    mockSpawn.mockReturnValue(proc);

    const promise = start({ prompt: 'Write something' });
    proc.emit('error', new Error('spawn ENOENT'));

    await expect(promise).rejects.toThrow('spawn ENOENT');
  });

  it('calls onLine for each line of stdout', async () => {
    const proc = makeProc();
    mockSpawn.mockReturnValue(proc);

    const lines: string[] = [];
    const promise = start({ prompt: 'Write something', onLine: (line) => lines.push(line) });

    proc.stdout.emit('data', Buffer.from('line one\nline two\n'));
    proc.stdout.emit('data', Buffer.from('partial'));
    proc.stdout.emit('data', Buffer.from(' end\n'));
    proc.emit('close', 0);

    await promise;

    expect(lines).toEqual(['line one', 'line two', 'partial end']);
  });

  it('flushes partial line on close', async () => {
    const proc = makeProc();
    mockSpawn.mockReturnValue(proc);

    const lines: string[] = [];
    const promise = start({ prompt: 'Write something', onLine: (line) => lines.push(line) });

    proc.stdout.emit('data', Buffer.from('no newline'));
    proc.emit('close', 0);

    await promise;

    expect(lines).toEqual(['no newline']);
  });
});

describe('stream-json mode', () => {
  it('spawns with stream-json flags when onStream is provided', async () => {
    const proc = makeProc();
    mockSpawn.mockReturnValue(proc);

    const events: any[] = [];
    const promise = start({ prompt: 'Write something', onStream: (e) => events.push(e) });

    proc.stdout.emit('data', Buffer.from('{"type":"result","subtype":"success","result":"hello"}\n'));
    proc.emit('close', 0);

    await promise;

    const args = mockSpawn.mock.calls[0][1] as string[];
    expect(args).toContain('--verbose');
    expect(args).toContain('--output-format');
    expect(args).toContain('stream-json');
    expect(args).toContain('--include-partial-messages');
  });

  it('emits thinking events for thinking_delta', async () => {
    const proc = makeProc();
    mockSpawn.mockReturnValue(proc);

    const events: any[] = [];
    const promise = start({ prompt: 'Write something', onStream: (e) => events.push(e) });

    proc.stdout.emit('data', Buffer.from(
      '{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"Let me think"}}}\n'
    ));
    proc.stdout.emit('data', Buffer.from('{"type":"result","subtype":"success","result":"hello"}\n'));
    proc.emit('close', 0);

    await promise;

    expect(events).toContainEqual({ type: 'thinking' });
  });

  it('emits text events for text_delta', async () => {
    const proc = makeProc();
    mockSpawn.mockReturnValue(proc);

    const events: any[] = [];
    const promise = start({ prompt: 'Write something', onStream: (e) => events.push(e) });

    proc.stdout.emit('data', Buffer.from(
      '{"type":"stream_event","event":{"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"Hello world"}}}\n'
    ));
    proc.stdout.emit('data', Buffer.from('{"type":"result","subtype":"success","result":"Hello world"}\n'));
    proc.emit('close', 0);

    await promise;

    expect(events).toContainEqual({ type: 'text', text: 'Hello world' });
  });

  it('resolves with result field from result event', async () => {
    const proc = makeProc();
    mockSpawn.mockReturnValue(proc);

    const promise = start({ prompt: 'Write something', onStream: () => {} });

    proc.stdout.emit('data', Buffer.from('{"type":"result","subtype":"success","result":"final output"}\n'));
    proc.emit('close', 0);

    const result = await promise;
    expect(result).toBe('final output');
  });

  it('rejects on error result', async () => {
    const proc = makeProc();
    mockSpawn.mockReturnValue(proc);

    const promise = start({ prompt: 'Write something', onStream: () => {} });

    proc.stdout.emit('data', Buffer.from('{"type":"result","subtype":"error","is_error":true,"result":"something broke"}\n'));
    proc.emit('close', 0);

    await expect(promise).rejects.toThrow('something broke');
  });

  it('ignores non-relevant event types', async () => {
    const proc = makeProc();
    mockSpawn.mockReturnValue(proc);

    const events: any[] = [];
    const promise = start({ prompt: 'Write something', onStream: (e) => events.push(e) });

    proc.stdout.emit('data', Buffer.from('{"type":"system","subtype":"init"}\n'));
    proc.stdout.emit('data', Buffer.from('{"type":"system","subtype":"hook_started"}\n'));
    proc.stdout.emit('data', Buffer.from('{"type":"rate_limit_event"}\n'));
    proc.stdout.emit('data', Buffer.from('{"type":"assistant","message":{}}\n'));
    proc.stdout.emit('data', Buffer.from('{"type":"stream_event","event":{"type":"message_start"}}\n'));
    proc.stdout.emit('data', Buffer.from('{"type":"result","subtype":"success","result":"done"}\n'));
    proc.emit('close', 0);

    await promise;

    expect(events).toEqual([]);
  });

  it('handles chunked JSON lines across data events', async () => {
    const proc = makeProc();
    mockSpawn.mockReturnValue(proc);

    const events: any[] = [];
    const promise = start({ prompt: 'Write something', onStream: (e) => events.push(e) });

    proc.stdout.emit('data', Buffer.from('{"type":"stream_event","event":{"type":"content_block_'));
    proc.stdout.emit('data', Buffer.from('delta","index":1,"delta":{"type":"text_delta","text":"split"}}}\n'));
    proc.stdout.emit('data', Buffer.from('{"type":"result","subtype":"success","result":"split"}\n'));
    proc.emit('close', 0);

    await promise;

    expect(events).toContainEqual({ type: 'text', text: 'split' });
  });

  it('does not use stream-json flags when onStream is not provided', async () => {
    const proc = makeProc();
    mockSpawn.mockReturnValue(proc);

    const promise = start({ prompt: 'Write something' });
    proc.stdout.emit('data', Buffer.from('plain text output'));
    proc.emit('close', 0);

    await promise;

    const args = mockSpawn.mock.calls[0][1] as string[];
    expect(args).not.toContain('--verbose');
    expect(args).not.toContain('stream-json');
    expect(args).not.toContain('--include-partial-messages');
  });

  it('rejects on non-zero exit when no result event received', async () => {
    const proc = makeProc();
    mockSpawn.mockReturnValue(proc);

    const promise = start({ prompt: 'Write something', onStream: () => {} });

    proc.stderr.emit('data', Buffer.from('process crashed'));
    proc.emit('close', 1);

    await expect(promise).rejects.toThrow('claude exited with code 1');
  });

  it('onLine still works when onStream is not provided', async () => {
    const proc = makeProc();
    mockSpawn.mockReturnValue(proc);

    const lines: string[] = [];
    const promise = start({ prompt: 'Write something', onLine: (line) => lines.push(line) });

    proc.stdout.emit('data', Buffer.from('line one\nline two\n'));
    proc.emit('close', 0);

    await promise;

    expect(lines).toEqual(['line one', 'line two']);
  });
});

describe('abort signal', () => {
  it('rejects with AbortError when signal is already aborted', async () => {
    const proc = makeProc();
    mockSpawn.mockReturnValue(proc);

    const controller = new AbortController();
    controller.abort();

    const promise = start({ prompt: 'Write something', signal: controller.signal });

    // spawn receives the signal — Node emits 'error' with ABORT_ERR
    const err = new Error('The operation was aborted');
    (err as any).code = 'ABORT_ERR';
    proc.emit('error', err);

    await expect(promise).rejects.toThrow();
    const rejected = await promise.catch(e => e);
    expect(rejected.name).toBe('AbortError');
  });

  it('passes signal to spawn options', async () => {
    const proc = makeProc();
    mockSpawn.mockReturnValue(proc);

    const controller = new AbortController();
    const promise = start({ prompt: 'Write something', signal: controller.signal });

    proc.stdout.emit('data', Buffer.from('output'));
    proc.emit('close', 0);
    await promise;

    const spawnOpts = mockSpawn.mock.calls[0][2] as any;
    expect(spawnOpts.signal).toBe(controller.signal);
  });
});
