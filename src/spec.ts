import { readFileSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import Ajv2020 from 'ajv/dist/2020.js';
import type { Spec, ValidationResult } from './types.js';

const schemaPath = path.join(import.meta.dirname, '..', 'lib', 'spec-schema.json');

let cachedValidator: ReturnType<InstanceType<typeof Ajv2020>['compile']> | null = null;

function getValidator(): ReturnType<InstanceType<typeof Ajv2020>['compile']> {
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
    (e) => `${e.instancePath || '/'}: ${e.message ?? 'unknown error'}`
  );
  return { valid: false, errors };
}

export async function loadSpec(filePath: string): Promise<Spec> {
  const absolutePath = path.resolve(filePath);
  const content = await fs.readFile(absolutePath, 'utf-8');
  let data: unknown;

  try {
    data = JSON.parse(content);
  } catch {
    throw new Error(`Invalid JSON in spec file: ${absolutePath}`);
  }

  const result = validateSpec(data);
  if (!result.valid) {
    throw new Error(`Spec validation failed:\n${result.errors.join('\n')}`);
  }

  return data as Spec;
}
