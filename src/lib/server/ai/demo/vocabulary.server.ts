import { normalizeGermanKey } from '../../../domain/grading/normalize.ts';
import { sourceMeaning } from '../../../i18n/vocabulary.ts';
import { DEMO_MODEL } from './model.server.ts';
import type { DemoEntry } from './word-bank.server.ts';
import { common, entry, food, school, shopping, topicGroups, travel } from './word-bank.server.ts';

import type {
  AiGeneratedVocabularyItem,
  AiVocabularyRequest,
  AiVocabularyResult,
} from '../../../domain/ai/types.ts';
import type { Article, CefrLevel, MotherTongue } from '../../../domain/types.ts';

function cloneItem(
  item: DemoEntry,
  level: CefrLevel,
  includeMnemonic = false,
  language: MotherTongue = 'cs',
): AiGeneratedVocabularyItem {
  const source = sourceMeaning(item.german.replace(/\s+\(\d+\)$/u, ''), item.czech, language);
  const mnemonic = includeMnemonic
    ? language === 'en'
      ? item.article
        ? `Learn it as one unit: “${item.article} ${item.german.replace(/^(der|die|das)\s+/iu, '')}”.`
        : item.german.includes(' ')
          ? 'Say the whole phrase three times in one rhythm, not word by word.'
          : null
      : (item.mnemonic ?? mnemonicFor(item.german, item.article))
    : null;
  return {
    ...item,
    czech: source,
    acceptedGerman: [...item.acceptedGerman],
    acceptedCzech: language === 'en' ? [] : [...item.acceptedCzech],
    tags:
      language === 'en'
        ? ['practical German', level.toLowerCase()]
        : [...new Set([...item.tags, level.toLowerCase()])],
    exampleCs: language === 'en' ? null : item.exampleCs,
    learningNote:
      language === 'en'
        ? item.article
          ? `Learn “${item.article} ${item.german}” as one unit so the noun's gender stays attached.`
          : item.kind === 'verb'
            ? 'Notice the verb form and use it in one short German sentence.'
            : 'Use this expression in one short German sentence of your own.'
        : item.learningNote,
    cefr: item.cefr ?? level,
    mnemonic,
    verbForms: item.verbForms ? { ...item.verbForms } : null,
  };
}

function mnemonicFor(german: string, article: Article | null): string | null {
  if (article)
    return `Uč se jako jeden zvukový celek: „${article} ${german.replace(/^(der|die|das)\s+/iu, '')}“.`;
  if (german.includes(' '))
    return `Řekni celou frázi třikrát v jednom rytmu, ne po jednotlivých slovech.`;
  return null;
}

function topicPool(topic: string): { title: string; entries: DemoEntry[] } {
  const group = topicGroups.find((candidate) => candidate.pattern.test(topic));
  if (!group) return { title: 'Praktická němčina', entries: common };
  return { title: group.title, entries: [...group.entries, ...common] };
}

function requestedKindMatches(item: DemoEntry, request: AiVocabularyRequest): boolean {
  if (request.mode !== 'generate' || request.focus === 'balanced') return true;
  if (request.focus === 'nouns') return item.kind === 'noun';
  if (request.focus === 'verbs') return item.kind === 'verb';
  return item.kind === 'phrase';
}

