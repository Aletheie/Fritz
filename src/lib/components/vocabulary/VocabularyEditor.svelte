<script lang="ts">
  import type {
    Article,
    CefrLevel,
    GermanAuxiliary,
    ImportedNoteDraft,
    LexemeKind,
  } from '$lib/domain/types.ts';
  import { tr } from '$lib/state/app';
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

  const label =
    '[&>span]:mb-[0.45rem] [&>span]:block [&>span]:text-[0.82rem] [&>span]:font-[740] [&>span]:text-ink-600';
</script>

<div class={['grid sm:grid-cols-2', compact ? 'gap-[0.8rem]' : 'gap-4']}>
  <label class={label} for={`${idPrefix}-german`}>
    <span>{$tr('Německy', 'German')}</span>
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

  <label class={label} for={`${idPrefix}-czech`}>
    <span>{$tr('Česky', 'English')}</span>
    <input
      id={`${idPrefix}-czech`}
      class="field"
      value={draft.czech}
      autocomplete="off"
      maxlength="220"
      placeholder={$tr('pes', 'dog')}
      oninput={(event) => update('czech', event.currentTarget.value)}
    />
  </label>

  <label class={label} for={`${idPrefix}-kind`}>
    <span>{$tr('Druh výrazu', 'Entry type')}</span>
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
      {#each kinds as kind (kind.value)}
        <option value={kind.value}>{$tr(kind.cs, kind.en)}</option>
      {/each}
    </select>
  </label>

  <label class={label} for={`${idPrefix}-level`}>
    <span>{$tr('Úroveň', 'Level')}</span>
    <select
      id={`${idPrefix}-level`}
      class="field"
      value={draft.cefr ?? ''}
      onchange={(event) =>
        update('cefr', (event.currentTarget.value || undefined) as CefrLevel | undefined)}
    >
      <option value="">{$tr('Neurčeno', 'Not set')}</option>
      {#each levels as level}<option value={level}>{level}</option>{/each}
    </select>
  </label>

  {#if draft.kind === 'noun'}
    <fieldset class="sm:col-span-2">
      <legend class="mb-2 text-sm font-bold text-ink-600"
        >{$tr('Člen (u podstatného jména povinný)', 'Article (required for nouns)')}</legend
      >
      <div class="grid grid-cols-3 gap-2" aria-label={$tr('Vybrat člen', 'Choose an article')}>
        {#each ['der', 'die', 'das'] as article}
          <button
            type="button"
            class={[
              'min-h-[2.65rem] rounded-[0.8rem] border font-[760] [transition:transform_150ms_var(--ease-out-emil),color_160ms_var(--ease-out-emil),border-color_160ms_var(--ease-out-emil),background-color_160ms_var(--ease-out-emil)] active:[transform:scale(0.97)]',
              draft.article === article
                ? 'border-ink-950 bg-ink-950 text-white'
                : 'border-line bg-paper-50 text-ink-600',
            ]}
            aria-pressed={draft.article === article}
            onclick={() => updateArticle(article as Article)}>{article}</button
          >
        {/each}
      </div>
    </fieldset>
    <label class="{label} sm:col-span-2" for={`${idPrefix}-plural`}>
      <span>{$tr('Množné číslo', 'Plural')}</span>
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

  <label class="{label} sm:col-span-2" for={`${idPrefix}-tags`}>
    <span>{$tr('Tagy', 'Tags')}</span>
    <input
      id={`${idPrefix}-tags`}
      class="field"
      value={draft.tags.join(', ')}
      placeholder={$tr('škola, lekce-4, a1', 'school, lesson-4, a1')}
      maxlength="900"
      oninput={(event) => update('tags', strings(event.currentTarget.value))}
    />
  </label>

  <details
    class="group rounded-2xl border border-line bg-[color-mix(in_srgb,var(--color-paper-100)_72%,white)] px-4 py-[0.85rem] sm:col-span-2"
  >
    <summary
      class="flex min-h-8 cursor-pointer list-none items-center justify-between gap-4 text-[0.88rem] font-[760] [&::-webkit-details-marker]:hidden"
    >
      <span>{$tr('Další užitečné údaje', 'More useful details')}</span>
      <ChevronDown
        class="transition-transform duration-180 ease-out-emil group-open:rotate-180"
        size={17}
      />
    </summary>
    <div class="mt-4 grid gap-4 sm:grid-cols-2">
      <label class={label} for={`${idPrefix}-example-de`}>
        <span>{$tr('Příklad německy', 'Example in German')}</span>
        <textarea
          id={`${idPrefix}-example-de`}
          class="field min-h-24 resize-y"
          value={draft.exampleDe ?? ''}
          maxlength="300"
          lang="de"
          oninput={(event) => update('exampleDe', event.currentTarget.value || undefined)}
        ></textarea>
      </label>
      <label class={label} for={`${idPrefix}-example-cs`}>
        <span>{$tr('Překlad příkladu', 'Example translation')}</span>
        <textarea
          id={`${idPrefix}-example-cs`}
          class="field min-h-24 resize-y"
          value={draft.exampleCs ?? ''}
          maxlength="300"
          oninput={(event) => update('exampleCs', event.currentTarget.value || undefined)}
        ></textarea>
      </label>

      {#if draft.kind === 'verb'}
        <label class={label} for={`${idPrefix}-third`}>
          <span>{$tr('3. osoba prézentu', '3rd person present')}</span>
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
        <label class={label} for={`${idPrefix}-preterite`}>
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
        <label class={label} for={`${idPrefix}-participle`}>
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
        <label class={label} for={`${idPrefix}-auxiliary`}>
          <span>{$tr('Pomocné sloveso', 'Auxiliary verb')}</span>
          <select
            id={`${idPrefix}-auxiliary`}
            class="field"
            value={draft.verbForms?.auxiliary ?? ''}
            onchange={(event) => updateVerbForm('auxiliary', event.currentTarget.value)}
          >
            <option value="">{$tr('Neurčeno', 'Not set')}</option>
            <option value="haben">haben</option>
            <option value="sein">sein</option>
          </select>
        </label>
      {/if}

      <label class="{label} sm:col-span-2" for={`${idPrefix}-note`}>
        <span>{$tr('Poznámka k učení', 'Learning note')}</span>
        <textarea
          id={`${idPrefix}-note`}
          class="field min-h-20 resize-y"
          value={draft.learningNote ?? ''}
          placeholder={$tr(
            'Na co si dát pozor, vazba, rod nebo nepravidelnost…',
            'What to watch for: pattern, gender, or irregularity…',
          )}
          maxlength="320"
          oninput={(event) => update('learningNote', event.currentTarget.value || undefined)}
        ></textarea>
      </label>
      <label class="{label} sm:col-span-2" for={`${idPrefix}-mnemonic`}>
        <span>{$tr('Pomůcka', 'Memory aid')}</span>
        <textarea
          id={`${idPrefix}-mnemonic`}
          class="field min-h-20 resize-y"
          value={draft.mnemonic ?? ''}
          placeholder={$tr(
            'Krátká asociace, pokud opravdu pomáhá…',
            'A clue to help you remember the word…',
          )}
          maxlength="320"
          oninput={(event) => update('mnemonic', event.currentTarget.value || undefined)}
        ></textarea>
      </label>
      <label class={label} for={`${idPrefix}-accepted-de`}>
        <span>{$tr('Další správné německé varianty', 'Other accepted German variants')}</span>
        <input
          id={`${idPrefix}-accepted-de`}
          class="field"
          value={draft.acceptedGerman.join(', ')}
          placeholder={$tr('varianta 1, varianta 2', 'variant 1, variant 2')}
          maxlength="900"
          lang="de"
          oninput={(event) => update('acceptedGerman', strings(event.currentTarget.value))}
        />
      </label>
      <label class={label} for={`${idPrefix}-accepted-cs`}>
        <span>{$tr('Další správné české varianty', 'Other accepted English variants')}</span>
        <input
          id={`${idPrefix}-accepted-cs`}
          class="field"
          value={draft.acceptedCzech.join(', ')}
          placeholder={$tr('varianta 1, varianta 2', 'variant 1, variant 2')}
          maxlength="1400"
          oninput={(event) => update('acceptedCzech', strings(event.currentTarget.value))}
        />
      </label>
    </div>
  </details>
</div>
