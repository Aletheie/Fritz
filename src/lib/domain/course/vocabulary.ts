import { normalizeGermanKey } from '../grading/normalize.ts';
import type { CourseProgress, CourseVocabularyEvent, Note, StudyCard } from '../types.ts';
import { createNoteAndCard } from '../vocabulary/factory.ts';
import { courseFoundations } from './course-foundations.ts';
import {
  chapterForPathNode,
  completeCoursePathNode,
  coursePathNodeById,
  courseSystemTags,
} from './path.ts';

import type { DetailedCefrLevel } from '../types.ts';
import type { CompleteCoursePathNodeResult } from './path.ts';

export type CourseVocabularyLinkSummary = {
  added: number;
  linked: number;
  alreadyLinked: number;
  addedNoteIds: string[];
  linkedNoteIds: string[];
  message: string;
};

export type CourseVocabularyMutation = {
  notesToPut: Note[];
  cardsToPut: StudyCard[];
  event?: CourseVocabularyEvent;
  summary: CourseVocabularyLinkSummary;
};

export type CourseVocabularyCompletion = {
  completion: CompleteCoursePathNodeResult;
  vocabulary: CourseVocabularyMutation;
  progress: CourseProgress;
};

/**
 * Keeps course progress internally consistent when a learner explicitly deletes
 * a vocabulary note. The completed course node and its idempotency event remain,
 * but the deleted note is no longer referenced by the event or a backup.
 */
export function removeNoteFromCourseVocabularyEvents(
  progress: CourseProgress,
  noteId: string,
  now = new Date(),
): CourseProgress {
  let changed = false;
  const vocabularyEvents = progress.vocabularyEvents.map((event) => {
    const addedNoteIds = event.addedNoteIds.filter((id) => id !== noteId);
    const linkedNoteIds = event.linkedNoteIds.filter((id) => id !== noteId);
    if (
      addedNoteIds.length === event.addedNoteIds.length &&
      linkedNoteIds.length === event.linkedNoteIds.length
    ) {
      return event;
    }
    changed = true;
    return { ...event, addedNoteIds, linkedNoteIds };
  });

  return changed ? { ...progress, vocabularyEvents, updatedAt: now.toISOString() } : progress;
}

function mergeUnique(values: string[], additions: string[]): string[] {
  const result = [...values];
  const seen = new Set(values.map((value) => value.toLocaleLowerCase('cs-CZ')));
  for (const addition of additions) {
    const key = addition.toLocaleLowerCase('cs-CZ');
    if (!seen.has(key)) {
      seen.add(key);
      result.push(addition);
    }
  }
  return result;
}

function addedWordsSentence(count: number): string {
  if (count === 1) return 'Bylo přidáno 1 nové slovo.';
  if (count >= 2 && count <= 4) return `Byla přidána ${count} nová slova.`;
  return `Bylo přidáno ${count} nových slov.`;
}

function linkedWordsSentence(count: number): string {
  if (count === 1) return '1 existující slovo bylo propojeno s kurzem.';
  if (count >= 2 && count <= 4) return `${count} existující slova byla propojena s kurzem.`;
  return `${count} existujících slov bylo propojeno s kurzem.`;
}

function completionMessage(added: number, linked: number, total: number): string {
  if (added === total) {
    return `Do dlouhodobého učení ${addedWordsSentence(total).toLocaleLowerCase('cs-CZ')}`;
  }
  if (added > 0 && linked > 0) {
    return `${addedWordsSentence(added)} ${linkedWordsSentence(linked)}`;
  }
  if (linked === total) {
    return `Všech ${total} slov už máš ve Slovníku. Propojili jsme je s touto kapitolou.`;
  }
  return 'Kurzová slovíčka už jsou propojená s dlouhodobým učením.';
}

function removedWordsSentence(count: number): string {
  if (count === 1) return '1 dříve odstraněné slovo zůstává odstraněné.';
  if (count >= 2 && count <= 4) {
    return `${count} dříve odstraněná slova zůstávají odstraněná.`;
  }
  return `${count} dříve odstraněných slov zůstává odstraněných.`;
}

