import type { CoursePathChapter, CoursePathNode, CoursePathPhase } from '../domain/course/path.ts';
import type { MotherTongue } from '../domain/types.ts';
import type { DetailedCefrLevel } from '../domain/types.ts';

type ChapterCopy = {
  title: string;
  subtitle: string;
  mission: string;
  outcomes: [string, string, string];
};

const englishChapters: Record<string, ChapterCopy> = {
  'chapter-01-school': {
    title: 'First day at school',
    subtitle: 'Introduce yourself, name classroom objects, and build a simple statement.',
    mission: 'Introduce yourself to a new classmate and say what and when you study at school.',
    outcomes: [
      'name five school expressions with the right article or form',
      'keep the finite verb in second position, even after a time phrase',
      'carry a short introduction with three original replies',
    ],
  },
  'chapter-11-classroom': {
    title: 'In class and classroom instructions',
    subtitle: 'Understand basic instructions and ask someone to repeat more slowly.',
    mission: 'Open the right page, follow a short instruction, and politely ask for repetition.',
    outcomes: [
      'respond to a common classroom instruction',
      'use the imperative in a simple sentence',
      'ask for repetition or spelling',
    ],
  },
  'chapter-12-cafe-bakery': {
    title: 'Café and bakery',
    subtitle: 'Order food and a drink, ask for the price, and repair a misunderstanding.',
    mission: 'Build a complete order, find out the price, and say whether you are paying together.',
    outcomes: [
      'order two items',
      'use the accusative after a common verb',
      'ask about the price and payment method',
    ],
  },
  'chapter-02-day': {
    title: 'My daily routine',
    subtitle: 'Connect times, morning activities, and their duration into one clear routine.',
    mission:
      'Describe your morning in the right order, give two specific times, and explain how long you need for breakfast.',
    outcomes: [
      'describe three parts of a typical morning in a logical order',
      'choose the right verb ending for the subject',
      'connect getting up, breakfast, and leaving on time with specific times',
    ],
  },
  'chapter-13-home-family': {
    title: 'Home and family',
    subtitle: 'Describe your household, relationships, and who owns what.',
    mission:
      'Introduce your household and explain in three sentences who lives where and what you share.',
    outcomes: [
      'describe members of a household',
      'use the right possessive article',
      'express ownership and a shared activity',
    ],
  },
  'chapter-14-city': {
    title: 'Around town',
    subtitle: 'Ask for directions, understand instructions, and change public transport.',
    mission: 'Guide a visitor from the stop to city hall and check the right connection.',
    outcomes: [
      'describe a route through town',
      'use direction words in an instruction',
      'ask about a stop and a transfer',
    ],
  },
  'chapter-03-travel': {
    title: 'On the road',
    subtitle: 'Buy a ticket, check the departure, and use separable verbs.',
    mission: 'Buy a ticket, confirm your transfer, and find the right platform.',
    outcomes: [
      'use essential expressions for train travel',
      'separate a verb prefix in a main clause',
      'get three pieces of information at the ticket counter',
    ],
  },
  'chapter-15-hotel': {
    title: 'Hotel and reservations',
    subtitle: 'Check in, confirm the dates, and politely solve a problem with your room.',
    mission:
      'Confirm a reservation, get your key, and describe one issue without unnecessary conflict.',
    outcomes: [
      'confirm reservation details',
      'describe a past event in the perfect tense',
      'ask a polite indirect question',
    ],
  },
  'chapter-16-health': {
    title: 'Health and the pharmacy',
    subtitle: 'Describe your symptoms, say how long you’ve had them, and ask for help.',
    mission: 'Give three specific details at a pharmacy and confirm how to use the medicine.',
    outcomes: [
      'describe where a problem is and how long it has lasted',
      'use a reflexive verb and a dative pronoun',
      'understand a basic recommendation',
    ],
  },
  'chapter-04-plans': {
    title: 'Making plans',
    subtitle: 'Explain a reason, suggest a time, and connect two ideas in one sentence.',
    mission: 'Suggest a time, explain why it changed, and confirm the arrangement clearly.',
    outcomes: [
      'suggest, confirm, or move an appointment',
      'send the verb to the end after “weil” and “dass”',
      'finish an invitation with a clear yes or no',
    ],
  },
  'chapter-17-shopping-returns': {
    title: 'Shopping and returns',
    subtitle: 'Compare products, describe a fault, and ask for an exchange or refund.',
    mission: 'Choose the right option and resolve a complaint about a faulty purchase calmly.',
    outcomes: ['compare two options', 'describe a specific fault', 'state the solution you want'],
  },
  'chapter-18-housing-neighbors': {
    title: 'Housing and neighbours',
    subtitle: 'Describe a flat, moving house, and basic rules for living together.',
    mission:
      'Check important conditions at a viewing and agree on a practical matter with a neighbour.',
    outcomes: [
      'describe the location and features of a flat',
      'distinguish location from direction',
      'politely agree on a shared-living rule',
    ],
  },
  'chapter-19-study-goals': {
    title: 'Study and goals',
    subtitle: 'Explain a study plan, its purpose, and a specific obstacle.',
    mission: 'Suggest a realistic plan for the week and ask for clarification of an unclear rule.',
    outcomes: [
      'set a measurable study goal',
      'express purpose with um…zu',
      'ask a precise indirect question',
    ],
  },
  'chapter-20-work-experience': {
    title: 'Work and professional experience',
    subtitle: 'Describe experience, responsibility, and an absence from work specifically.',
    mission: 'Give a practical example in an interview and report a short absence appropriately.',
    outcomes: [
      'describe a past work situation',
      'use a verb with its required preposition',
      'report a problem and suggest the next step',
    ],
  },
  'chapter-05-home-work': {
    title: 'Precise descriptions at home and at work',
    subtitle:
      'Use one relative-clause pattern to clarify a housing problem, then transfer it to a work context.',
    mission:
      'Report a broken heater and arrange a repair, then use the same relative pattern to explain which role fits your experience.',
    outcomes: [
      'report a fault and arrange a specific next step',
      'attach a relative clause directly to the noun it clarifies',
      'transfer the same sentence pattern from housing to a work situation',
    ],
  },
  'chapter-21-narrative-news': {
    title: 'Reports and narratives',
    subtitle: 'Tell a sequence of events and clearly separate an earlier event from its result.',
    mission: 'Write a short report about a travel complication in precise chronological order.',
    outcomes: [
      'put past events in order',
      'distinguish als, wenn, and wann',
      'describe cause and effect',
    ],
  },
  'chapter-06-process': {
    title: 'Process and result',
    subtitle: 'Explain a work process from task assignment to a verified result.',
    mission:
      'Describe a team process in three connected steps and use the passive to emphasise the task, responsibility, and result check.',
    outcomes: [
      'order the task, assumption of responsibility, and result check',
      'build the event passive with “werden + Partizip II”',
      'explain the whole process without jumping between actors',
    ],
  },
  'chapter-22-opinion-compromise': {
    title: 'Opinion, reason, and compromise',
    subtitle: 'Express a preference, acknowledge an objection, and suggest a workable compromise.',
    mission:
      'Defend a priority in a planning discussion while including a valid request from the other side.',
    outcomes: [
      'state an opinion with a reason',
      'express a concession and its consequence',
      'suggest a conditional compromise',
    ],
  },
  'chapter-07-project': {
    title: 'Projects and decisions',
    subtitle: 'Compare options, describe consequences, and defend a team decision.',
    mission: 'Compare options, name their consequences, and defend a decision to your team.',
    outcomes: [
      'distinguish a proposal, its impact, and the final decision',
      'express concession, sequence, and consequence with a precise connector',
      'respond to an objection in a project discussion',
    ],
  },
  'chapter-23-feedback-conflict': {
    title: 'Feedback and conflict',
    subtitle:
      'Criticise specifically, calibrate your tone, and respond without becoming defensive.',
    mission: 'Turn vague criticism into verifiable feedback and agree on the next step.',
    outcomes: [
      'separate observation from evaluation',
      'soften an overly harsh statement',
      'confirm a specific corrective step',
    ],
  },
  'chapter-24-remote-work': {
    title: 'Mobility and remote work',
    subtitle: 'Suggest a work experiment, its conditions, and a measurable result.',
    mission: 'Present a hybrid-work pilot with a clear scope, metric, and decision point.',
    outcomes: [
      'form a condition without wenn',
      'describe an expected future result',
      'define a measurable criterion',
    ],
  },
  'chapter-08-negotiation': {
    title: 'Negotiation',
    subtitle: 'Set conditions, suggest a compromise, and answer an objection precisely.',
    mission: 'Set conditions, suggest a workable compromise, and respond to an objection.',
    outcomes: [
      'state a deadline, condition, and compromise',
      'distinguish an action, a completed state, and a possibility without clumsy passive forms',
      'keep a negotiation factual during disagreement',
    ],
  },
  'chapter-25-complaint-remedy': {
    title: 'Complaints and remedies',
    subtitle: 'Calm a complaint, take appropriate responsibility, and offer a remedy.',
    mission:
      'Resolve a customer problem without empty promises: verify the facts, remedy, and deadline.',
    outcomes: [
      'summarise the core complaint',
      'distinguish responsibility from cause',
      'offer a specific remedy with a deadline',
    ],
  },
  'chapter-26-data-consequences': {
    title: 'Presenting data and implications',
    subtitle:
      'Describe a trend, data limitations, and a recommendation without implying false causality.',
    mission:
      'Present a small data overview, separate observation from interpretation, and suggest another measurement.',
    outcomes: [
      'describe a change and a proportion',
      'distinguish correlation from cause',
      'make a limited recommendation',
    ],
  },
  'chapter-27-expert-discussion': {
    title: 'Expert discussion',
    subtitle: 'Weigh evidence, disagree professionally, and state limitations transparently.',
    mission:
      'Separate a supported conclusion from a hypothesis in a seminar debate and define uncertainty precisely.',
    outcomes: [
      'calibrate the degree of certainty',
      'refer to evidence and its limitations',
      'formulate professional disagreement',
    ],
  },
  'chapter-28-media-indirect-speech': {
    title: 'Media and reported speech',
    subtitle: 'Report someone else’s claim precisely and keep it separate from your own position.',
    mission:
      'Process two media statements without false certainty and attribute each one to a traceable source.',
    outcomes: [
      'turn a claim into reported speech',
      'distinguish reporting from commentary',
      'mark uncertainty and its source',
    ],
  },
  'chapter-09-argument': {
    title: 'Argumentation',
    subtitle: 'Separate a claim from its source, calibrate certainty, and defend a position.',
    mission:
      'Separate someone else’s claim from your view and defend a position with appropriate certainty.',
    outcomes: [
      'identify a claim, its evidence, and your position',
      'report someone else’s statement with Konjunktiv I',
      'answer an objection without presenting an assumption as fact',
    ],
  },
  'chapter-10-style': {
    title: 'Precise style',
    subtitle: 'Switch between verbal and nominal style and edit out unnecessary padding.',
    mission: 'Rewrite a clumsy text so it is precise, readable, and appropriate for its situation.',
    outcomes: [
      'recognise an unnecessarily abstract formulation',
      'switch deliberately between nominal and verbal style',
      'defend an editorial choice in a demanding conversation',
    ],
  },
  'chapter-29-mediation': {
    title: 'Mediation and nuance',
    subtitle:
      'Summarise both sides of a dispute, identify agreement and conflict, and avoid a false compromise.',
    mission:
      'Give a mediation summary that is faithful to both sides and ends with a verifiable next step.',
    outcomes: [
      'paraphrase two positions neutrally',
      'distinguish genuine agreement from apparent agreement',
      'suggest the next procedural step',
    ],
  },
  'chapter-30-policy-brief': {
    title: 'Synthesis and policy briefs',
    subtitle:
      'Synthesize several claims into a precise position with limitations and a recommendation.',
    mission:
      'Create a short policy brief that separates assumptions, options, risks, and the decision criterion.',
    outcomes: [
      'synthesise two short inputs',
      'make a recommendation with clear limitations',
      'edit a text into a precise professional register',
    ],
  },
};

