import { normalizeDraft } from '../vocabulary/draft.ts';
import { vocabularyDraftIssues } from '../vocabulary/validation.ts';

import type { Article, CefrLevel, ImportedNoteDraft, LexemeKind } from '../types.ts';

const LEADING_ARTICLE = /^(der|die|das)\s+/iu;
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const MAX_IMPORT_RECORDS = 100_000;
const MAX_IMPORT_COLUMNS = 32;
const MAX_IMPORT_FIELD_LENGTH = 10_000;
const DELIMITERS = ['\t', '|', ';', ','] as const;
const CEFR_LEVELS = new Set<CefrLevel>(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
const KIND_ALIASES = new Map<string, LexemeKind>([
  ['noun', 'noun'],
  ['substantiv', 'noun'],
  ['podstatne', 'noun'],
  ['podstatne jmeno', 'noun'],
  ['verb', 'verb'],
  ['sloveso', 'verb'],
  ['adjective', 'adjective'],
  ['adjektivum', 'adjective'],
  ['pridavne', 'adjective'],
  ['pridavne jmeno', 'adjective'],
  ['phrase', 'phrase'],
  ['fraze', 'phrase'],
  ['spojeni', 'phrase'],
  ['other', 'other'],
  ['ostatni', 'other'],
  ['jine', 'other'],
]);

function parseDisplayGerman(value: string): { article?: Article; word: string } {
  const trimmed = value
    .trim()
    .replace(/^[„“”"']+|[„“”"']+$/gu, '')
    .trim();
  const match = trimmed.match(LEADING_ARTICLE);
  if (!match) return { word: trimmed };
  return {
    article: match[1].toLocaleLowerCase('de-DE') as Article,
    word: trimmed.replace(LEADING_ARTICLE, '').trim(),
  };
}

export type ImportIssue = {
  line: number;
  severity: 'error' | 'warning';
  message: string;
  source: string;
};

export type ParseImportResult = {
  notes: ImportedNoteDraft[];
  issues: ImportIssue[];
  ignoredLines: number;
};

type LogicalRecord = {
  source: string;
  line: number;
  malformedQuote: boolean;
};

function splitLogicalRecords(source: string): LogicalRecord[] {
  const records: LogicalRecord[] = [];
  let record = '';
  let line = 1;
  let recordLine = 1;
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        record += '""';
        index += 1;
        continue;
      }
      quoted = !quoted;
      record += character;
      continue;
    }
    if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      records.push({ source: record, line: recordLine, malformedQuote: false });
      record = '';
      line += 1;
      recordLine = line;
      continue;
    }
    if (character === '\n') line += 1;
    record += character;
  }

  records.push({ source: record, line: recordLine, malformedQuote: quoted });
  return records;
}

