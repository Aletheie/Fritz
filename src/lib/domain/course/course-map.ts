import { grammarLessonById, grammarLessons, grammarLevelForLesson } from './grammar.ts';
import { coursePathChapters } from './path.ts';

export type LessonCourseRole = 'primary' | 'supporting' | 'review' | 'advanced/optional';

export type LessonCourseMapping = {
  lessonId: string;
  detailedLevel: ReturnType<typeof grammarLevelForLesson>;
  prerequisites: string[];
  objectiveTags: string[];
  chapters: Array<{ chapterId: string; role: LessonCourseRole }>;
};

const explicitChaptersByLesson = new Map<string, string[]>();
const chaptersByLevel = new Map<
  ReturnType<typeof grammarLevelForLesson>,
  (typeof coursePathChapters)[number][]
>();
for (const chapter of coursePathChapters) {
  const levelChapters = chaptersByLevel.get(chapter.level) ?? [];
  levelChapters.push(chapter);
  chaptersByLevel.set(chapter.level, levelChapters);
  for (const lessonId of chapter.grammarLessonIds) {
    const chapterIds = explicitChaptersByLesson.get(lessonId) ?? [];
    chapterIds.push(chapter.id);
    explicitChaptersByLesson.set(lessonId, chapterIds);
  }
}

function fallbackRole(unit: number): LessonCourseRole {
  if (unit % 7 === 0) return 'advanced/optional';
  if (unit % 5 === 0) return 'review';
  return 'supporting';
}

/**
 * Complete, deterministic mapping of all vetted grammar lessons into the
 * 120-chapter course. Explicit chapter objectives are primary; the remaining
 * catalog is distributed within the same detailed CEFR band as remediation,
 * review, or optional enrichment.
 */
export const lessonCourseMap: LessonCourseMapping[] = grammarLessons.map((lesson, index) => {
  const detailedLevel = grammarLevelForLesson(lesson);
  const levelChapters = chaptersByLevel.get(detailedLevel) ?? [];
  const explicit = explicitChaptersByLesson.get(lesson.id) ?? [];
  const fallbackChapter = levelChapters[lesson.unit % Math.max(1, levelChapters.length)];
  const chapters = explicit.length
    ? explicit.map((chapterId, chapterIndex) => ({
        chapterId,
        role: chapterIndex === 0 ? ('primary' as const) : ('review' as const),
      }))
    : fallbackChapter
      ? [{ chapterId: fallbackChapter.id, role: fallbackRole(lesson.unit) }]
      : [];
  const skills = new Set<string>();
  for (const question of lesson.questions) {
    const skill = question.skill.trim();
    if (skill) skills.add(skill);
  }
  return {
    lessonId: lesson.id,
    detailedLevel,
    prerequisites: index > 0 ? [grammarLessons[index - 1].id] : [],
    objectiveTags: [lesson.categoryId, ...skills],
    chapters,
  };
});

const lessonMappingById = new Map(lessonCourseMap.map((mapping) => [mapping.lessonId, mapping]));
const lessonMappingsByChapter = new Map<
  string,
  Array<{ lessonId: string; role: LessonCourseRole }>
>();
for (const mapping of lessonCourseMap) {
  for (const chapter of mapping.chapters) {
    const mappings = lessonMappingsByChapter.get(chapter.chapterId) ?? [];
    mappings.push({ lessonId: mapping.lessonId, role: chapter.role });
    lessonMappingsByChapter.set(chapter.chapterId, mappings);
  }
}

export function lessonCourseMappingById(lessonId: string): LessonCourseMapping | undefined {
  return lessonMappingById.get(lessonId);
}

export function grammarLessonsForChapter(chapterId: string): Array<{
  lesson: NonNullable<ReturnType<typeof grammarLessonById>>;
  role: LessonCourseRole;
}> {
  const lessons: Array<{
    lesson: NonNullable<ReturnType<typeof grammarLessonById>>;
    role: LessonCourseRole;
  }> = [];
  for (const mapping of lessonMappingsByChapter.get(chapterId) ?? []) {
    const lesson = grammarLessonById(mapping.lessonId);
    if (lesson) lessons.push({ lesson, role: mapping.role });
  }
  return lessons;
}
