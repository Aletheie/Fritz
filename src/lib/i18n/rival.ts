import { rivalWeakness } from '../domain/rival/engine.ts';
import type {
  RivalCopy,
  RivalId,
  RivalMatch,
  RivalReading,
  RivalTopic,
} from '../domain/rival/types.ts';
import type { MotherTongue } from '../domain/types.ts';

export const rivalNames: Record<RivalId, string> = { mila: 'Mila', konrad: 'Konrad', nora: 'Nora' };
export const rivalGrammarContexts: Record<string, string> = {
  'modalep-1': 'The lights are off and nobody answers. “Sie ___ schon gegangen sein.”',
  'partattr-1': '“The guests who are waiting” = die ___ Gäste',
  'imperative-basics-1': 'You are talking to one friend: ___ bitte leise!',
  'imperative-basics-2': 'You are talking to two friends: ___ bitte!',
  'da-wo-compounds-4': 'You are asking about a person: “___ wartest du?”',
  'two-object-order-2': 'Replace “den Brief” with a pronoun: “Sie zeigt ___ ihrem Chef.”',
  'modal-particles-1': 'Which particle softens the informal request “Warte ___!”?',
};
export const rivalTopics: Record<RivalTopic, RivalCopy> = {
  recall: { cs: 'Vybavení slov', en: 'Word recall' },
  articles: { cs: 'Členy', en: 'Articles' },
  grammar: { cs: 'Gramatika', en: 'Grammar' },
};
export const rivalPersonalities: Record<RivalId, { title: RivalCopy; plan: RivalCopy }> = {
  mila: {
    title: { cs: 'Silná v gramatice.', en: 'A knack for grammar.' },
    plan: {
      cs: 'Ve větách hledám pravidlo dřív než odpověď. Gramatikou mě jen tak nezaskočíš. U členů se ale někdy spoléhám na vzorec, který má výjimku.',
      en: 'I look for the rule before the answer. Grammar is my strong suit. With articles, though, I sometimes trust a pattern that has an exception.',
    },
  },
  konrad: {
    title: {
      cs: 'Dobrá paměť na slova.',
      en: 'A good memory for words.',
    },
    plan: {
      cs: 'Slova mi jdou dobře. Na jistou odpověď používám bonus za dva body. Ve větách ale občas přehlédnu detail.',
      en: 'Words come easily to me. I use my double-point bonus when I feel confident. I do sometimes miss a detail in a sentence.',
    },
  },
  nora: {
    title: {
      cs: 'Členy jí jdou nejlépe.',
      en: 'Articles are her strong suit.',
    },
    plan: {
      cs: 'Členy kontroluji pečlivě. Když ale zmizí možnosti a musím slovo napsat zpaměti, jistota klesá. Jestli chceš převahu, zkus mě tam.',
      en: 'I check articles carefully. When the options disappear and I need to recall a word, I am less certain. Challenge me there for an advantage.',
    },
  },
};

export function rivalReadingLine(reading: RivalReading, language: MotherTongue): string {
  if (reading.observations < 3)
    return language === 'cs'
      ? 'Zkusíme pár otázek a uvidíme, co ti jde. Na odpověď máš vždycky čas.'
      : 'Let us try a few questions and see what you know. Take all the time you need.';
  const weakest = reading.topics.find((item) => item.topic === reading.weakness)!;
  if (weakest.attempts < 3)
    return language === 'cs'
      ? 'Pár odpovědí už znám. Na pevný závěr je brzy, tak začnu pestře.'
      : 'I have seen a few answers. Too early for a conclusion, so I will vary the questions.';
  const label = rivalTopics[weakest.topic][language].toLocaleLowerCase(language);
  return language === 'cs'
    ? `Všímám si hlavně oblasti „${label}“: ${weakest.correct} z ${weakest.attempts} posledních odpovědí bylo správně. Začnu tam a podle tvých tahů změním plán.`
    : `I am watching ${label}: ${weakest.correct} of your last ${weakest.attempts} answers were correct. I will start there and adapt to your moves.`;
}

export function rivalMoveLine(match: RivalMatch, language: MotherTongue): string {
  const round = match.rounds.at(-1)!;
  const lines: Record<typeof round.move, RivalCopy> = {
    opening: {
      cs: 'Začneme tady. Na odpověď máš tolik času, kolik potřebuješ.',
      en: 'Let us start here. Take all the time you need.',
    },
    weakness: {
      cs: 'Zkusíme ještě jeden příklad z téhle oblasti.',
      en: 'Let us try another example from this area.',
    },
    counter: {
      cs: `Míříš na můj slabší bod: ${rivalTopics[rivalWeakness(match.rivalId)].cs.toLocaleLowerCase('cs')}. Beru výzvu.`,
      en: `You are targeting my weaker side: ${rivalTopics[rivalWeakness(match.rivalId)].en.toLocaleLowerCase('en')}. Challenge accepted.`,
    },
    raise: {
      cs: 'Dvě správné odpovědi za sebou. Teď zkusíme něco jiného.',
      en: 'Two correct answers in a row. Let us try something different.',
    },
    retry: {
      cs: 'Dáme tomu ještě jeden pokus s jiným příkladem.',
      en: 'Let us give that another go with a different example.',
    },
    switch: {
      cs: 'Otázka je vyměněná. Tahle je nová pro nás oba.',
      en: 'Question swapped. This one is new to both of us.',
    },
    variety: {
      cs: 'Pro změnu zkusíme jiný typ otázky.',
      en: 'Let us try a different kind of question.',
    },
  };
  return lines[round.move][language];
}

export function rivalReaction(match: RivalMatch, language: MotherTongue): string {
  const round = match.rounds.at(-1)!;
  if (!round.result) return rivalMoveLine(match, language);
  if (round.result.correct && !round.botCorrect)
    return language === 'cs'
      ? 'Tohle ti vyšlo. Moje odpověď byla vedle.'
      : 'You got this one. I missed it.';
  if (!round.result.correct && round.botCorrect)
    return language === 'cs'
      ? 'Moje odpověď tentokrát vyšla. Pod otázkou najdeš správný tvar i vysvětlení.'
      : 'I got this one. You will find the correct form and explanation below.';
  if (round.result.correct)
    return language === 'cs'
      ? round.result.stake === 2
        ? 'Oba správně. A tvůj bonus přidává druhý bod.'
        : 'Oba správně. Můžeme dál.'
      : round.result.stake === 2
        ? 'Both correct. Your bonus adds a second point.'
        : 'Both correct. Ready for the next one.';
  return language === 'cs'
    ? 'Tuhle otázku jsme netrefili ani jeden. Mrkneme na správnou odpověď.'
    : 'We both missed this one. Let us look at the correct answer.';
}

export function rivalRematchLine(correct: number, language: MotherTongue): string {
  if (correct === 5)
    return language === 'cs'
      ? 'Pět přesných odpovědí. Příště můžeš zkusit větší výzvu, nebo zůstat u svého tempa.'
      : 'Five correct answers. Try a bigger challenge next time, or keep your current pace.';
  return language === 'cs'
    ? `Máš ${correct} z 5 odpovědí správně. Můžeme se podívat na zbytek a příště to zkusit znovu.`
    : `You got ${correct} of 5 answers right. We can look at the others and try again next time.`;
}
