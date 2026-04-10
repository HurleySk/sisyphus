// Copy non-TS assets to dist/ after tsc compilation.
// Handles: lib/spec-schema.json, layers/*/prompts/**
const { cpSync, mkdirSync, readdirSync, statSync } = require('fs');
const path = require('path');

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      cpSync(srcPath, destPath);
    }
  }
}

// Copy spec schema
mkdirSync('dist/lib', { recursive: true });
cpSync('lib/spec-schema.json', 'dist/lib/spec-schema.json');

// Copy prompts directories from all layers
const layersDir = 'layers';
for (const layer of readdirSync(layersDir)) {
  const promptsSrc = path.join(layersDir, layer, 'prompts');
  try {
    if (statSync(promptsSrc).isDirectory()) {
      const promptsDest = path.join('dist', layersDir, layer, 'prompts');
      copyDir(promptsSrc, promptsDest);
      console.log(`Copied ${promptsSrc} -> ${promptsDest}`);
    }
  } catch {
    // No prompts dir for this layer — skip
  }
}
