import { readFileSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import Ajv2020Mod from 'ajv/dist/2020.js';
import type { Spec, ValidationResult } from './types.js';

// AJV ships a CommonJS module; the default export may be the class itself or
// wrapped in a .default property depending on the Node module resolution mode.
const Ajv2020 = (Ajv2020Mod as any).default ?? Ajv2020Mod;

const schemaPath = path.join(import.meta.dirname, '..', 'lib', 'spec-schema.json');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedValidator: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getValidator(): any {
  if (!cachedValidator) {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
    const ajv = new Ajv2020({ allErrors: true, useDefaults: true });
    cachedValidator = ajv.compile(schema);
  }
  return cachedValidator;
}

export function validateSpec(data: unknown): ValidationResult {
  const validate = getValidator();
  const valid = validate(structuredClone(data));

  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors = (validate.errors ?? []).map(
    (e: any) => `${e.instancePath || '/'}: ${e.message ?? 'unknown error'}`
  );
  return { valid: false, errors };
}

export async function loadSpec(filePath: string): Promise<Spec> {
  const absolutePath = path.resolve(filePath);
  const content = await fs.readFile(absolutePath, 'utf-8');
  let data: unknown;

  try {
    data = JSON.parse(content);
  } catch (e: unknown) {
    throw new Error(`Invalid JSON in spec file: ${absolutePath}`);
  }

  // Validate directly (not a clone) so AJV useDefaults applies to the returned object.
  // validateSpec uses structuredClone which discards the defaults — use the validator directly here.
  const validate = getValidator();
  const valid = validate(data);
  if (!valid) {
    const errors = (validate.errors ?? []).map(
      (e: any) => `${e.instancePath || '/'}: ${e.message ?? 'unknown error'}`
    );
    throw new Error(`Spec validation failed:\n${errors.join('\n')}`);
  }

  return data as Spec;
}
