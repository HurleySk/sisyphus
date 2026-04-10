/**
 * Remove fenced code blocks (``` ... ```) from markdown.
 * Returns markdown with code blocks replaced by empty lines.
 */
export function stripFencedCodeBlocks(markdown: string): string {
  return markdown.replace(/^(`{3,})[^\n]*\n[\s\S]*?\n\1\s*$/gm, '');
}

/**
 * Split a table row respecting escaped pipes (\|) and inline code backticks.
 * Returns array of trimmed cell values.
 */
export function splitTableRow(line: string): string[] {
  // Remove leading/trailing pipes
  const inner = line.replace(/^\|/, '').replace(/\|$/, '');

  const cells: string[] = [];
  let current = '';
  let inCode = false;
  let i = 0;

  while (i < inner.length) {
    const char = inner[i];

    if (char === '`') {
      inCode = !inCode;
      current += char;
      i++;
    } else if (char === '\\' && i + 1 < inner.length && inner[i + 1] === '|') {
      // Escaped pipe
      current += '|';
      i += 2;
    } else if (char === '|' && !inCode) {
      cells.push(current.trim());
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }

  cells.push(current.trim());
  return cells.filter(c => c.length > 0 || cells.length > 1); // keep empty cells in multi-cell rows
}