export function buildCourseVocabularyMutation(input: {
  progress: CourseProgress;
  notes: Note[];
  deckId: string;
  nodeId: string;
  now?: Date;
}): CourseVocabularyMutation {
  const node = coursePathNodeById(input.nodeId);
  const chapter = chapterForPathNode(input.nodeId);
  if (!node || !chapter || node.type !== 'vocabulary') {
    throw new Error('Tento kurzový krok nepředstavuje nová slovíčka.');
  }

  const existingEvent = input.progress.vocabularyEvents.find((event) => event.nodeId === node.id);
  const foundationLemmas = new Set(
    (courseFoundations[chapter.id] ?? []).map((word) => word.german),
  );
  const wordsToImport = existingEvent
    ? chapter.words.filter(
        (word) => existingEvent.foundationRevision !== 1 && foundationLemmas.has(word.german),
      )
    : chapter.words;
  if (existingEvent && !wordsToImport.length) {
    const stillLinked = input.notes.filter((note) =>
      (note.courseLinks ?? []).some((link) => link.nodeId === node.id),
    ).length;
    const removed = Math.max(0, chapter.words.length - stillLinked);
    return {
      notesToPut: [],
      cardsToPut: [],
      summary: {
        added: 0,
        linked: 0,
        alreadyLinked: stillLinked,
        addedNoteIds: [],
        linkedNoteIds: [],
        message:
          removed > 0
            ? `Kurzový import už proběhl. ${removedWordsSentence(removed)}`
            : 'Kurzová slovíčka už jsou propojená s dlouhodobým učením.',
      },
    };
  }

  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  const systemTags = courseSystemTags(chapter);
  const byNormalized = new Map<string, Note>();
  for (const note of input.notes) {
    if (note.deckId === input.deckId) byNormalized.set(note.normalizedGerman, note);
  }
  const notesToPut: Note[] = [];
  const cardsToPut: StudyCard[] = [];
  const addedNoteIds: string[] = [];
  const linkedNoteIds: string[] = [];
  let alreadyLinked = 0;

  for (const word of wordsToImport) {
    const normalizedGerman = normalizeGermanKey(word.german, word.article);
    const existing = byNormalized.get(normalizedGerman);
    if (existing) {
      const alreadyHasLink = (existing.courseLinks ?? []).some((link) => link.nodeId === node.id);
      const nextSystemTags = mergeUnique(existing.systemTags ?? [], systemTags);
      if (alreadyHasLink && nextSystemTags.length === (existing.systemTags ?? []).length) {
        alreadyLinked += 1;
        continue;
      }
      const note: Note = {
        ...existing,
        systemTags: nextSystemTags,
        courseLinks: alreadyHasLink
          ? existing.courseLinks
          : [
              ...(existing.courseLinks ?? []),
              { chapterId: chapter.id, nodeId: node.id, linkedAt: timestamp },
            ],
        updatedAt: timestamp,
      };
      notesToPut.push(note);
      byNormalized.set(normalizedGerman, note);
      linkedNoteIds.push(note.id);
      continue;
    }

    const created = createNoteAndCard(
      input.deckId,
      {
        german: word.german,
        normalizedGerman,
        czech: word.czech,
        kind: word.kind,
        article: word.article,
        plural: word.plural === '—' ? undefined : word.plural,
        acceptedGerman: word.acceptedGerman ?? [],
        acceptedCzech: word.acceptedCzech ?? [],
        tags: [],
        exampleDe: word.exampleDe,
        exampleCs: word.exampleCs,
        cefr: word.cefr,
        learningNote: word.learningNote,
        verbForms: word.verbForms,
        source: 'course',
        systemTags,
        courseLinks: [{ chapterId: chapter.id, nodeId: node.id, linkedAt: timestamp }],
      },
      now,
    );
    notesToPut.push(created.note);
    cardsToPut.push(created.card);
    byNormalized.set(normalizedGerman, created.note);
    addedNoteIds.push(created.note.id);
  }

  const event: CourseVocabularyEvent = {
    id: `course-vocabulary:${node.id}`,
    nodeId: node.id,
    chapterId: chapter.id,
    completedAt: existingEvent?.completedAt ?? timestamp,
    addedNoteIds: [...(existingEvent?.addedNoteIds ?? []), ...addedNoteIds],
    linkedNoteIds: [...(existingEvent?.linkedNoteIds ?? []), ...linkedNoteIds],
    ...(foundationLemmas.size ? { foundationRevision: 1 as const } : {}),
    systemTags,
  };
  const added = addedNoteIds.length;
  const linked = linkedNoteIds.length;
  return {
    notesToPut,
    cardsToPut,
    event,
    summary: {
      added,
      linked,
      alreadyLinked,
      addedNoteIds,
      linkedNoteIds,
      message: completionMessage(added, linked, wordsToImport.length),
    },
  };
}

export function buildCourseVocabularyCompletion(input: {
  progress: CourseProgress;
  notes: Note[];
  deckId: string;
  nodeId: string;
  stars?: number;
  minimumLevel?: DetailedCefrLevel;
  now?: Date;
}): CourseVocabularyCompletion {
  const now = input.now ?? new Date();
  const vocabulary = buildCourseVocabularyMutation({ ...input, now });
  const completion = completeCoursePathNode(
    input.progress,
    input.nodeId,
    input.stars,
    now,
    input.minimumLevel,
  );
  const progress = vocabulary.event
    ? {
        ...completion.progress,
        vocabularyEvents: [
          ...completion.progress.vocabularyEvents.filter(
            (event) => event.id !== vocabulary.event?.id,
          ),
          vocabulary.event,
        ],
      }
    : completion.progress;
  return {
    completion: { ...completion, progress },
    vocabulary,
    progress,
  };
}
