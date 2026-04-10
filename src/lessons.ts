import fs from 'fs/promises';
import path from 'path';
import type { Lesson } from './types.js';

const DEFAULT_BUDGET_CHARS = 2000;

export async function loadLessons(lessonsDir: string, layerName?: string): Promise<Lesson[]> {
  const globalPath = path.join(lessonsDir, 'global.json');
  const results: Lesson[] = [];

  try {
    const raw = await fs.readFile(globalPath, 'utf-8');
    const parsed = JSON.parse(raw) as Lesson[];
    results.push(...parsed);
  } catch {
    // global.json missing or unreadable — treat as empty
  }

  if (layerName) {
    const layerPath = path.join(lessonsDir, `${layerName}.json`);
    try {
      const raw = await fs.readFile(layerPath, 'utf-8');
      const parsed = JSON.parse(raw) as Lesson[];
      results.push(...parsed);
    } catch {
      // layer file missing or unreadable — treat as empty
    }
  }

  return results;
}

export function filterLessons(lessons: Lesson[], relevanceTags: string[]): Lesson[] {
  let filtered: Lesson[];

  if (relevanceTags.length === 0) {
    filtered = [...lessons];
  } else {
    const tagSet = new Set(relevanceTags);
    const matched = lessons.filter(l => l.relevance.some(tag => tagSet.has(tag)));
    filtered = matched.length > 0 ? matched : [...lessons];
  }

  return filtered.sort((a, b) => {
    if (b.useCount !== a.useCount) return b.useCount - a.useCount;
    return b.lastUsed.localeCompare(a.lastUsed);
  });
}

export function formatLessonsForPrompt(lessons: Lesson[], budgetChars: number = DEFAULT_BUDGET_CHARS): string {
  if (lessons.length === 0) return '';

  const lines: string[] = [];
  let totalChars = 0;

  for (let i = 0; i < lessons.length; i++) {
    const line = `${i + 1}. ${lessons[i].text}`;
    const addition = lines.length === 0 ? line.length : 1 + line.length; // +1 for \n
    if (totalChars + addition > budgetChars) break;
    lines.push(line);
    totalChars += addition;
  }

  return lines.join('\n');
}

export async function saveLessons(lessonsDir: string, fileName: string, lessons: Lesson[]): Promise<void> {
  const filePath = path.join(lessonsDir, fileName);
  await fs.writeFile(filePath, JSON.stringify(lessons, null, 2), 'utf-8');
}