let extendedCopyPromise: Promise<void> | undefined;

export function loadCourseCopyCatalog(): Promise<void> {
  extendedCopyPromise ??= import('./course-copy-catalog.ts').then(
    ({ extendedCourseChapterEnglishCopy }) => {
      Object.assign(englishChapters, extendedCourseChapterEnglishCopy);
      return undefined;
    },
  );
  return extendedCopyPromise;
}

const englishPhases: Record<CoursePathPhase, { label: string; description: string }> = {
  foundation: {
    label: 'Vocabulary and grammar',
    description: 'Meaning and pronunciation first, then the rule.',
  },
  connection: {
    label: 'Listening and sentences',
    description: 'Hear the new words and use them in complete sentences.',
  },
  production: {
    label: 'Write and speak',
    description: 'Write, review, and revise your own text, then use it in a short scenario.',
  },
  check: {
    label: 'Check what you can do',
    description: 'Recall from memory, use sentences in context, and revisit earlier material.',
  },
  bonus: {
    label: 'Read a story',
    description: 'Read a story and practise what you’ve learned.',
  },
};

const czechLevelNames: Record<DetailedCefrLevel, string> = {
  'A1.1': 'První věty',
  'A1.2': 'Každodenní orientace',
  'A2.1': 'Samostatně na cestách',
  'A2.2': 'Domluvit se a vyřešit problém',
  'B1.1': 'Mluvit o zkušenostech',
  'B1.2': 'Vysvětlit názor a záměr',
  'B2.1': 'Přesněji argumentovat',
  'B2.2': 'Zvládnout složitější situace',
  'C1.1': 'Jazyk pro studium a práci',
  'C1.2': 'Nuance, styl a přesnost',
};

