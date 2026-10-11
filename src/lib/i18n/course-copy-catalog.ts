import { diversityCourseChapterEnglishCopy } from '../domain/course/content/chapters/course-diversity-chapters.ts';
import { expandedCourseChapterEnglishCopy } from '../domain/course/content/chapters/course-expansion-v3.ts';

export const extendedCourseChapterEnglishCopy = {
  ...expandedCourseChapterEnglishCopy,
  ...diversityCourseChapterEnglishCopy,
};
