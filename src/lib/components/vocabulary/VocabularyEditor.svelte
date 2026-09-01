<script lang="ts">
  import type {
    Article,
    CefrLevel,
    GermanAuxiliary,
    ImportedNoteDraft,
    LexemeKind,
  } from '$lib/domain/types.ts';
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';

  let {
    draft = $bindable(),
    idPrefix = 'vocabulary',
    compact = false,
  } = $props<{
    draft: ImportedNoteDraft;
    idPrefix?: string;
    compact?: boolean;
  }>();

  const kinds: Array<{ value: LexemeKind; cs: string; en: string }> = [
    { value: 'noun', cs: 'Podstatné jméno', en: 'Noun' },
    { value: 'verb', cs: 'Sloveso', en: 'Verb' },
    { value: 'adjective', cs: 'Přídavné jméno', en: 'Adjective' },
    { value: 'phrase', cs: 'Fráze', en: 'Phrase' },
    { value: 'other', cs: 'Ostatní', en: 'Other' },
  ];
  const levels: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  function strings(value: string): string[] {
    return [
      ...new Set(
        value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ];
  }

  function update<K extends keyof ImportedNoteDraft>(key: K, value: ImportedNoteDraft[K]): void {
    draft = { ...draft, [key]: value };
  }

  function updateArticle(article: Article | undefined): void {
    update('article', article);
  }

  function updateVerbForm(
    key: 'thirdPerson' | 'preterite' | 'participle' | 'auxiliary',
    value: string,
  ): void {
    const forms = { ...draft.verbForms };
    if (key === 'auxiliary') {
      forms.auxiliary = (value || undefined) as GermanAuxiliary | undefined;
    } else if (key === 'thirdPerson') {
      forms.thirdPerson = value || undefined;
    } else if (key === 'preterite') {
      forms.preterite = value || undefined;
    } else {
      forms.participle = value || undefined;
    }
    update('verbForms', forms);
  }
</script>

<div class:compact class="editor-grid">
  <label class="field-label" for={`${idPrefix}-german`}>
    <span>{copy('Německy', 'German')}</span>
    <input
      id={`${idPrefix}-german`}
      class="field"
      value={draft.german}
      autocomplete="off"
      spellcheck="false"
      maxlength="140"
      lang="de"
      placeholder={draft.kind === 'noun' ? 'Hund' : 'verstehen'}
      oninput={(event) => update('german', event.currentTarget.value)}
    />
  </label>

  <label class="field-label" for={`${idPrefix}-czech`}>
    <span>{copy('Česky', 'English')}</span>
    <input
      id={`${idPrefix}-czech`}
      class="field"
      value={draft.czech}
      autocomplete="off"
      maxlength="220"
      placeholder={copy('pes', 'dog')}
      oninput={(event) => update('czech', event.currentTarget.value)}
    />
  </label>

  <label class="field-label" for={`${idPrefix}-kind`}>
    <span>{copy('Druh výrazu', 'Entry type')}</span>
    <select
      id={`${idPrefix}-kind`}
      class="field"
      value={draft.kind}
      onchange={(event) => {
        const kind = event.currentTarget.value as LexemeKind;
        draft = {
          ...draft,
          kind,
          article: kind === 'noun' ? draft.article : undefined,
          plural: kind === 'noun' ? draft.plural : undefined,
          verbForms: kind === 'verb' ? draft.verbForms : undefined,
        };
      }}
    >
      {#each kinds as kind}
        <option value={kind.value}>{copy(kind.cs, kind.en)}</option>
      {/each}
    </select>
  </label>

  <label class="field-label" for={`${idPrefix}-level`}>
    <span>{copy('Úroveň', 'Level')}</span>
    <select
      id={`${idPrefix}-level`}
      class="field"
      value={draft.cefr ?? ''}
      onchange={(event) =>
        update('cefr', (event.currentTarget.value || undefined) as CefrLevel | undefined)}
    >
      <option value="">{copy('Neurčeno', 'Not set')}</option>
      {#each levels as level}<option value={level}>{level}</option>{/each}
    </select>
  </label>

  {#if draft.kind === 'noun'}
    <fieldset class="sm:col-span-2">
      <legend class="mb-2 text-sm font-bold text-ink-600"
        >{copy('Člen (u podstatného jména povinný)', 'Article (required for nouns)')}</legend
      >
      <div class="grid grid-cols-3 gap-2" aria-label={copy('Vybrat člen', 'Choose an article')}>
        {#each ['der', 'die', 'das'] as article}
          <button
            type="button"
            class="article-inline"
            class:article-inline-active={draft.article === article}
            aria-pressed={draft.article === article}
            onclick={() => updateArticle(article as Article)}>{article}</button
          >
        {/each}
      </div>
    </fieldset>
    <label class="field-label sm:col-span-2" for={`${idPrefix}-plural`}>
      <span>{copy('Množné číslo', 'Plural')}</span>
      <input
        id={`${idPrefix}-plural`}
        class="field"
        value={draft.plural ?? ''}
        autocomplete="off"
        spellcheck="false"
        maxlength="140"
        lang="de"
        placeholder="die Hunde"
        oninput={(event) => update('plural', event.currentTarget.value || undefined)}
      />
    </label>
  {/if}

  <label class="field-label sm:col-span-2" for={`${idPrefix}-tags`}>
    <span>{copy('Tagy', 'Tags')}</span>
    <input
      id={`${idPrefix}-tags`}
      class="field"
      value={draft.tags.join(', ')}
      placeholder={copy('škola, lekce-4, a1', 'school, lesson-4, a1')}
      maxlength="900"
      oninput={(event) => update('tags', strings(event.currentTarget.value))}
    />
  </label>

  <details class="details-panel sm:col-span-2">
    <summary>
      <span>{copy('Další užitečné údaje', 'More useful details')}</span>
      <ChevronDown size={17} />
    </summary>
    <div class="mt-4 grid gap-4 sm:grid-cols-2">
      <label class="field-label" for={`${idPrefix}-example-de`}>
        <span>{copy('Příklad německy', 'Example in German')}</span>
        <textarea
          id={`${idPrefix}-example-de`}
          class="field min-h-24 resize-y"
          value={draft.exampleDe ?? ''}
          maxlength="300"
          lang="de"
          oninput={(event) => update('exampleDe', event.currentTarget.value || undefined)}
        ></textarea>
      </label>
      <label class="field-label" for={`${idPrefix}-example-cs`}>
        <span>{copy('Překlad příkladu', 'Example translation')}</span>
        <textarea
          id={`${idPrefix}-example-cs`}
          class="field min-h-24 resize-y"
          value={draft.exampleCs ?? ''}
          maxlength="300"
          oninput={(event) => update('exampleCs', event.currentTarget.value || undefined)}
        ></textarea>
      </label>

      {#if draft.kind === 'verb'}
        <label class="field-label" for={`${idPrefix}-third`}>
          <span>{copy('3. osoba prézentu', '3rd person present')}</span>
          <input
            id={`${idPrefix}-third`}
            class="field"
            value={draft.verbForms?.thirdPerson ?? ''}
            placeholder="spricht"
            maxlength="100"
            lang="de"
            oninput={(event) => updateVerbForm('thirdPerson', event.currentTarget.value)}
          />
        </label>
        <label class="field-label" for={`${idPrefix}-preterite`}>
          <span>Präteritum</span>
          <input
            id={`${idPrefix}-preterite`}
            class="field"
            value={draft.verbForms?.preterite ?? ''}
            placeholder="sprach"
            maxlength="100"
            lang="de"
            oninput={(event) => updateVerbForm('preterite', event.currentTarget.value)}
          />
        </label>
        <label class="field-label" for={`${idPrefix}-participle`}>
          <span>Partizip II</span>
          <input
            id={`${idPrefix}-participle`}
            class="field"
            value={draft.verbForms?.participle ?? ''}
            placeholder="gesprochen"
            maxlength="100"
            lang="de"
            oninput={(event) => updateVerbForm('participle', event.currentTarget.value)}
          />
        </label>
        <label class="field-label" for={`${idPrefix}-auxiliary`}>
          <span>{copy('Pomocné sloveso', 'Auxiliary verb')}</span>
          <select
            id={`${idPrefix}-auxiliary`}
            class="field"
            value={draft.verbForms?.auxiliary ?? ''}
            onchange={(event) => updateVerbForm('auxiliary', event.currentTarget.value)}
          >
            <option value="">{copy('Neurčeno', 'Not set')}</option>
            <option value="haben">haben</option>
            <option value="sein">sein</option>
          </select>
        </label>
      {/if}

      <label class="field-label sm:col-span-2" for={`${idPrefix}-note`}>
        <span>{copy('Poznámka k učení', 'Learning note')}</span>
        <textarea
          id={`${idPrefix}-note`}
          class="field min-h-20 resize-y"
          value={draft.learningNote ?? ''}
          placeholder={copy(
            'Na co si dát pozor, vazba, rod nebo nepravidelnost…',
            'What to watch for: pattern, gender, or irregularity…',
          )}
          maxlength="320"
          oninput={(event) => update('learningNote', event.currentTarget.value || undefined)}
        ></textarea>
      </label>
      <label class="field-label sm:col-span-2" for={`${idPrefix}-mnemonic`}>
        <span>{copy('Pomůcka', 'Memory aid')}</span>
        <textarea
          id={`${idPrefix}-mnemonic`}
          class="field min-h-20 resize-y"
          value={draft.mnemonic ?? ''}
          placeholder={copy(
            'Krátká asociace, pokud opravdu pomáhá…',
            'A short association, if it genuinely helps…',
          )}
          maxlength="320"
          oninput={(event) => update('mnemonic', event.currentTarget.value || undefined)}
        ></textarea>
      </label>
      <label class="field-label" for={`${idPrefix}-accepted-de`}>
        <span>{copy('Další správné německé varianty', 'Other accepted German variants')}</span>
        <input
          id={`${idPrefix}-accepted-de`}
          class="field"
          value={draft.acceptedGerman.join(', ')}
          placeholder={copy('varianta 1, varianta 2', 'variant 1, variant 2')}
          maxlength="900"
          lang="de"
          oninput={(event) => update('acceptedGerman', strings(event.currentTarget.value))}
        />
      </label>
      <label class="field-label" for={`${idPrefix}-accepted-cs`}>
        <span>{copy('Další správné české varianty', 'Other accepted English variants')}</span>
        <input
          id={`${idPrefix}-accepted-cs`}
          class="field"
          value={draft.acceptedCzech.join(', ')}
          placeholder={copy('varianta 1, varianta 2', 'variant 1, variant 2')}
          maxlength="1400"
          oninput={(event) => update('acceptedCzech', strings(event.currentTarget.value))}
        />
      </label>
    </div>
  </details>
</div>

<style>
  .editor-grid {
    display: grid;
    gap: 1rem;
  }

  @media (min-width: 640px) {
    .editor-grid {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
  }

  .editor-grid.compact {
    gap: 0.8rem;
  }

  .field-label > span {
    display: block;
    margin-bottom: 0.45rem;
    color: var(--color-ink-600);
    font-size: 0.82rem;
    font-weight: 740;
  }

  .details-panel {
    border: 1px solid var(--color-line);
    border-radius: 1rem;
    background: color-mix(in srgb, var(--color-paper-100) 72%, white);
    padding: 0.85rem 1rem;
  }

  .details-panel summary {
    display: flex;
    min-height: 2rem;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    cursor: pointer;
    font-size: 0.88rem;
    font-weight: 760;
    list-style: none;
  }

  .details-panel summary::-webkit-details-marker {
    display: none;
  }

  .details-panel[open] summary :global(svg) {
    transform: rotate(180deg);
  }

  .details-panel summary :global(svg) {
    transition: transform 180ms var(--ease-out-emil);
  }

  .article-inline {
    min-height: 2.65rem;
    border: 1px solid var(--color-line);
    border-radius: 0.8rem;
    color: var(--color-ink-600);
    background: var(--color-paper-50);
    font-weight: 760;
    transition:
      transform 150ms var(--ease-out-emil),
      color 160ms var(--ease-out-emil),
      border-color 160ms var(--ease-out-emil),
      background-color 160ms var(--ease-out-emil);
  }

  .article-inline:active {
    transform: scale(0.97);
  }

  .article-inline-active {
    border-color: var(--color-ink-950);
    color: white;
    background: var(--color-ink-950);
  }
</style>
