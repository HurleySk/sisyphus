import type { CheckResult, Criterion } from '../../../src/types.js';

/**
 * Strip markdown syntax and return plain text suitable for word counting.
 * Order matters: strip table rows before other processing to avoid counting
 * table cell content or pipe characters as words.
 */
function stripMarkdown(markdown: string): string {
  let text = markdown;

  // Remove table rows (lines that start and end with |)
  text = text.replace(/^\|.+\|$/gm, '');

  // Remove headings (# symbols at start of line)
  text = text.replace(/^#{1,6}\s+/gm, '');

  // Remove images: ![alt](url)
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '');

  // Remove links: [text](url) → keep text
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

  // Remove inline code: `code`
  text = text.replace(/`[^`]+`/g, '');

  // Remove bold/italic: **text** or __text__ or *text* or _text_ → keep text
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');

  // Remove blockquote markers
  text = text.replace(/^>\s*/gm, '');

  // Remove list markers (-, *, +, or numbered)
  text = text.replace(/^[\s]*[-*+]\s+/gm, '');
  text = text.replace(/^[\s]*\d+\.\s+/gm, '');

  return text;
}

function countWords(markdown: string): number {
  const stripped = stripMarkdown(markdown);
  return stripped
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .length;
}

export function wordCountGte(markdown: string, criterion: Criterion): CheckResult {
  const count = countWords(markdown);
  const min = criterion.min ?? 0;

  if (count >= min) {
    return {
      criterion: criterion.check,
      pass: true,
      message: `Word count is ${count}, meets minimum of ${min}.`,
    };
  }

  return {
    criterion: criterion.check,
    pass: false,
    message: `Word count is ${count}, below minimum of ${min}.`,
  };
}

export function wordCountLte(markdown: string, criterion: Criterion): CheckResult {
  const count = countWords(markdown);
  const max = criterion.max ?? Infinity;

  if (count <= max) {
    return {
      criterion: criterion.check,
      pass: true,
      message: `Word count is ${count}, within maximum of ${max}.`,
    };
  }

  return {
    criterion: criterion.check,
    pass: false,
    message: `Word count is ${count}, exceeds maximum of ${max}.`,
  };
}
