/** Concise rules for English readers; examples retain the original German. */
export const englishGrammarRules: Record<string, string> = {
  'verb-second-position':
    'In a statement, the finite verb occupies the second position. A whole time or place phrase counts as one position; if it comes first, the subject follows the verb.',
  questions:
    'Yes/no questions begin with the finite verb. With a question word such as wann, warum or wie, the question word comes first and the finite verb comes second.',
  negation:
    'Use kein with an indefinite noun or a noun without an article. Use nicht to negate a verb, adjective, phrase or possessive noun phrase. Kein changes its ending with gender, number and case.',
  'modal-verbs':
    'Conjugate the modal verb for the subject and place the other verb in the infinitive at the end. Müssen expresses obligation; dürfen nicht expresses prohibition; können expresses ability or possibility.',
  'sein-haben':
    'Sein and haben have irregular present forms. Use sein for identity, age and states, and haben for possession. Match the finite form to the subject.',
  'present-endings':
    'Regular present endings are -e, -st, -t, -en, -t, -en. Stems ending in -t or -d normally add an e before -st or -t: du arbeitest, er arbeitet.',
  'separable-verbs':
    'In a main clause, a separable prefix moves to the end: ich rufe an. After a modal verb, the full infinitive stays together at the end: ich muss anrufen.',
  'perfect-haben':
    'The perfect tense uses a present form of haben plus a past participle at the end. Regular participles often have ge- and -t; strong verbs such as lesen have their own forms.',
  'perfect-sein':
    'Verbs of movement to a destination or change of state commonly form the perfect tense with sein. Bleiben also uses sein. Conjugate sein for the subject and put the participle at the end.',
  'articles-gender':
    'Learn each noun together with its article. In the nominative, der is masculine, die feminine and das neuter; the plural article is die. Nouns ending in -chen are neuter.',
  accusative:
    'A direct object commonly takes the accusative. Masculine der becomes den and ein becomes einen. Feminine die/eine and neuter das/ein keep their nominative forms.',
  dative:
    'The dative often marks a recipient and follows verbs such as helfen and prepositions such as mit. Definite articles are dem, der, dem and plural den; plural nouns usually add -n.',
  'two-way-prepositions':
    'Two-way prepositions take the dative for a location and the accusative for a destination or change of position. Movement within a location does not automatically require the accusative.',
  'weil-dass':
    'Weil introduces a reason and dass introduces reported content. Both send the finite verb to the end of their subordinate clause, including after an infinitive with a modal verb.',
  'time-manner-place':
    'A neutral German sentence often gives time before manner and place. Other orders can shift the focus. The finite verb still stays second in a main clause.',
  comparison:
    'Comparatives usually add -er and use als for an unequal comparison. Adverbial superlatives use am …-sten. Some forms are irregular: gut, besser, am besten.',
  'adjective-endings':
    'After a definite article, adjectives use weak endings: usually -e in the nominative singular and feminine/neuter accusative, and -en elsewhere. The article carries most gender and case information.',
  'mixed-checkpoint':
    'Combine the patterns: finite verb second in a main clause, finite verb last after weil or dass, correct object case, and the auxiliary plus participle for past events.',
  'praeteritum-core':
    'Sein, haben and modal verbs commonly use the Präteritum in accounts of the past. Learn the stems war, hatte, konnte, musste, wollte and durfte, then add the endings required by the subject.',
  'konjunktiv-two-present':
    'Konjunktiv II expresses hypothetical situations, wishes and polite requests. Common forms include wäre, hätte and könnte. Most other verbs can use würde plus infinitive.',
  'relative-clauses':
    'A relative pronoun gets gender and number from its antecedent, but case from its role inside the relative clause. A preceding preposition also governs its case; the finite verb goes last.',
  'zu-infinitives':
    'Many verbs take a zu-infinitive. With a separable verb, zu goes between the prefix and stem. Modal verbs take an infinitive without zu. Um, ohne and statt introduce distinct relationships.',
  'process-passive':
    'The event passive uses werden plus a past participle. Conjugate werden for tense and subject. An agent can be added with von; in a subordinate clause the finite auxiliary goes last.',
  'past-sequence':
    'The past perfect uses hatte or war plus a past participle to place an event before another past event. The choice of auxiliary follows the same pattern as the perfect tense.',
  'past-counterfactual':
    'An unreal past condition uses hätte or wäre plus a past participle. It imagines a different past rather than predicting the future. The auxiliary depends on the verb.',
  'complex-connectors':
    'Choose the logical relation before the conjunction: obwohl for concession, indem for means, während for time or contrast, and sodass for a result. Their finite verb goes last.',
  'passive-variants':
    'Werden plus participle describes an event; sein plus participle describes a resulting state. Sich lassen plus infinitive expresses possibility, while sein plus zu-infinitive can express possibility or necessity.',
  'adjective-endings-full':
    'Without an article, an adjective carries strong gender and case endings. After ein, it supplies information not shown by ein. After a fully inflected article, endings are mainly -e and -en.',
  'n-declension':
    'Many masculine nouns denoting people add -(e)n in every singular case except the nominative: der Student, den Studenten, dem Studenten, des Studenten. Herrn is the case form of Herr.',
  'indirect-speech':
    'Konjunktiv I marks a statement as somebody else’s report. Use a clear Konjunktiv II substitute when Konjunktiv I matches the indicative. Past reports use habe or sei plus a participle.',
  'epistemic-modals':
    'Modal verbs can show the strength or source of a claim: müssen for a strong inference, dürfte for probability, sollen for outside reports and wollen for a person’s claim about themselves.',
  'verb-clusters':
    'A modal governing another infinitive uses an Ersatzinfinitiv in the perfect: hat arbeiten müssen. In a subordinate clause, the finite auxiliary precedes this double infinitive: weil sie hat arbeiten müssen.',
  'participial-attributes':
    'A participle used before a noun takes adjective endings. Participle I usually describes an ongoing active action; participle II often describes a completed or passive action. Keep the modifiers with their participle.',
  'nominal-and-verbal-style':
    'Formal German often uses noun–verb collocations such as einen Antrag stellen. A verbal clause can make a dense noun phrase easier to follow without changing its time or logical relationship.',
  'c1-editing-checkpoint':
    'Precise editing combines source attribution, logical time order, correctly inflected attributes and an appropriate degree of certainty. Preserve who claims something and distinguish an inference from a report.',
  'personal-pronouns':
    'A subject pronoun agrees with the person or noun it replaces: ich, du, er, sie, es, wir, ihr, sie. Formal Sie is capitalised and takes the plural verb form.',
  'possessive-articles':
    'The owner determines the stem mein, dein, sein, ihr, unser or euer. The following noun determines gender, number and case endings. Formal Ihr is capitalised.',
  'numbers-and-prices':
    'For 21–99, German says the unit before und and the ten: zweiundvierzig. Number words are written together. A decimal comma separates euros and cents in German notation.',
  'time-and-dates':
    'Use um for a clock time, am for a weekday or date, and im for a month or season. Halb acht means half an hour before eight. Dates use inflected ordinal numbers.',
  'imperative-basics':
    'For du, commands normally use the stem without the pronoun; for ihr, use the normal verb form without ihr. Formal commands use infinitive + Sie. Sein is irregular: sei, seid, seien Sie.',
  'dative-pronouns':
    'Dative pronouns replace a dative person or thing: mir, dir, ihm, ihr, uns, euch, ihnen. Formal Ihnen is capitalised. Use them after dative verbs such as helfen, danken and gefallen.',
  'reflexive-verbs':
    'Reflexive pronouns refer back to the subject: mich/dich/sich/uns/euch/sich. With a separate accusative object, some verbs use dative mir or dir: ich wasche mir die Hände.',
  'fixed-place-prepositions':
    'Use nach for most city and country destinations, zu for people and many institutions, bei for being with someone, and aus or von for origins. These prepositions have their own case patterns.',
  'basic-time-prepositions':
    'Seit links a starting point with a situation still continuing; vor locates a past event; in locates a future event. Bis marks an endpoint and ab marks a starting point.',
  'coordinating-connectors':
    'Und, aber, oder, denn and sondern connect clauses without sending the verb to the end. Sondern replaces a negated alternative; denn introduces a reason with main-clause word order.',
  'quantity-words':
    'Use viel for an uncountable quantity and viele with countable plural nouns. Wenige means few; genug means enough. Ein paar is an uncapitalised expression meaning a few.',
  'indefinite-pronouns':
    'Man is a general human subject and takes a singular verb. Jemand and niemand refer to people and can change case; etwas and nichts refer to things and do not take these person endings.',
  'ordinal-numbers':
    'Ordinals act like adjectives and take endings. Most use -t- up to nineteen and -st- from twenty. Important irregular forms include erste, dritte and achte; am requires a dative ending.',
  'possessive-pronouns':
    'A standalone possessive replaces a noun and must show its gender, number and case: mein Mantel → meiner. Distinguish it from a possessive article followed by a noun.',
  'pronoun-es':
    'Es can replace a neuter noun, introduce weather or time, and appear in constructions such as es gibt or es ist wichtig. Its role determines whether it is a pronoun or a fixed placeholder.',
  'verb-preposition-basics':
    'Learn a verb together with its required preposition and case: sich interessieren für, denken an, teilnehmen an, sprechen über and sich freuen auf. The preposition cannot simply be translated word for word.',
  'indirect-questions':
    'Indirect questions place the finite verb last. Retain the question word for an open question; use ob for a yes/no question. The containing clause can itself be a statement or a polite question.',
  'purpose-clauses':
    'Use um … zu when the implied subjects match, and damit when a separate subject is needed. Both express purpose; a damit clause has a finite verb at the end.',
  'infinitive-complements':
    'Verbs such as planen and versuchen and many adjective expressions take a zu-infinitive. Insert zu inside a separable infinitive. Modal verbs normally take a bare infinitive.',
  'lassen-constructions':
    'Lassen plus a bare infinitive can mean allowing an action or having someone do it. Conjugate lassen for the subject; the action itself remains in the infinitive.',
  'paired-connectors-basic':
    'Keep both halves of paired connectors: entweder … oder, weder … noch, sowohl … als auch. Connect parallel words or phrases so the shared grammatical frame works for both.',
  'relative-clauses-basic':
    'A relative clause follows a noun and puts its finite verb last. Der/die/das agrees in gender and number with that noun, but uses the case needed inside the relative clause.',
  'praeteritum-lexical-verbs':
    'Strong verbs change their stem in the Präteritum, such as schreiben → schrieb. Mixed verbs combine a stem change and -te, such as bringen → brachte. Match the ending to the subject.',
  'als-wenn-wann':
    'Als refers to a single past situation; wenn refers to repeated situations or conditions. Wann asks about time directly or indirectly. All three can introduce clauses with the finite verb last.',
  'before-after-clauses':
    'Bevor places its event after the other event; nachdem places it before. For two past events, a nachdem clause often uses the past perfect to make the sequence explicit.',
  'future-with-werden':
    'Futur I uses a present form of werden and a final infinitive. It can express a future action or an assumption about the present, depending on context.',
  'present-for-future':
    'A present-tense verb with a clear future time phrase naturally expresses a schedule or fixed plan. Werden can add prediction, promise or uncertainty; it is not obligatory after morgen.',
  'genitive-case':
    'The genitive expresses possession and other noun relationships. Masculine and neuter definite articles become des, usually with -(e)s on the noun; feminine and plural use der.',
  'genitive-prepositions':
    'Formal standard German normally uses the genitive after wegen, trotz, während and innerhalb. Select both the article and noun ending for the noun’s gender and number.',
  'adjectives-without-article':
    'Without an article, the adjective must mark gender and case itself: starker Kaffee, frisches Gemüse, mit großer Geduld. These strong endings largely resemble definite-article endings.',
  'da-wo-compounds':
    'Da(r)- compounds refer back to things or ideas, and wo(r)- compounds ask about them. Add r before a vowel. For people, use the preposition plus a personal or question pronoun instead.',
  'two-object-order':
    'With two noun objects, neutral order usually puts dative before accusative. A pronoun usually precedes a noun object; with two pronouns, accusative normally comes before dative.',
  'conditional-without-wenn':
    'A conditional clause can omit wenn by putting the finite verb first. Use the appropriate indicative or hypothetical form, then keep the usual word order in the following main clause.',
  'concession-patterns':
    'Obwohl introduces a subordinate clause with verb-last order. Trotzdem is an adverb and triggers inversion when placed first. Zwar … aber acknowledges one point and contrasts another.',
  'result-and-degree':
    'Sodass introduces a consequence and sends the verb last. So … dass links a degree with its result. It is distinct from damit, which expresses an intended purpose.',
  'participles-as-adjectives':
    'Participle I (infinitive + d) describes an ongoing active action. Participle II often describes a completed or passive result. Before a noun, both take normal adjective endings.',
  'nominalized-adjectives':
    'An adjective used as a noun is capitalised but keeps adjective endings: ein Reisender, mit einer Bekannten. After etwas or nichts, the neuter form is common: etwas Neues.',
  'future-perfect':
    'Futur II uses werden + past participle + haben/sein. With a deadline it describes completion by a future point; without one it can express an assumption about a past event.',
  'subjective-modal-perfect':
    'A modal plus participle and haben/sein can express an inference about the past. Müssen suggests a strong inference; könnte a possibility; wollen can report the subject’s own claim.',
  'passive-with-modals':
    'Use modal + past participle + werden: muss bezahlt werden. The modal carries tense and agreement. In a subordinate clause the finite modal follows the passive infinitive.',
  'passive-agent-and-tense':
    'The passive uses werden plus participle. Its perfect form uses sein and worden, without ge-. Von commonly marks an agent; durch can mark a cause or means.',
  'modal-particles':
    'Unstressed particles colour a statement rather than naming an event. Mal can soften a request, doch challenge an assumption, ja refer to shared knowledge, and eben accept a situation.',
  'reference-adverbs':
    'Reference adverbs connect to an earlier idea: dadurch expresses a means or result, daraufhin a subsequent reaction, dabei an accompanying action, and demgegenüber a contrast. Initial adverbs are followed by the finite verb.',
  'proportional-comparison':
    'Je + comparative introduces a subordinate clause with the verb last. Desto or umso + comparative begins the main clause, followed immediately by the finite verb.',
  'focus-constructions':
    'Was … betrifft frames a topic. Nicht … sondern contrasts alternatives, and nicht nur … sondern auch adds a parallel element. Ausgerechnet marks a surprising person or circumstance.',
  'right-field-structure':
    'Long comparisons and some heavy phrases can follow the closing part of the verb bracket. Keep the connection clear; moving ordinary short objects there without context can sound awkward.',
  'noun-verb-collocations':
    'Formal German combines specific nouns and verbs: Maßnahmen treffen, eine Rolle spielen, in Kraft treten, in Betracht ziehen. Learn the whole expression rather than choosing a verb by literal translation.',
  'hedging-and-distance':
    'Calibrate a claim to the evidence. Könnte expresses possibility, dürfte probability, and offenbar an inference from evidence. Angeblich attributes an unconfirmed claim to others and may express distance.',
  'word-formation':
    'Suffixes help reveal grammatical function: -ung and -keit form feminine nouns; -bar often means possible to do; -los means without. Inflect derived adjectives when they come before a noun.',
  'complex-punctuation':
    'Commas reveal clause boundaries. Separate relative and subordinate clauses; infinitive groups introduced by ohne or um also require separation. Use a colon to introduce an explanation or specification.',
  'noun-plurals':
    'German nouns do not share one plural ending. Learn the plural with each noun, including umlauts: Tische, Lampen, Kinder, Autos, Bücher. The nominative plural definite article is always die.',
  'present-vowel-change':
    'Some strong verbs change their vowel in the du and er/sie/es present forms: fahren → fährst, lesen → liest. The wir and ihr forms normally keep the infinitive vowel.',
  'accusative-prepositions':
    'Für, durch, ohne, gegen and um take the accusative. Masculine articles therefore become den or einen; feminine and neuter forms remain die/eine and das/ein.',
  'dative-prepositions':
    'Mit, bei, von, zu, aus, nach and seit take the dative. Choose the article or possessive ending for the noun’s gender and number. Nach is used for most city destinations.',
  'demonstrative-determiners':
    'Dieser, jeder and welcher take endings similar to the definite article. Choose the ending from the noun’s gender, number and case, rather than from the meaning alone.',
  'connector-adverbs':
    'Deshalb, deswegen, darum and sonst can connect main clauses. If one comes first, the finite verb follows immediately. Sonst expresses an alternative consequence: otherwise.',
  'adjective-endings-after-ein':
    'After ein, kein or a possessive article, the adjective shows gender where the article does not: ein guter Kaffee. Where the article already marks the case, weaker endings appear.',
  'position-and-placement-verbs':
    'Liegen, stehen and sitzen describe position; legen, stellen and setzen describe putting something into a position. Two-way prepositions take dative for location and accusative for a destination.',
  'temporal-subordinate-clauses':
    'Seitdem marks a starting point continuing onwards, bis an endpoint, sobald an immediate next event, and solange a duration. Each introduces a subordinate clause with the finite verb last.',
  'brauchen-nicht-zu':
    'Nicht brauchen + zu-infinitive means there is no need to do something. It does not forbid the action. A prohibition normally uses nicht dürfen.',
  'adjective-prepositions':
    'Many adjectives require a fixed preposition: stolz auf, zufrieden mit, interessiert an, verantwortlich für and abhängig von. Learn the case with the expression.',
  'nominalized-infinitives':
    'An infinitive used as a noun is neuter and capitalised: das Lesen, beim Kochen, zum Mitnehmen. Use a normal lowercase infinitive when it is part of the verb phrase.',
  'prepositional-relative-clauses':
    'In a relative clause, put the required preposition immediately before the relative pronoun. The preposition determines case; the antecedent determines gender and number.',
  'hypothetical-comparisons':
    'Als ob introduces an imagined comparison with Konjunktiv II and verb-last order. With als alone, the finite verb follows als immediately. Use a past form when the imagined event is earlier.',
  'perfect-infinitive':
    'The perfect infinitive expresses an earlier completed action: gemacht zu haben or gegangen zu sein. Place zu before the auxiliary and select haben or sein as in the perfect tense.',
  'clause-correlates':
    'Pronominal adverbs can bridge a verb and its complement: darauf, dass … or daran, zu … . Retain the preposition required by the verb and choose a clause or infinitive to fit the subjects.',
  'negation-scope':
    'Negation does not always apply to the whole proposition. Nicht alle means not all, not none; nicht unbedingt means not necessarily; kaum jemand means hardly anyone. Preserve this scope when paraphrasing.',
  'connective-relative-clauses':
    'Was can refer back to a whole previous statement. Wobei adds an accompanying circumstance, wodurch a consequence or means, and woraufhin a subsequent reaction. The finite verb goes last.',
  'gerundive-attributes':
    'Zu + participle I before a noun expresses something to be done or capable of being done: die zu prüfenden Daten. The ending follows adjective rules and the exact modal meaning depends on context.',
  'nuanced-connectors':
    'Zumal adds a supporting reason, wohingegen contrasts, geschweige denn strengthens an unlikely alternative, and insofern … als limits the extent of a claim. Keep the intended logical relation intact.',
  'compound-noun-gender':
    'The final noun in a German compound determines its gender: die Sorte → die Brotsorte, das Stück → das Kuchenstück. Then inflect the article according to the compound’s case.',
  'seit-versus-vor':
    'Seit gives the starting point or duration of a continuing situation, commonly with the present tense. Vor places a completed event before now and commonly accompanies a past tense. Both take the dative.',
  'ohne-anstatt-zu':
    'Ohne … zu describes an action that does not take place; anstatt … zu describes a rejected alternative. Use these infinitive clauses when the implied subject matches the main clause.',
  'man-versus-passive':
    'Man presents a general human actor; the passive foregrounds the process or affected object. Changing to passive makes the accusative object the subject and requires werden plus a participle.',
  'source-attribution-phrases':
    'Laut, nach Angaben and zufolge mark the source of a claim. Name the person, report or post clearly. With zufolge after the noun, use the dative. Attribution is not proof that the claim is true.',
  'es-gibt-accusative':
    'Es gibt introduces something that exists in a location. The noun phrase after gibt is accusative, even when plural: einen Markt, ein Zimmer, keine freien Zimmer.',
  'wer-wen-wem':
    'Wer asks for a nominative subject, wen for an accusative object, and wem for a dative object. Determine the case from the verb or preposition, not from word order alone.',
  'separable-imperative':
    'A separable imperative puts the verb first and its prefix at the end. Formal commands keep Sie after the verb; informal commands omit du or ihr.',
  'hin-her-direction':
    'Hin describes movement away from the speaker’s reference point; her movement towards it. Combine them with direction words: hinein/herein, hinaus/heraus. Wohin asks for a destination; woher for an origin.',
  'schon-noch-erst':
    'Schon means already, noch means still or yet, and erst highlights that something is only at an early point or will happen no sooner than a stated time. Context determines the contrast.',
  'werden-change':
    'Werden with an adjective or noun means becoming, rather than a future action. Its perfect is ist geworden. Distinguish this from future werden + infinitive and passive werden + participle.',
  'nouns-with-prepositions':
    'Some nouns have fixed prepositions: Interesse an, Grund für, Teilnahme an, Angst vor and Hoffnung auf. Learn the whole phrase and the case required by the preposition.',
  'waehrend-clause':
    'Während as a conjunction introduces a clause with the finite verb last and can express simultaneous events or contrast. As a preposition, it is followed by a noun phrase, normally in the genitive.',
  'reciprocal-einander':
    'Sich can be reflexive or reciprocal, so context matters. Einander makes “one another” explicit. Prepositions combine with it into forms such as miteinander and voneinander.',
  'genitive-relative-pronouns':
    'Dessen refers to masculine or neuter singular antecedents; deren to feminine or plural antecedents. They express possession inside the relative clause and are not inflected like ordinary articles.',
  'indem-dadurch-dass':
    'Indem and dadurch, dass express how a result is achieved. They introduce verb-last clauses; dadurch, dass readily states a causal means involving a different subject.',
  'haben-sein-zu-infinitive':
    'Haben + zu-infinitive places an obligation on its subject. Sein + zu-infinitive presents an action as necessary or possible, with the subject receiving the action. Context disambiguates the modal meaning.',
  'evidential-sollen-wollen':
    'Sollen can report what others claim; wollen can report what the subject claims about themselves. Neither verifies the claim. For past events, combine the modal with a perfect infinitive.',
  'apposition-case-punctuation':
    'A detached apposition is set off by two commas and normally agrees in case with the noun it explains. A name needed to identify a person, such as meine Kollegin Anna, normally has no commas.',
  'ellipsis-parallelism':
    'An ellipsis leaves out material recoverable from a shared structure. Coordinate parallel grammatical units so the missing verb or complement fits each part without changing its construction.',
};
