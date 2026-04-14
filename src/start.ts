import { spawn } from 'child_process';

export type StreamEvent =
  | { type: 'thinking' }
  | { type: 'text'; text: string };

export interface StartOptions {
  prompt: string;
  model?: 'opus' | 'sonnet' | 'haiku';
  outputFormat?: 'text' | 'json';
  timeout?: number;
  onLine?: (line: string) => void;
  onStream?: (event: StreamEvent) => void;
}

function parseStreamLine(line: string, onStream: (event: StreamEvent) => void): string | null {
  let parsed: any;
  try { parsed = JSON.parse(line); } catch { return null; }

  if (parsed.type === 'stream_event' && parsed.event?.type === 'content_block_delta') {
    const delta = parsed.event.delta;
    if (delta?.type === 'thinking_delta') {
      onStream({ type: 'thinking' });
    } else if (delta?.type === 'text_delta') {
      onStream({ type: 'text', text: delta.text });
    }
  } else if (parsed.type === 'result') {
    if (parsed.is_error || parsed.subtype !== 'success') {
      return `error:${parsed.result ?? 'unknown error'}`;
    }
    return parsed.result ?? '';
  }

  return null;
}

export async function start(options: StartOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const useStreamJson = !!options.onStream;
    // Pass prompt via stdin to avoid Windows CLI arg length limits (~32K chars).
    const args: string[] = ['--print'];

    if (useStreamJson) {
      args.push('--verbose', '--output-format', 'stream-json', '--include-partial-messages');
    } else {
      if (options.outputFormat) args.push('--output-format', options.outputFormat);
    }

    if (options.model) args.push('--model', options.model);

    const proc = spawn('claude', args, {
      timeout: options.timeout ?? 120_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let lineBuf = '';
    let streamResult: string | null = null;

    proc.stdout.on('data', (data: Buffer) => {
      const chunk = data.toString();

      if (useStreamJson) {
        lineBuf += chunk;
        const parts = lineBuf.split('\n');
        lineBuf = parts.pop()!;
        for (const jsonLine of parts) {
          if (!jsonLine.trim()) continue;
          const result = parseStreamLine(jsonLine, options.onStream!);
          if (result !== null) {
            streamResult = result;
          }
        }
      } else {
        stdout += chunk;
        if (options.onLine) {
          lineBuf += chunk;
          const parts = lineBuf.split('\n');
          lineBuf = parts.pop()!;
          for (const line of parts) {
            options.onLine(line);
          }
        }
      }
    });

    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    proc.on('error', reject);
    proc.on('close', (code) => {
      // Flush remaining buffer
      if (!useStreamJson && options.onLine && lineBuf.length > 0) {
        options.onLine(lineBuf);
      }
      if (useStreamJson && lineBuf.trim()) {
        const result = parseStreamLine(lineBuf, options.onStream!);
        if (result !== null) streamResult = result;
      }

      if (useStreamJson) {
        if (streamResult !== null && streamResult.startsWith('error:')) {
          reject(new Error(streamResult.slice(6)));
        } else if (code !== 0 && streamResult === null) {
          reject(new Error(`claude exited with code ${code}: ${stderr}`));
        } else {
          resolve(streamResult ?? '');
        }
      } else {
        if (code !== 0) {
          reject(new Error(`claude exited with code ${code}: ${stderr}`));
        } else {
          // claude --print --output-format json wraps output in an envelope:
          // {"type":"result","result":"<actual model output>", ...}
          // Extract the inner result when using JSON output format.
          if (options.outputFormat === 'json') {
            try {
              const envelope = JSON.parse(stdout);
              if (envelope && typeof envelope.result === 'string') {
                resolve(envelope.result);
                return;
              }
            } catch { /* Not an envelope — fall through to raw stdout */ }
          }
          resolve(stdout);
        }
      }
    });

    proc.stdin.write(options.prompt);
    proc.stdin.end();
  });
}
