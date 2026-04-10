import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

// Import after mock is set up
import { execFile as execFileCb } from 'child_process';
import { start } from '../src/start.js';

const mockExecFile = vi.mocked(execFileCb) as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('start', () => {
  it('spawns claude with prompt and returns stdout', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, { stdout: 'Hello from claude', stderr: '' });
    });

    const result = await start({ prompt: 'Write something' });

    expect(mockExecFile).toHaveBeenCalledWith(
      'claude',
      ['-p', 'Write something'],
      expect.objectContaining({ timeout: 120_000, maxBuffer: 10 * 1024 * 1024 }),
      expect.any(Function),
    );
    expect(result).toBe('Hello from claude');
  });

  it('includes model flag when specified', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, { stdout: 'response', stderr: '' });
    });

    await start({ prompt: 'Write something', model: 'haiku' });

    const args = mockExecFile.mock.calls[0][1] as string[];
    expect(args).toContain('--model');
    expect(args).toContain('haiku');
  });

  it('includes output format flag when specified', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, { stdout: '{}', stderr: '' });
    });

    await start({ prompt: 'Write something', outputFormat: 'json' });

    const args = mockExecFile.mock.calls[0][1] as string[];
    expect(args).toContain('--output-format');
    expect(args).toContain('json');
  });

  it('throws on claude error', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(new Error('claude exited with code 1'), { stdout: '', stderr: 'error' });
    });

    await expect(start({ prompt: 'Write something' })).rejects.toThrow('claude exited with code 1');
  });
});