function countDelimiter(record: string, delimiter: (typeof DELIMITERS)[number]): number {
  let count = 0;
  let quoted = false;
  for (let index = 0; index < record.length; index += 1) {
    const character = record[index];
    if (character === '"') {
      if (quoted && record[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && character === delimiter) {
      count += 1;
    }
  }
  return count;
}

function detectDelimiter(record: string): (typeof DELIMITERS)[number] | undefined {
  // Tabs and pipes are explicit import dialects. Their fields commonly contain unquoted commas,
  // so never let punctuation inside a translation outweigh the structural delimiter.
  for (const delimiter of ['\t', '|'] as const) {
    if (countDelimiter(record, delimiter) > 0) return delimiter;
  }
  let best: (typeof DELIMITERS)[number] | undefined;
  let bestCount = 0;
  for (const delimiter of [';', ','] as const) {
    const count = countDelimiter(record, delimiter);
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

function parseDelimitedRecord(
  record: string,
  delimiter: (typeof DELIMITERS)[number],
): { columns: string[]; malformedQuote: boolean; oversizedField: boolean } {
  const columns: string[] = [];
  let field = '';
  let quoted = false;
  let oversizedField = false;

  for (let index = 0; index < record.length; index += 1) {
    const character = record[index];
    if (character === '"') {
      if (quoted && record[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && character === delimiter) {
      columns.push(field.trim());
      field = '';
      continue;
    }
    field += character;
    if (field.length > MAX_IMPORT_FIELD_LENGTH) oversizedField = true;
  }
  columns.push(field.trim());
  return { columns, malformedQuote: quoted, oversizedField };
}

function normalizedLabel(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('cs-CZ')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[-_]+/gu, ' ')
    .replace(/\s+/gu, ' ');
}

function parseExplicitKind(value: string): LexemeKind | undefined {
  if (!value.trim()) return undefined;
  return KIND_ALIASES.get(normalizedLabel(value));
}

function parseCefr(value: string): CefrLevel | undefined {
  if (!value.trim()) return undefined;
  const level = value.trim().toLocaleUpperCase('en-US') as CefrLevel;
  return CEFR_LEVELS.has(level) ? level : undefined;
}

function looksLikeSourceInfinitive(value: string): boolean {
  return value.split(/[,/;]/u).some((part) => {
    const candidate = part.trim();
    return /^to\s+\p{L}/iu.test(candidate) || /\p{L}+t(?:\s+(?:se|si))?$/iu.test(candidate);
  });
}

function detectKind(german: string, czech: string, hasArticle: boolean): LexemeKind {
  if (hasArticle) return 'noun';
  if (/\s/u.test(german)) return 'phrase';
  if (/^(sein|haben|werden|tun)$/iu.test(german)) return 'verb';
  if (/en$/iu.test(german) && looksLikeSourceInfinitive(czech)) return 'verb';
  return 'other';
}

function cleanTags(raw: string): string[] {
  return [...new Set(raw.split(',').map((tag) => tag.trim().toLocaleLowerCase('cs-CZ')))]
    .filter(Boolean)
    .slice(0, 20);
}

export function parseQuickImport(source: string): ParseImportResult {
  const notes: ImportedNoteDraft[] = [];
  const issues: ImportIssue[] = [];
  let ignoredLines = 0;
  const seen = new Set<string>();

  const normalizedSource = source.replace(/^\uFEFF/u, '');
  if (new TextEncoder().encode(normalizedSource).byteLength > MAX_IMPORT_BYTES) {
    return {
      notes,
      ignoredLines,
      issues: [
        {
          line: 1,
          severity: 'error',
          message: 'Import je příliš velký. Limit je 2 MB.',
          source: '',
        },
      ],
    };
  }

  const records = splitLogicalRecords(normalizedSource);
  if (records.length > MAX_IMPORT_RECORDS) {
    return {
      notes,
      ignoredLines,
      issues: [
        {
          line: 1,
          severity: 'error',
          message: 'Import obsahuje příliš mnoho řádků. Limit je 100 000.',
          source: '',
        },
      ],
    };
  }

  for (const record of records) {
    const rawLine = record.source;
    const lineNumber = record.line;
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      ignoredLines += 1;
      continue;
    }

    if (record.malformedQuote) {
      issues.push({
        line: lineNumber,
        severity: 'error',
        message: 'Řádek obsahuje neuzavřené uvozovky.',
        source: rawLine.slice(0, 500),
      });
      continue;
    }

    const delimiter = detectDelimiter(trimmed);
    if (!delimiter) {
      issues.push({
        line: lineNumber,
        severity: 'error',
        message: 'Řádek musí obsahovat oddělovač a alespoň německý a český výraz.',
        source: rawLine.slice(0, 500),
      });
      continue;
    }
    const parsedRecord = parseDelimitedRecord(trimmed, delimiter);
    const columns = parsedRecord.columns;
    if (parsedRecord.malformedQuote || parsedRecord.oversizedField) {
      issues.push({
        line: lineNumber,
        severity: 'error',
        message: parsedRecord.malformedQuote
          ? 'Řádek obsahuje neplatné uvozovky.'
          : 'Jedno z polí překročilo limit 10 000 znaků.',
        source: rawLine.slice(0, 500),
      });
      continue;
    }
    if (columns.length > MAX_IMPORT_COLUMNS) {
      issues.push({
        line: lineNumber,
        severity: 'error',
        message: 'Řádek obsahuje příliš mnoho sloupců.',
        source: rawLine.slice(0, 500),
      });
      continue;
    }
    const [rawGerman = '', czech = '', plural = '', rawTags = '', rawKind = '', rawCefr = ''] =
      columns;

    if (columns.length < 2 || !rawGerman || !czech) {
      issues.push({
        line: lineNumber,
        severity: 'error',
        message: 'Řádek musí obsahovat alespoň německý a český výraz.',
        source: rawLine,
      });
      continue;
    }

    if (columns.length > 6) {
      issues.push({
        line: lineNumber,
        severity: 'warning',
        message: 'Sloupce za úrovní CEFR byly ignorovány.',
        source: rawLine,
      });
    }

    const parsedGerman = parseDisplayGerman(rawGerman);
    if (!parsedGerman.word) {
      issues.push({
        line: lineNumber,
        severity: 'error',
        message: 'Německý výraz je prázdný.',
        source: rawLine,
      });
      continue;
    }

    const explicitKind = parseExplicitKind(rawKind);
    if (rawKind && !explicitKind) {
      issues.push({
        line: lineNumber,
        severity: 'error',
        message: 'Neznámý druh výrazu. Použij noun, verb, adjective, phrase nebo other.',
        source: rawLine,
      });
      continue;
    }

    const cefr = parseCefr(rawCefr);
    if (rawCefr && !cefr) {
      issues.push({
        line: lineNumber,
        severity: 'error',
        message: 'Neplatná úroveň CEFR. Použij A1, A2, B1, B2, C1 nebo C2.',
        source: rawLine,
      });
      continue;
    }

    const kind =
      explicitKind ?? detectKind(parsedGerman.word, czech, Boolean(parsedGerman.article));
    if (parsedGerman.article && kind !== 'noun') {
      issues.push({
        line: lineNumber,
        severity: 'error',
        message: 'Výraz se členem musí mít druh noun (podstatné jméno).',
        source: rawLine,
      });
      continue;
    }

    if (plural && kind !== 'noun') {
      issues.push({
        line: lineNumber,
        severity: 'warning',
        message: 'Množné číslo bylo u výrazu, který není podstatné jméno, ignorováno.',
        source: rawLine,
      });
    }

    const draft = normalizeDraft({
      german: parsedGerman.word,
      normalizedGerman: '',
      czech,
      kind,
      article: kind === 'noun' ? parsedGerman.article : undefined,
      plural: kind === 'noun' ? plural || undefined : undefined,
      acceptedGerman: [],
      acceptedCzech: [],
      tags: cleanTags(rawTags),
      cefr,
      source: 'import',
      sourceLine: lineNumber,
    });

    if (seen.has(draft.normalizedGerman)) {
      issues.push({
        line: lineNumber,
        severity: 'warning',
        message: 'Duplicitní položka v tomto importu byla přeskočena.',
        source: rawLine,
      });
      continue;
    }

    const validationIssues = vocabularyDraftIssues(draft);
    if (validationIssues.length > 0) {
      issues.push({
        line: lineNumber,
        severity: 'error',
        message: validationIssues[0],
        source: rawLine,
      });
      continue;
    }

    seen.add(draft.normalizedGerman);
    notes.push(draft);
  }

  return { notes, issues, ignoredLines };
}
