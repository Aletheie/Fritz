import { countStoryWords, normalizeStoryWord, storyGlossaryTier } from './engine.ts';
import { storyBookIds } from './progress.ts';

import type { StoryBook, StoryExercise } from './types.ts';

export type StoryContentValidationResult = {
  ok: boolean;
  errors: string[];
  counts: {
    books: number;
    episodes: number;
    screens: number;
    checkpoints: number;
    glossaryEntries: number;
    advancedGlossaryEntries: number;
  };
};

const WORD_PATTERN = /\p{L}[\p{L}\p{M}’'-]*/gu;

function normalizedText(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('de-DE').replace(/\s+/gu, ' ');
}

function normalizedMultiset(values: readonly string[]): string {
  return values.map(normalizedText).toSorted().join('|');
}

function hasPlaceholder(value: string): boolean {
  return /(?:TODO|FIXME|lorem ipsum|placeholder|\[doplnit(?:\s[^\]]*)?\])/iu.test(value);
}

function validateChoiceExercise(
  label: string,
  options: readonly string[],
  answer: string,
  errors: string[],
): void {
  const normalized = options.map(normalizedText);
  if (options.length < 3) errors.push(`${label}: méně než tři možnosti.`);
  if (normalized.some((option) => !option) || new Set(normalized).size !== normalized.length) {
    errors.push(`${label}: prázdné nebo duplicitní možnosti.`);
  }
  if (!options.includes(answer)) errors.push(`${label}: odpověď není mezi možnostmi.`);
}

