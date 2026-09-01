import type { CoursePathChapterView, CoursePathNode } from '../domain/course/path.ts';
import type { CourseProgress, DetailedCefrLevel, MotherTongue } from '../domain/types.ts';

export type CoursePathSnapshot = {
  chapters: CoursePathChapterView[];
  recommendation?: CoursePathNode;
};

export async function loadCoursePath(
  progress: CourseProgress,
  minimumLevel: DetailedCefrLevel,
  language: MotherTongue = 'cs',
): Promise<CoursePathSnapshot> {
  const [{ coursePathViews, recommendedCoursePathNode }] = await Promise.all([
    import('../domain/course/path.ts'),
    language === 'en'
      ? import('../i18n/course.ts').then(({ loadCourseCopyCatalog }) => loadCourseCopyCatalog())
      : Promise.resolve(),
  ]);
  return {
    chapters: coursePathViews(progress, minimumLevel),
    recommendation: recommendedCoursePathNode(progress, minimumLevel),
  };
}
