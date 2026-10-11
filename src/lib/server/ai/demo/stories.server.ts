import { DEMO_MODEL } from './model.server.ts';

import type {
  AiGeneratedVocabularyItem,
  AiStorySelectionRequest,
  AiStorySelectionResult,
  AiStoryWordRequest,
  AiStoryWordResult,
} from '../../../domain/ai/types.ts';

export function demoStoryWord(request: AiStoryWordRequest): AiStoryWordResult {
  if (!request.known) {
    if (request.motherTongue === 'en') {
      return {
        word: request.word,
        contextMeaning: 'The precise meaning of this word requires connected AI.',
        grammarNote:
          'Underlined words have translations available without AI. To look up other words, ask your app administrator to enable AI.',
        morphology: 'This word form isn’t in the offline dictionary.',
        collocation: 'No phrase is available for this word offline.',
        recallQuestion: `What does “${request.word}” mean in this sentence?`,
        registerNote: null,
        item: null,
        available: false,
        model: DEMO_MODEL,
      };
    }
    return {
      word: request.word,
      contextMeaning: 'Přesný význam tohoto slova vyžaduje připojenou AI.',
      grammarNote:
        'Podtržená slova mají překlad i bez AI. Pro překlady ostatních slov požádej správce aplikace o zapnutí AI.',
      morphology: 'Tento tvar není v offline slovníku.',
      collocation: 'K tomuto slovu není offline dostupná vazba.',
      recallQuestion: `Jaký význam má „${request.word}“ právě v této větě?`,
      registerNote: null,
      item: null,
      available: false,
      model: DEMO_MODEL,
    };
  }
  const known = request.known;
  const item: AiGeneratedVocabularyItem = {
    german: known.german,
    czech: known.czech,
    kind: known.kind,
    article: known.article ?? null,
    plural: known.plural ?? null,
    acceptedGerman: [],
    acceptedCzech: [],
    tags: [request.motherTongue === 'en' ? 'reading' : 'četba', request.level.toLowerCase()],
    exampleDe: request.sentence.slice(0, 300),
    exampleCs: null,
    cefr: known.cefr,
    learningNote: known.learningNote ?? null,
    mnemonic: null,
    verbForms: null,
  };
  return {
    word: request.word,
    contextMeaning: known.czech,
    grammarNote:
      request.motherTongue === 'en'
        ? `In this sentence, “${request.word}” is a form of “${known.german}”.`
        : (known.learningNote ??
          `V této větě je „${request.word}“ tvarem výrazu „${known.german}“.`),
    morphology:
      request.motherTongue === 'en'
        ? known.kind === 'noun'
          ? `${known.article ?? 'article unknown'} ${known.german}; plural ${known.plural ?? 'not listed'}`
          : `Dictionary form: ${known.german}.`
        : known.kind === 'noun'
          ? `${known.article ?? 'člen neurčen'} ${known.german}; plurál ${known.plural ?? 'není v hesle uveden'}`
          : `Základní tvar: ${known.german}.`,
    collocation:
      request.motherTongue === 'en'
        ? `Expression in context: ${request.sentence.slice(0, 180)}`
        : `Kontextová vazba: ${request.sentence.slice(0, 180)}`,
    recallQuestion:
      request.motherTongue === 'en'
        ? `How would you express “${request.word}” in English in this sentence?`
        : `Jak by v této větě znělo česky „${request.word}“?`,
    registerNote:
      request.level === 'B2' || request.level === 'C1'
        ? request.motherTongue === 'en'
          ? 'Notice how the word is used in this sentence.'
          : 'Všimni si, jak se slovo používá v této větě.'
        : null,
    item,
    available: true,
    model: DEMO_MODEL,
  };
}

export function demoStorySelection(request: AiStorySelectionRequest): AiStorySelectionResult {
  if (request.motherTongue === 'en') {
    return {
      translationCs:
        'Translating selected passages requires AI. Your app administrator can enable it.',
      explanationCs:
        request.action === 'explain'
          ? 'Without connected AI, you can still use the manually verified translations of annotated words.'
          : 'Your selection is preserved; after connecting AI you will get a translation for this exact context.',
      grammarHighlights: [],
      suggestedGerman: request.text,
      suggestedCzech: '',
      available: false,
      model: DEMO_MODEL,
    };
  }
  return {
    translationCs: 'Překlad označeného textu potřebuje AI. Její zapnutí zařídí správce aplikace.',
    explanationCs:
      request.action === 'explain'
        ? 'Bez připojené AI můžeš dál používat ručně ověřené překlady podtržených slov.'
        : 'Označení zůstalo zachované; po připojení AI dostaneš překlad přesně v tomto kontextu.',
    grammarHighlights: [],
    suggestedGerman: request.text,
    suggestedCzech: '',
    available: false,
    model: DEMO_MODEL,
  };
}