function validateStoryExercise(
  label: string,
  exercise: StoryExercise,
  episodeText: string,
  bookText: string,
  glossaryIds: ReadonlySet<string>,
  errors: string[],
): void {
  if (
    [exercise.promptCs, exercise.instructionCs, exercise.successCs].some(
      (value) => !value.trim() || hasPlaceholder(value),
    )
  ) {
    errors.push(`${label}: neúplné nebo placeholderové texty cvičení.`);
  }
  if (exercise.kind === 'order') {
    if (exercise.tokens.length < 2 || exercise.tokens.length !== exercise.answer.length) {
      errors.push(`${label}: neplatný počet úseků řazení.`);
    }
    if (normalizedMultiset(exercise.tokens) !== normalizedMultiset(exercise.answer)) {
      errors.push(`${label}: odpověď řazení neodpovídá nabídnutým úsekům.`);
    }
    if (!exercise.sentence.trim() || !episodeText.includes(exercise.sentence)) {
      errors.push(`${label}: zdrojová věta řazení není v epizodě.`);
    }
    return;
  }
  if (exercise.kind === 'cloze') {
    validateChoiceExercise(label, exercise.options, exercise.answer, errors);
    if (!episodeText.includes(`${exercise.before}${exercise.answer}${exercise.after}`)) {
      errors.push(`${label}: doplňovací věta není v epizodě.`);
    }
    if (exercise.entryId && !glossaryIds.has(exercise.entryId)) {
      errors.push(`${label}: neznámé glossary entryId ${exercise.entryId}.`);
    }
    return;
  }
  if (exercise.kind === 'recall') {
    if (
      !exercise.answer.trim() ||
      !exercise.acceptedAnswers.includes(exercise.answer) ||
      new Set(exercise.acceptedAnswers.map(normalizedText)).size !== exercise.acceptedAnswers.length
    ) {
      errors.push(`${label}: neplatné nebo duplicitní odpovědi aktivního vybavení.`);
    }
    if (!episodeText.includes(`${exercise.before}${exercise.answer}${exercise.after}`)) {
      errors.push(`${label}: věta aktivního vybavení není v epizodě.`);
    }
    if (!exercise.hintDe.trim() || exercise.hintDe === exercise.answer) {
      errors.push(`${label}: chybí bezpečná postupná nápověda.`);
    }
    if (exercise.entryId && !glossaryIds.has(exercise.entryId)) {
      errors.push(`${label}: neznámé glossary entryId ${exercise.entryId}.`);
    }
    return;
  }
  if (exercise.kind === 'memory') {
    validateChoiceExercise(label, exercise.options, exercise.answer, errors);
    if (!episodeText.includes(exercise.answer)) {
      errors.push(`${label}: správná paměťová věta není v epizodě.`);
    }
    if (exercise.options.some((option) => option.startsWith('Tato věta v právě'))) {
      errors.push(`${label}: nouzový filler místo skutečného distractoru.`);
    }
    return;
  }
  if (exercise.kind === 'sequence') {
    if (
      exercise.options.length < 3 ||
      new Set(exercise.options.map(normalizedText)).size !== exercise.options.length ||
      normalizedMultiset(exercise.options) !== normalizedMultiset(exercise.answer) ||
      exercise.options.some((option) => {
        const words = countStoryWords(option);
        return words < 5 || words > 20;
      })
    ) {
      errors.push(`${label}: dějová osa nemá tři stručné unikátní události a úplné řešení.`);
    }
    if (exercise.options.some((option) => !episodeText.includes(option))) {
      errors.push(`${label}: dějová posloupnost používá událost mimo epizodu.`);
    }
    if (!exercise.explanationCs.trim() || hasPlaceholder(exercise.explanationCs)) {
      errors.push(`${label}: dějová posloupnost nemá vysvětlení.`);
    }
    return;
  }
  if (exercise.kind === 'arc') {
    const optionIds = exercise.options.map((option) => option.id);
    const optionBeats = exercise.options.map(
      (option) => `${normalizedText(option.openingDe)}→${normalizedText(option.closingDe)}`,
    );
    const answer = exercise.options.find((option) => option.id === exercise.answerId);
    if (
      exercise.options.length !== 3 ||
      new Set(optionIds).size !== optionIds.length ||
      new Set(optionBeats).size !== optionBeats.length ||
      !answer ||
      !exercise.summaryCs.trim() ||
      hasPlaceholder(exercise.summaryCs)
    ) {
      errors.push(`${label}: oblouk scény nemá tři unikátní možnosti, řešení nebo shrnutí.`);
      return;
    }
    if (
      exercise.options.some(
        (option) =>
          !option.openingDe.trim() ||
          !option.closingDe.trim() ||
          countStoryWords(option.openingDe) > 20 ||
          countStoryWords(option.closingDe) > 20 ||
          !bookText.includes(option.openingDe) ||
          !bookText.includes(option.closingDe),
      )
    ) {
      errors.push(`${label}: oblouk scény používá textovou stopu mimo knihu.`);
    }
    if (!episodeText.includes(answer.openingDe) || !episodeText.includes(answer.closingDe)) {
      errors.push(`${label}: správný oblouk nepatří do ověřované epizody.`);
    }
    return;
  }
  if (exercise.kind === 'production') {
    const modelIsGrounded =
      episodeText.includes(exercise.modelAnswerDe) ||
      (exercise.modelAnswerDe.endsWith('.') &&
        episodeText.includes(exercise.modelAnswerDe.slice(0, -1)));
    const modelWords = countStoryWords(exercise.modelAnswerDe);
    if (
      !modelIsGrounded ||
      modelWords < 5 ||
      modelWords > 24 ||
      !/[.!?…][»”"']?$/u.test(exercise.modelAnswerDe.trim()) ||
      !exercise.starterDe.trim() ||
      exercise.minimumWords < 4 ||
      exercise.minimumWords > 20
    ) {
      errors.push(`${label}: produkční úloha nemá platnou oporu nebo rozsah.`);
    }
    if (
      exercise.checklistCs.length < 3 ||
      exercise.checklistCs.some((item) => !item.trim() || hasPlaceholder(item)) ||
      new Set(exercise.supportWords.map(normalizedText)).size !== exercise.supportWords.length
    ) {
      errors.push(`${label}: produkční úloha nemá platný checklist nebo slovní oporu.`);
    }
    return;
  }

  const pairIds = exercise.pairs.map((pair) => pair.id);
  const czechIds = exercise.czechOptions.map((option) => option.pairId);
  const germanIds = exercise.germanOptions.map((option) => option.pairId);
  if (exercise.pairs.length < 3 || new Set(pairIds).size !== pairIds.length) {
    errors.push(`${label}: neplatné nebo duplicitní matching dvojice.`);
  }
  if (
    normalizedMultiset(pairIds) !== normalizedMultiset(czechIds) ||
    normalizedMultiset(pairIds) !== normalizedMultiset(germanIds)
  ) {
    errors.push(`${label}: možnosti spojovačky neodpovídají dvojicím.`);
  }
  if (
    new Set(exercise.pairs.map((pair) => normalizedText(pair.czech))).size !==
      exercise.pairs.length ||
    new Set(exercise.pairs.map((pair) => normalizedText(pair.german))).size !==
      exercise.pairs.length
  ) {
    errors.push(`${label}: spojovačka má duplicitní význam nebo výraz.`);
  }
}

export function validateStoryContent(books: readonly StoryBook[]): StoryContentValidationResult {
  const errors: string[] = [];
  const bookIds = new Set<string>();
  const pageIds = new Set<string>();
  const episodeIds = new Set<string>();
  const checkpointIds = new Set<string>();
  const exerciseIds = new Set<string>();
  const glossaryIds = new Set<string>();
  const gutenbergIds = new Set<number>();

  if (books.map((book) => book.id).join('|') !== storyBookIds.join('|')) {
    errors.push('Pořadí nebo složení storyBookIds neodpovídá katalogu knih.');
  }

  for (const book of books) {
    const label = book.id;
    if (bookIds.has(book.id)) errors.push(`Duplicitní book ID ${book.id}.`);
    bookIds.add(book.id);
    if (
      [
        book.title,
        book.author,
        book.genreCs,
        book.descriptionCs,
        book.contentNoteCs,
        book.source.sourceLabel,
        book.source.excerptLabel,
        book.source.licenseNoteCs,
      ].some((value) => !value.trim() || hasPlaceholder(value))
    ) {
      errors.push(`${label}: neúplná nebo placeholderová metadata knihy.`);
    }
    if (!['all-ages', 'young-adult', 'new-adult'].includes(book.audience)) {
      errors.push(`${label}: neplatná cílová čtenářská kategorie.`);
    }
    if (gutenbergIds.has(book.source.gutenbergId)) {
      errors.push(`${label}: duplicitní Project Gutenberg ID ${book.source.gutenbergId}.`);
    }
    gutenbergIds.add(book.source.gutenbergId);
    if (
      !book.source.ebookUrl.includes(`/ebooks/${book.source.gutenbergId}`) ||
      !book.source.textUrl.includes(`pg${book.source.gutenbergId}.txt`) ||
      !book.source.licenseUrl.startsWith('https://')
    ) {
      errors.push(`${label}: source/provenance odkazy neodpovídají vydání.`);
    }
    if (book.screenCount !== book.pages.length || book.episodeCount !== book.episodes.length) {
      errors.push(`${label}: deklarované počty nesedí s katalogem.`);
    }
    if (book.modernizedByDefault !== Boolean(book.originalPages)) {
      errors.push(`${label}: modernizovaná edice nemá odpovídající originál.`);
    }
    if (book.originalPages && book.originalPages.length !== book.pages.length) {
      errors.push(`${label}: modernizované a původní stránkování se liší.`);
    }

    for (const [index, page] of book.pages.entries()) {
      if (pageIds.has(page.id)) errors.push(`Duplicitní story page ID ${page.id}.`);
      pageIds.add(page.id);
      if (page.index !== index || page.number !== index + 1) {
        errors.push(`${label}/${page.id}: nesprávný index nebo číslo stránky.`);
      }
      if (!page.paragraphs.length || page.paragraphs.some((paragraph) => !paragraph.trim())) {
        errors.push(`${label}/${page.id}: prázdný odstavec nebo stránka.`);
      }
      const countedWords = countStoryWords(page.paragraphs.join(' '));
      if (page.wordCount !== countedWords || countedWords < 1 || countedWords > 135) {
        errors.push(`${label}/${page.id}: nesprávný nebo nevhodný rozsah stránky.`);
      }
    }

    const flattenedEpisodePageIds = book.episodes.flatMap((episode) =>
      episode.pages.map((page) => page.id),
    );
    if (flattenedEpisodePageIds.join('|') !== book.pages.map((page) => page.id).join('|')) {
      errors.push(`${label}: epizody nepokrývají stránky přesně a ve správném pořadí.`);
    }

    const bookGlossaryIds = new Set(book.glossary.map((entry) => entry.id));
    if (book.glossary.length < 12) {
      errors.push(`${label}: čtenářská podpora klesla pod 12 ověřených hesel.`);
    }
    const bookText = book.pages.flatMap((page) => page.paragraphs).join(' ');
    const bookWords = new Set(
      book.pages
        .flatMap((page) => page.paragraphs.join(' ').match(WORD_PATTERN) ?? [])
        .map(normalizeStoryWord),
    );
    for (const entry of book.glossary) {
      const entryLabel = `${label}/${entry.id}`;
      if (glossaryIds.has(entry.id)) errors.push(`Duplicitní glossary ID ${entry.id}.`);
      glossaryIds.add(entry.id);
      if (
        [entry.german, entry.czech, entry.learningNote].some(
          (value) => !value.trim() || hasPlaceholder(value),
        )
      ) {
        errors.push(`${entryLabel}: neúplné nebo placeholderové heslo.`);
      }
      if (entry.forms.some((form) => /\s/u.test(form.trim()))) {
        errors.push(`${entryLabel}: víceslovný tvar nelze zvýraznit jako jeden token.`);
      }
      const highlightableForms = [entry.german, ...entry.forms].filter(
        (form) => !/\s/u.test(form.trim()),
      );
      if (!highlightableForms.some((form) => bookWords.has(normalizeStoryWord(form)))) {
        errors.push(`${entryLabel}: žádný tvar hesla se v textu nevyskytuje.`);
      }
      const distractors = entry.distractors.map(normalizedText);
      if (
        distractors.length < 2 ||
        distractors.some((distractor) => !distractor) ||
        new Set(distractors).size !== distractors.length ||
        distractors.includes(normalizedText(entry.german))
      ) {
        errors.push(`${entryLabel}: neplatné nebo duplicitní distractory.`);
      }
      if (entry.kind === 'noun' && (!entry.article || !entry.plural)) {
        errors.push(`${entryLabel}: noun nemá article/plural.`);
      }
    }

    for (const [index, episode] of book.episodes.entries()) {
      const episodeLabel = `${label}/${episode.id}`;
      if (episodeIds.has(episode.id)) errors.push(`Duplicitní episode ID ${episode.id}.`);
      episodeIds.add(episode.id);
      if (episode.index !== index || episode.number !== index + 1) {
        errors.push(`${episodeLabel}: nesprávný index nebo číslo epizody.`);
      }
      if (
        [episode.title, episode.summaryCs].some((value) => !value.trim() || hasPlaceholder(value))
      ) {
        errors.push(`${episodeLabel}: neúplný název nebo shrnutí.`);
      }
      if (!episode.pages.length || episode.pages.length > 4 || episode.checkpoints.length !== 2) {
        errors.push(`${episodeLabel}: neplatný rozsah nebo počet zastávek.`);
      }
      const episodePageIds = new Set(episode.pages.map((page) => page.id));
      const episodeText = episode.pages.flatMap((page) => page.paragraphs).join(' ');
      for (const checkpoint of episode.checkpoints) {
        const checkpointLabel = `${episodeLabel}/${checkpoint.id}`;
        if (checkpointIds.has(checkpoint.id)) {
          errors.push(`Duplicitní checkpoint ID ${checkpoint.id}.`);
        }
        checkpointIds.add(checkpoint.id);
        if (!episodePageIds.has(checkpoint.afterPageId)) {
          errors.push(`${checkpointLabel}: zastávka odkazuje mimo epizodu.`);
        }
        if (exerciseIds.has(checkpoint.exercise.id)) {
          errors.push(`Duplicitní story exercise ID ${checkpoint.exercise.id}.`);
        }
        exerciseIds.add(checkpoint.exercise.id);
        validateStoryExercise(
          `${checkpointLabel}/${checkpoint.exercise.id}`,
          checkpoint.exercise,
          episodeText,
          bookText,
          bookGlossaryIds,
          errors,
        );
      }
    }
  }

  const counts = {
    books: books.length,
    episodes: books.reduce((sum, book) => sum + book.episodes.length, 0),
    screens: books.reduce((sum, book) => sum + book.pages.length, 0),
    checkpoints: books.reduce(
      (sum, book) =>
        sum +
        book.episodes.reduce((episodeSum, episode) => episodeSum + episode.checkpoints.length, 0),
      0,
    ),
    glossaryEntries: books.reduce((sum, book) => sum + book.glossary.length, 0),
    advancedGlossaryEntries: books.reduce(
      (sum, book) =>
        sum +
        book.glossary.filter((entry) => storyGlossaryTier(entry.cefr, book.level) === 'advanced')
          .length,
      0,
    ),
  };
  if (counts.books < 25 || counts.episodes < 225 || counts.screens < 900) {
    errors.push('Katalog příběhů klesl pod schválený obsahový základ.');
  }
  if (counts.glossaryEntries < 600 || counts.advancedGlossaryEntries < 350) {
    errors.push('Příběhy mají příliš málo označené pokročilé slovní zásoby.');
  }

  return { ok: errors.length === 0, errors, counts };
}
