import type {
  StoryBook,
  StoryEpisode,
  StoryExercise,
  StoryGlossaryEntry,
} from '../domain/stories/types.ts';
import type { MotherTongue } from '../domain/types.ts';
import { sourceMeaning } from './vocabulary.ts';

const genres: Record<StoryBook['id'], string> = {
  'a1-maerchen': 'cumulative fairy tales',
  'a1-haewelmann': 'night-time fairy tale',
  'a1-bremer': 'animal fairy tale',
  'a1-fabeln': 'fables',
  'a1-haensel-gretel': 'dark fairy tale',
  'a2-maerchen': 'fairy tales',
  'a2-max-moritz': 'comic verse story',
  'a2-alice': 'fantasy adventure',
  'a2-mondfahrt': 'fantasy tale',
  'a2-biene-maja': 'coming-of-age adventure',
  'b1-heidi': 'coming-of-age novel',
  'b1-kleider': 'novella',
  'b1-nils': 'fantasy journey',
  'b1-immensee': 'romantic novella',
  'b1-tom-sawyer': 'young adult adventure',
  'b2-schimmelreiter': 'Gothic novella',
  'b2-sandmann': 'Gothic tale',
  'b2-taugenichts': 'Romantic novella',
  'b2-bahnwaerter': 'naturalist novella',
  'b2-schatzinsel': 'pirate adventure',
  'c1-verwandlung': 'modernist novella',
  'c1-urteil': 'modernist short story',
  'c1-krug': 'comedy',
  'c1-wahlverwandtschaften': 'classic novel',
  'c1-dorian-gray': 'Gothic dark academia',
};

const audiences: Record<StoryBook['audience'], { cs: string; en: string }> = {
  'all-ages': { cs: 'pro všechny', en: 'all ages' },
  'young-adult': { cs: 'young adult', en: 'young adult' },
  'new-adult': { cs: 'new adult', en: 'new adult' },
};

export function storyAuthor(author: string, language: MotherTongue): string {
  if (language === 'en' && author === 'Bratři Grimmové') return 'Brothers Grimm';
  return author;
}

export function storyGenre(
  book: Pick<StoryBook, 'id' | 'genreCs'>,
  language: MotherTongue,
): string {
  return language === 'en' ? genres[book.id] : book.genreCs;
}

export function storyAudience(book: Pick<StoryBook, 'audience'>, language: MotherTongue): string {
  return audiences[book.audience][language];
}

export function storyDescription(
  book: Pick<StoryBook, 'level' | 'descriptionCs'>,
  language: MotherTongue,
): string {
  if (language === 'cs') return book.descriptionCs;
  return `A guided ${book.level} reading of a German classic, split into short episodes with vocabulary support and quick comprehension checks.`;
}

export function storyContentNote(
  book: Pick<StoryBook, 'contentNoteCs'>,
  language: MotherTongue,
): string {
  if (language === 'cs') return book.contentNoteCs;
  return 'This historical work may include peril, violence, or attitudes from its period.';
}

export function storyLicenseNote(book: Pick<StoryBook, 'source'>, language: MotherTongue): string {
  if (language === 'cs') return book.source.licenseNoteCs;
  if (book.source.adapted) {
    return 'The original work is in the public domain. Fritz’s new graded German adaptation is distributed under this repository’s MIT license.';
  }
  return 'The text comes from the edition listed in the sources. Outside the United States, check local copyright law for the specific translation as well as the original work.';
}

export function storyEpisodeTitle(
  episode: Pick<StoryEpisode, 'number' | 'title'>,
  language: MotherTongue,
): string {
  return language === 'en' ? `Episode ${episode.number}` : episode.title;
}

export function storyEpisodeSummary(
  episode: Pick<StoryEpisode, 'summaryCs'>,
  language: MotherTongue,
): string {
  if (language === 'cs') return episode.summaryCs;
  return 'Continue the story in a short, focused reading segment.';
}

export function storyGlossaryMeaning(
  entry: Pick<StoryGlossaryEntry, 'german' | 'czech'>,
  language: MotherTongue,
): string {
  return sourceMeaning(entry.german, entry.czech, language);
}

export function storyGlossaryNote(entry: StoryGlossaryEntry, language: MotherTongue): string {
  if (language === 'cs') return entry.learningNote;
  return `In this story, “${entry.german}” means “${storyGlossaryMeaning(entry, language)}”.`;
}

export function storyExerciseCopy(
  exercise: StoryExercise,
  language: MotherTongue,
): { prompt: string; instruction: string; success: string } {
  if (language === 'cs') {
    return {
      prompt: exercise.promptCs,
      instruction: exercise.instructionCs,
      success: exercise.successCs,
    };
  }
  if (exercise.kind === 'order') {
    return {
      prompt: 'Put the sentence in the correct order.',
      instruction: 'Tap the German words in the order they belong.',
      success: 'The sentence is in the correct order.',
    };
  }
  if (exercise.kind === 'cloze') {
    return {
      prompt: 'Choose the word that completes the sentence.',
      instruction: 'Use the story context to select the German answer.',
      success: 'That word fits the sentence.',
    };
  }
  if (exercise.kind === 'recall') {
    return {
      prompt: 'Retrieve the missing German word.',
      instruction: 'Type the exact form from context. A progressive hint appears after an error.',
      success: 'You retrieved the form without answer options.',
    };
  }
  if (exercise.kind === 'sequence') {
    return {
      prompt: 'Build the story timeline.',
      instruction: 'Tap all three events in the order in which they happened.',
      success: 'You kept the whole scene in order.',
    };
  }
  if (exercise.kind === 'arc') {
    return {
      prompt: 'Which arc belongs to this scene?',
      instruction: 'Choose the pair that connects this episode’s opening clue to its final change.',
      success: 'You connected two distant clues into one meaning.',
    };
  }
  if (exercise.kind === 'production') {
    return {
      prompt: 'Retell a key moment in your own sentence.',
      instruction:
        'Write a short German sentence about a change in the episode, then compare it with a clue from the story.',
      success: 'You turned comprehension into your own German.',
    };
  }
  if (exercise.kind === 'memory') {
    return {
      prompt: 'What happened in this part of the story?',
      instruction: 'Choose the answer that matches what you just read.',
      success: 'That matches the story.',
    };
  }
  return {
    prompt: 'Match the German expressions with their English meanings.',
    instruction: 'Select one card from each column to make a pair.',
    success: 'All pairs are correct.',
  };
}
