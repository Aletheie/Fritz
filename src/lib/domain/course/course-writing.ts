import { localized } from '../../i18n/index.ts';
import { lexicalTokens } from '../grading/lexical.ts';
import type { MotherTongue } from '../types.ts';
import { courseCommunicationForChapter } from './course-communication.ts';
import { sentenceUsesCourseWord } from './course-word-usage.ts';
import { courseWritingProfiles } from './course-writing-profiles.ts';
import type { CoursePathChapter } from './path.ts';

export { courseWritingProfiles };

export const COURSE_WRITING_MAX_LENGTH = 5000;
const conciseEditingChapters = new Set(['chapter-10-style', 'chapter-94-cut-clumsy-text']);

export function courseWritingLimits(chapter: CoursePathChapter): {
  minimumWords: number;
  suggestedWords: [number, number];
} {
  if (conciseEditingChapters.has(chapter.id)) return { minimumWords: 8, suggestedWords: [15, 40] };
  return courseWritingProfiles[chapter.level];
}

export function courseWritingCriteria(
  chapter: CoursePathChapter,
  language: MotherTongue,
): string[] {
  const communication = courseCommunicationForChapter(chapter.id);
  if (communication)
    return communication.writing.criteria.map((criterion) => localized(language, criterion));
  return [
    localized(language, {
      cs: 'Text odpovídá zadání a předává konkrétní informaci.',
      en: 'The text answers the task and conveys specific information.',
    }),
    localized(language, courseWritingProfiles[chapter.level].review),
    localized(language, {
      cs: 'Přečetla jsem text znovu a opravila nejasná místa.',
      en: 'I have reread the text and revised unclear passages.',
    }),
  ];
}

export function checkCourseWriting(
  chapter: CoursePathChapter,
  text: string,
): {
  wordCount: number;
  enoughWords: boolean;
  withinLimit: boolean;
  usesCourseVocabulary: boolean;
  ready: boolean;
} {
  const wordCount = lexicalTokens(text).length;
  const enoughWords = wordCount >= courseWritingLimits(chapter).minimumWords;
  const withinLimit = text.length <= COURSE_WRITING_MAX_LENGTH;
  const usesCourseVocabulary = sentenceUsesCourseWord(text, chapter.words);
  return {
    wordCount,
    enoughWords,
    withinLimit,
    usesCourseVocabulary,
    ready: enoughWords && withinLimit && usesCourseVocabulary,
  };
}
