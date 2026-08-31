import { diversityCourseChapterEnglishCopy } from '../domain/course/course-diversity-chapters.ts';
import { expandedCourseChapterEnglishCopy } from '../domain/course/course-expansion-v3.ts';

export const extendedCourseChapterEnglishCopy = {
  ...expandedCourseChapterEnglishCopy,
  ...diversityCourseChapterEnglishCopy,
};
