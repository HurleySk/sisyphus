import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';

const execFile = promisify(execFileCb);

export interface StartOptions {
  prompt: string;
  model?: 'opus' | 'sonnet' | 'haiku';
  outputFormat?: 'text' | 'json';
  timeout?: number;
}

export async function start(options: StartOptions): Promise<string> {
  const args = ['-p', options.prompt];
  if (options.model) args.push('--model', options.model);
  if (options.outputFormat) args.push('--output-format', options.outputFormat);

  const result = await execFile('claude', args, {
    timeout: options.timeout ?? 120_000,
    maxBuffer: 10 * 1024 * 1024,
  });

  return result.stdout;
}
