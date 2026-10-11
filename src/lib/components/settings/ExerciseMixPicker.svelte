<script lang="ts">
  import { localized } from '$lib/i18n';
  import Brain from '@lucide/svelte/icons/brain';
  import Check from '@lucide/svelte/icons/check';
  import Eye from '@lucide/svelte/icons/eye';
  import FileText from '@lucide/svelte/icons/file-text';
  import Keyboard from '@lucide/svelte/icons/keyboard';
  import Link2 from '@lucide/svelte/icons/link-2';
  import Mic from '@lucide/svelte/icons/mic';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Target from '@lucide/svelte/icons/target';

  import type { ExercisePreferences, MotherTongue } from '$lib/domain/types.ts';

  let {
    language,
    preferences,
    ontoggle,
  }: {
    language: MotherTongue;
    preferences: ExercisePreferences;
    ontoggle: (key: keyof ExercisePreferences) => void;
  } = $props();

  const exercises = [
    {
      key: 'typing',
      icon: Keyboard,
      title: ['Psaní', 'Typing'],
      description: [
        'Překlad z hlavy včetně členu.',
        'Recall the German form, including its article.',
      ],
    },
    {
      key: 'choice',
      icon: Target,
      title: ['Výběr', 'Multiple choice'],
      description: ['Vybereš správnou odpověď z nabídky.', 'Quickly recognise the correct answer.'],
    },
    {
      key: 'flashcard',
      icon: Eye,
      title: ['Kartičky', 'Flashcards'],
      description: ['Odhalení a vlastní hodnocení 1–4.', 'Reveal and rate yourself from 1 to 4.'],
    },
    {
      key: 'wordOrder',
      icon: FileText,
      title: ['Slovosled', 'Word order'],
      description: ['Skládání frází a příkladových vět.', 'Build phrases and example sentences.'],
    },
    {
      key: 'cloze',
      icon: Brain,
      title: ['Doplňování', 'Fill in'],
      description: [
        'Příklad, plurál nebo slovesný tvar.',
        'Complete an example, plural, or verb form.',
      ],
    },
    {
      key: 'sentence',
      icon: Sparkles,
      title: ['Vlastní věta', 'Your own sentence'],
      description: [
        'Gemini posoudí smysl, tvar i přirozenost.',
        'Gemini checks meaning, form, and naturalness.',
      ],
    },
    {
      key: 'matching',
      icon: Link2,
      title: ['Párování', 'Matching'],
      description: [
        'České významy propojíš s německými výrazy.',
        'Match English meanings with German expressions.',
      ],
    },
    {
      key: 'speaking',
      icon: Mic,
      title: ['Mluvení', 'Speaking'],
      description: [
        'Řekneš překlad nahlas a zkontroluješ přepis.',
        'Say the German answer aloud and check the transcript.',
      ],
    },
  ] satisfies Array<{
    key: keyof ExercisePreferences;
    icon: typeof Keyboard;
    title: [string, string];
    description: [string, string];
  }>;

  const copy = ([cs, en]: [string, string]) => localized(language, { cs, en });
</script>

<div class="mt-4 grid gap-[0.55rem] min-[640px]:grid-cols-2">
  {#each exercises as exercise}
    {@const active = preferences[exercise.key]}
    <button
      class={[
        'grid min-h-[5.2rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[0.2rem] border p-3 text-left [transition:transform_120ms_var(--ease-out-emil),border-color_140ms_ease,background-color_140ms_ease,box-shadow_120ms_var(--ease-out-emil)] active:[transform:scale(0.98)] fine-hover:border-ink-950',
        active
          ? 'border-ink-950 bg-white text-ink-950 shadow-[3px_3px_0_var(--color-acid-500)]'
          : 'border-line bg-paper-100 text-ink-800',
      ]}
      aria-pressed={active}
      type="button"
      onclick={() => ontoggle(exercise.key)}
    >
      <span class="grid size-[2.45rem] place-items-center rounded-full border border-current"
        ><exercise.icon size={19} /></span
      ><span
        ><strong class="block text-[0.86rem]">{copy(exercise.title)}</strong><small
          class="mt-[0.18rem] block text-[0.75rem] leading-[1.35] text-ink-800"
          >{copy(exercise.description)}</small
        ></span
      ><Check class={active ? 'text-mint-700' : 'opacity-0'} size={16} />
    </button>
  {/each}
</div>
