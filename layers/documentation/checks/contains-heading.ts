import type { CheckResult, Criterion } from '../../../src/types.js';

interface Heading {
  level: number;
  text: string;
}

function parseHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  for (const line of markdown.split('\n')) {
    const match = /^(#{1,6})\s+(.+)$/.exec(line.trim());
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
      });
    }
  }
  return headings;
}

export function containsHeading(markdown: string, criterion: Criterion): CheckResult {
  const search = criterion.heading ?? '';
  const headings = parseHeadings(markdown);
  const lowerSearch = search.toLowerCase();

  const matches = headings.filter((h) => h.text.toLowerCase().includes(lowerSearch));

  if (matches.length === 0) {
    return {
      criterion: criterion.check,
      pass: false,
      message: `Heading "${search}" not found in content.`,
    };
  }

  if (criterion.level !== undefined) {
    const levelMatches = matches.filter((h) => h.level === criterion.level);
    if (levelMatches.length === 0) {
      const foundLevels = matches.map((h) => `h${h.level}`).join(', ');
      return {
        criterion: criterion.check,
        pass: false,
        message: `Heading "${search}" found but at wrong level (found: ${foundLevels}, expected: h${criterion.level}).`,
      };
    }
  }

  return {
    criterion: criterion.check,
    pass: true,
    message: `Heading "${search}" found.`,
  };
}