function uniqueItems(entries: DemoEntry[]): DemoEntry[] {
  const seen = new Set<string>();
  return entries.filter((item) => {
    const key = normalizeGermanKey(item.german, item.article ?? undefined);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function genericFallback(index: number): DemoEntry {
  const variants: DemoEntry[] = [
    entry('Könnten Sie das bitte wiederholen?', 'Můžete to prosím zopakovat?', 'phrase', {
      exampleDe: 'Entschuldigung, könnten Sie das bitte wiederholen?',
      exampleCs: 'Promiňte, můžete to prosím zopakovat?',
    }),
    entry('Was bedeutet das?', 'Co to znamená?', 'phrase', {
      exampleDe: 'Was bedeutet dieses Wort?',
      exampleCs: 'Co znamená toto slovo?',
    }),
    entry('Ich bin mir nicht sicher.', 'Nejsem si jistý/jistá.', 'phrase', {
      exampleDe: 'Ich bin mir bei der Antwort nicht sicher.',
      exampleCs: 'Nejsem si jistá odpovědí.',
    }),
    entry('gemeinsam', 'společně', 'adjective', {
      exampleDe: 'Wir lernen gemeinsam.',
      exampleCs: 'Učíme se společně.',
    }),
    entry('verbessern', 'zlepšit', 'verb', {
      exampleDe: 'Ich möchte mein Deutsch verbessern.',
      exampleCs: 'Chci zlepšit svou němčinu.',
      verbForms: {
        thirdPerson: 'verbessert',
        preterite: 'verbesserte',
        participle: 'verbessert',
        auxiliary: 'haben',
      },
    }),
  ];
  const base = variants[index % variants.length];
  return {
    ...base,
    german: index < variants.length ? base.german : `${base.german} (${index + 1})`,
  };
}

function generationResult(
  request: Extract<AiVocabularyRequest, { mode: 'generate' }>,
): AiVocabularyResult {
  const selected = topicPool(request.topic);
  let candidates = uniqueItems(
    selected.entries.filter((item) => requestedKindMatches(item, request)),
  );
  if (candidates.length < request.count) {
    candidates = uniqueItems([
      ...candidates,
      ...[...travel, ...school, ...food, ...shopping, ...common].filter((item) =>
        requestedKindMatches(item, request),
      ),
    ]);
  }
  while (candidates.length < request.count) candidates.push(genericFallback(candidates.length));
  return {
    title:
      request.motherTongue === 'en'
        ? ({
            'Cestování bez zmatku': 'Travel without confusion',
            'Škola a učení': 'School and learning',
            'V kavárně a restauraci': 'At a café and restaurant',
            Nakupování: 'Shopping',
            'Praktická němčina': 'Practical German',
          }[selected.title] ?? 'Practical German')
        : selected.title,
    summary:
      request.motherTongue === 'en'
        ? `A short ${request.level} set. Review the suggestions first and save only expressions that fit your current lesson.`
        : `Krátká sada pro úroveň ${request.level}. Nejdřív projdi návrhy a ulož jen výrazy, které se hodí do aktuální lekce.`,
    items: candidates
      .slice(0, request.count)
      .map((item) =>
        cloneItem(item, request.level, request.includeMnemonics, request.motherTongue),
      ),
    model: DEMO_MODEL,
  };
}

function extractionResult(
  request: Extract<AiVocabularyRequest, { mode: 'extract' }>,
): AiVocabularyResult {
  const lower = request.text.toLocaleLowerCase('de-DE');
  const dictionary = uniqueItems([...travel, ...school, ...food, ...shopping, ...common]);
  const matches = dictionary.filter((item) => {
    const bare = item.german.replace(/^(der|die|das)\s+/iu, '').toLocaleLowerCase('de-DE');
    const stem = bare.split(/\s+/u).find((part) => part.length >= 4) ?? bare;
    return lower.includes(bare) || lower.includes(stem);
  });
  const pool = uniqueItems([...matches, ...topicPool(request.text).entries, ...common]);
  return {
    title:
      request.motherTongue === 'en' ? 'Expressions from your text' : 'Výrazy z vloženého textu',
    summary:
      request.motherTongue === 'en'
        ? 'These are sample words. Review their meanings and examples before saving.'
        : 'Tohle jsou ukázková slovíčka. Před uložením si projdi jejich významy a příklady.',
    items: pool
      .slice(0, request.count)
      .map((item) =>
        cloneItem(item, request.level, request.includeMnemonics, request.motherTongue),
      ),
    model: DEMO_MODEL,
  };
}

function enrichResult(
  request: Extract<AiVocabularyRequest, { mode: 'enrich' }>,
): AiVocabularyResult {
  const note = request.note;
  const known = uniqueItems([...travel, ...school, ...food, ...shopping, ...common]).find(
    (candidate) =>
      normalizeGermanKey(candidate.german, candidate.article ?? undefined) ===
      normalizeGermanKey(note.german, note.article),
  );
  const level = note.cefr ?? 'A2';
  const base = known
    ? cloneItem(known, level, true, request.motherTongue)
    : ({
        german: note.german,
        czech: note.czech,
        kind: note.kind,
        article: note.kind === 'noun' ? (note.article ?? null) : null,
        plural: note.kind === 'noun' ? (note.plural ?? null) : null,
        acceptedGerman: [...note.acceptedGerman],
        acceptedCzech: [...note.acceptedCzech],
        tags: [...new Set([...note.tags, level.toLowerCase()])],
        exampleDe: note.exampleDe ?? `Ich benutze das Wort „${note.german}“ in einem kurzen Satz.`,
        exampleCs:
          request.motherTongue === 'en'
            ? null
            : (note.exampleCs ?? `Používám slovo „${note.czech}“ v krátké větě.`),
        cefr: level,
        learningNote:
          note.learningNote ??
          (request.motherTongue === 'en'
            ? note.kind === 'noun' && note.article
              ? `Always learn this expression with the article “${note.article}”.`
              : 'Use the expression in one short German sentence of your own.'
            : note.kind === 'noun' && note.article
              ? `Uč se výraz vždy se členem „${note.article}“.`
              : 'Zkus výraz použít ještě ve vlastní krátké větě.'),
        mnemonic:
          note.mnemonic ??
          (request.motherTongue === 'en'
            ? note.article
              ? `Learn “${note.article} ${note.german}” as one unit.`
              : null
            : mnemonicFor(note.german, note.article ?? null)),
        verbForms: note.verbForms
          ? {
              thirdPerson: note.verbForms.thirdPerson ?? null,
              preterite: note.verbForms.preterite ?? null,
              participle: note.verbForms.participle ?? null,
              auxiliary: note.verbForms.auxiliary ?? null,
            }
          : null,
      } satisfies AiGeneratedVocabularyItem);

  return {
    title:
      request.motherTongue === 'en' ? `Enrichment: ${note.german}` : `Doplnění: ${note.german}`,
    summary:
      request.motherTongue === 'en'
        ? 'The card has been filled in. Check it before saving.'
        : 'Kartička je doplněná. Před uložením si ji zkontroluj.',
    items: [
      {
        ...base,
        german: note.german,
        czech: note.czech,
        acceptedGerman: [...new Set([...base.acceptedGerman, ...note.acceptedGerman])],
        acceptedCzech: [...new Set([...base.acceptedCzech, ...note.acceptedCzech])],
        tags: [...new Set([...base.tags, ...note.tags])].slice(0, 8),
      },
    ],
    model: DEMO_MODEL,
  };
}

export function demoVocabulary(request: AiVocabularyRequest): AiVocabularyResult {
  if (request.mode === 'generate') return generationResult(request);
  if (request.mode === 'extract') return extractionResult(request);
  return enrichResult(request);
}
