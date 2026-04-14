import React from 'react';
import { render } from 'ink';
import { TypedEmitter } from '../events.js';
import type { SisyphusEvents } from '../events.js';
import type { Spec, RunReport } from '../types.js';
import { runSpec } from '../engine.js';
import { App } from './App.js';

export async function renderUI(
  spec: Spec,
  options: { baseDir?: string; lessonsDir?: string },
  artifactPath: string,
  reportPath: string,
): Promise<RunReport> {
  const emitter = new TypedEmitter<SisyphusEvents>();
  const startTime = Date.now();

  const app = render(
    React.createElement(App, { emitter, spec, startTime, artifactPath, reportPath }),
    { incrementalRendering: true },
  );

  const report = await runSpec(spec, { ...options, emitter });

  await new Promise(r => setTimeout(r, 100));
  app.unmount();
  await app.waitUntilExit();

  return report;
}