const englishLevelNames: Record<DetailedCefrLevel, string> = {
  'A1.1': 'Your first sentences',
  'A1.2': 'Finding your way every day',
  'A2.1': 'Travelling independently',
  'A2.2': 'Making arrangements and solving problems',
  'B1.1': 'Talking about experience',
  'B1.2': 'Explaining opinions and intentions',
  'B2.1': 'Arguing with greater precision',
  'B2.2': 'Handling complex situations',
  'C1.1': 'German for study and work',
  'C1.2': 'Nuance, style, and precision',
};

export function courseChapterCopy(
  language: MotherTongue,
  chapter: CoursePathChapter,
): Pick<CoursePathChapter, 'title' | 'subtitle' | 'mission' | 'outcomes'> {
  if (language === 'cs') return chapter;
  return englishChapters[chapter.id] ?? chapter;
}

export function coursePhaseCopy(
  language: MotherTongue,
  phase: CoursePathPhase,
  fallback: { label: string; description: string },
): { label: string; description: string } {
  return language === 'en' ? englishPhases[phase] : fallback;
}

export function courseLevelName(language: MotherTongue, level: DetailedCefrLevel): string {
  return language === 'en' ? englishLevelNames[level] : czechLevelNames[level];
}

export function courseNodeCopy(
  language: MotherTongue,
  node: CoursePathNode,
  chapter?: CoursePathChapter,
): Pick<CoursePathNode, 'title' | 'description'> {
  if (language === 'cs') return node;
  const chapterTitle = chapter
    ? courseChapterCopy(language, chapter).title
    : (englishChapters[node.chapterId]?.title ?? 'this chapter');
  const copy: Record<CoursePathNode['type'], { title: string; description: string }> = {
    vocabulary: {
      title: `Vocabulary: ${chapterTitle}`,
      description: 'Meet the chapter vocabulary in full sentences and add it to long-term review.',
    },
    practice: {
      title: 'From meaning to German',
      description:
        'First recognise meanings, then type German expressions from memory. Include articles with nouns.',
    },
    grammar: {
      title: `Grammar: ${chapterTitle}`,
      description: 'Learn the chapter’s key structure and use it in context.',
    },
    mix: {
      title: 'Listening and sentences',
      description:
        'Transcribe a sentence and recognise the chapter pattern. At the end of each band, listen for the main point and a detail in a new message.',
    },
    sentence: {
      title: 'Writing',
      description:
        'Write a German text for the chapter’s situation, review it, and save your revised response.',
    },
    coach: {
      title: 'Conversation',
      description: 'Use what you’ve learned in a short conversation.',
    },
    checkpoint: {
      title: `Chapter test: ${chapterTitle}`,
      description:
        'Recall expressions, complete a sentence, and repair a section yourself. Each band ends with a practical situation and a new text: distinguish supported, contradicted, and missing information.',
    },
    reading: {
      title: 'Optional reading',
      description: 'Read a story, review its vocabulary, and answer questions about the plot.',
    },
  };
  return copy[node.type];
}

export function courseLockReason(language: MotherTongue, reason?: string): string | undefined {
  if (!reason || language === 'cs') return reason;
  return 'Complete the previous required step to unlock this activity.';
}
