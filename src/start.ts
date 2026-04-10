import { spawn } from 'child_process';

export interface StartOptions {
  prompt: string;
  model?: 'opus' | 'sonnet' | 'haiku';
  outputFormat?: 'text' | 'json';
  timeout?: number;
}

export async function start(options: StartOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    // Pass prompt via stdin to avoid Windows CLI arg length limits (~32K chars).
    const args: string[] = ['--print'];
    if (options.model) args.push('--model', options.model);
    if (options.outputFormat) args.push('--output-format', options.outputFormat);

    const proc = spawn('claude', args, {
      timeout: options.timeout ?? 120_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`claude exited with code ${code}: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });

    proc.stdin.write(options.prompt);
    proc.stdin.end();
  });
}
