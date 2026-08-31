import type { StoryBookId } from '../stories/types.ts';
import type { CourseProgress } from '../types.ts';

const companionStoryBookIds: Partial<Record<StoryBookId, StoryBookId>> = {
  'a1-bremer': 'a1-haewelmann',
  'a1-fabeln': 'a1-haewelmann',
  'a1-haensel-gretel': 'a1-haewelmann',
  'a2-alice': 'a2-max-moritz',
  'a2-mondfahrt': 'a2-max-moritz',
  'a2-biene-maja': 'a2-max-moritz',
  'b1-nils': 'b1-kleider',
  'b1-immensee': 'b1-kleider',
  'b1-tom-sawyer': 'b1-kleider',
  'b2-taugenichts': 'b2-sandmann',
  'b2-bahnwaerter': 'b2-sandmann',
  'b2-schatzinsel': 'b2-sandmann',
  'c1-krug': 'c1-urteil',
  'c1-wahlverwandtschaften': 'c1-urteil',
  'c1-dorian-gray': 'c1-urteil',
};

const unlockChapterTitles: Partial<Record<StoryBookId, string>> = {
  'a1-maerchen': 'První den ve škole',
  'a1-haewelmann': 'Ve třídě a školní pokyny',
  'a2-maerchen': 'Na cestě',
  'a2-max-moritz': 'Zdraví a lékárna',
  'b1-heidi': 'Studium a cíle',
  'b1-kleider': 'Práce a pracovní zkušenost',
  'b2-schimmelreiter': 'Projekt a rozhodnutí',
  'b2-sandmann': 'Vyjednávání',
  'c1-verwandlung': 'Odborná diskuse',
  'c1-urteil': 'Média a nepřímá řeč',
};

export function primaryStoryBookId(bookId: StoryBookId): StoryBookId {
  return companionStoryBookIds[bookId] ?? bookId;
}

export function storyBookIsUnlocked(progress: CourseProgress, bookId: StoryBookId): boolean {
  const companionBookId = companionStoryBookIds[bookId];
  return (
    progress.unlockedStoryBooks.includes(bookId) ||
    Boolean(companionBookId && progress.unlockedStoryBooks.includes(companionBookId)) ||
    Boolean(progress.storyBooks[bookId])
  );
}

export function storyBookUnlockReason(bookId: StoryBookId): string {
  const chapterTitle = unlockChapterTitles[primaryStoryBookId(bookId)];
  return chapterTitle
    ? `Dokonči checkpoint kapitoly ${chapterTitle}.`
    : 'Tuto četbu odemkne pozdější checkpoint kurzové cesty.';
}
