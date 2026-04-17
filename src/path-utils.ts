export function toForwardSlashes(p: string): string {
  return p.replace(/\\/g, '/');
}

export function toRelativePath(filePath: string, baseDir: string): string {
  if (!baseDir) return filePath;
  const normalizedFile = toForwardSlashes(filePath);
  const normalizedBase = toForwardSlashes(baseDir).replace(/\/$/, '') + '/';
  if (normalizedFile.startsWith(normalizedBase)) {
    return normalizedFile.slice(normalizedBase.length);
  }
  return filePath;
}
