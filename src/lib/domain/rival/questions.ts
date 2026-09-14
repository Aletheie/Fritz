import { grammarLessonCopy, grammarQuestionCopy } from '../../i18n/grammar.ts';
import { rivalGrammarContexts } from '../../i18n/rival.ts';
import { noteMeaning } from '../../i18n/vocabulary.ts';
import type { GrammarLesson } from '../course/grammar.ts';
import { isCountedReview } from '../stats/learning.ts';
import type { Note, ReviewLog } from '../types.ts';
import { displayGerman } from '../vocabulary/display.ts';
import type { RivalQuestion } from './types.ts';

export function buildRivalQuestions(
  notes: Note[],
  reviews: ReviewLog[],
  lessons: GrammarLesson[],
): RivalQuestion[] {
  const misses = new Map<string, number>();
  for (const review of reviews.slice(0, 100)) {
    if (
      isCountedReview(review) &&
      review.mode !== 'cram' &&
      (!review.signal.wordCorrect || !review.signal.articleCorrect)
    ) {
      misses.set(review.noteId, Math.min(6, (misses.get(review.noteId) ?? 0) + 2));
    }
  }
  const selected = notes
    .toSorted(
      (a, b) =>
        (misses.get(b.id) ?? 0) - (misses.get(a.id) ?? 0) || b.updatedAt.localeCompare(a.updatedAt),
    )
    .slice(0, 80);
  const questions: RivalQuestion[] = [];
  for (const note of selected) {
    const answer = displayGerman(note);
    const prompt = { cs: noteMeaning(note, 'cs'), en: noteMeaning(note, 'en') };
    // Imported notes can contain entire paragraphs. A duel needs an answer that fits its input.
    if (answer.length > 1_000 || prompt.cs.length > 4_000 || prompt.en.length > 4_000) continue;
    const example =
      note.exampleDe && note.exampleDe.length > 2_000
        ? `${note.exampleDe.slice(0, 2_000)}…`
        : note.exampleDe;
    const plural =
      note.plural && note.plural.length > 2_000 ? `${note.plural.slice(0, 2_000)}…` : note.plural;
    const accepted = [
      ...new Set([
        answer,
        ...note.acceptedGerman.map((value) =>
          note.article && !/^(?:der|die|das)\s/iu.test(value) ? `${note.article} ${value}` : value,
        ),
      ]),
    ]
      .filter((value) => value.trim() && value.length <= 1_000)
      .slice(0, 201);
    questions.push({
      id: `recall:${note.id}`,
      sourceId: `note:${note.id}`,
      topic: 'recall',
      prompt,
      promptLanguage: 'ui',
      answer,
      accepted,
      options: [],
      explanation: {
        cs: example ? `${answer} · ${example}` : `Německý výraz: ${answer}.`,
        en: example ? `${answer} · ${example}` : `German expression: ${answer}.`,
      },
      difficulty: note.kind === 'phrase' || ['B2', 'C1', 'C2'].includes(note.cefr ?? '') ? 3 : 2,
      priority: misses.get(note.id) ?? 0,
    });
    if (note.kind === 'noun' && note.article) {
      questions.push({
        id: `articles:${note.id}`,
        sourceId: `note:${note.id}`,
        topic: 'articles',
        prompt: { cs: `___ ${note.german}`, en: `___ ${note.german}` },
        promptLanguage: 'de',
        answer: note.article,
        accepted: [note.article],
        options: ['der', 'die', 'das'],
        explanation: {
          cs: `V jednotném čísle: ${answer}.${plural ? ` Množné číslo: ${plural}.` : ''}`,
          en: `Singular: ${answer}.${plural ? ` Plural: ${plural}.` : ''}`,
        },
        difficulty: 1,
        priority: misses.get(note.id) ?? 0,
      });
    }
  }
  for (const lesson of lessons) {
    for (const question of lesson.questions) {
      if (question.kind === 'order') continue;
      // Cloze questions carry their own context; a generic translated lesson title can lose it.
      if (question.kind === 'choice' && !/_{2,}/u.test(question.prompt)) continue;
      const cs = grammarQuestionCopy('cs', question, grammarLessonCopy('cs', lesson));
      const englishLesson = grammarLessonCopy('en', lesson);
      const sentence =
        question.kind === 'fill' ? `${question.before} ___ ${question.after}` : undefined;
      const answer = question.kind === 'choice' ? question.answer : question.answers[0];
      if (!answer) continue;
      const englishPrompt = sentence ?? rivalGrammarContexts[question.id] ?? question.prompt;
      questions.push({
        id: `grammar:${lesson.id}:${question.id}`,
        sourceId: `grammar:${lesson.id}:${question.id}`,
        topic: 'grammar',
        prompt: {
          cs: sentence ?? cs.prompt,
          en: englishPrompt,
        },
        promptLanguage: sentence || !rivalGrammarContexts[question.id] ? 'de' : 'ui',
        answer,
        accepted: question.kind === 'choice' ? [question.answer] : question.answers,
        options: question.kind === 'choice' ? question.options : [],
        explanation: {
          cs: cs.explanation,
          en: `${englishPrompt.replace(/_{2,}/u, answer)} · ${englishLesson.shortTitle}`,
        },
        difficulty: question.kind === 'choice' ? 2 : 3,
        priority: 0,
      });
    }
  }
  return questions;
}
