const AUDIO_CACHE = 'wortly-learning-audio-v1';
const MANIFEST_URL = '/audio/manifest.json';

export type LearningAudioEntry = {
  id: string;
  url: string;
  transcriptHash: string;
  durationMs: number;
  voice: string;
  license: string;
  version: number;
};

export type LearningAudioManifest = {
  schemaVersion: 1;
  generatedAt: string;
  entries: LearningAudioEntry[];
};

export type LearningAudioResult = {
  source: 'canonical' | 'system-voice';
  audioId: string;
};

let manifestPromise: Promise<LearningAudioManifest> | undefined;
let activeAudio: HTMLAudioElement | undefined;
let activeUtterance: SpeechSynthesisUtterance | undefined;

export async function hashLearningAudioTranscript(text: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Kontrola kanonického audia není v tomto prohlížeči dostupná.');
  }
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text.normalize('NFC')),
  );
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseLearningAudioManifest(value: unknown): LearningAudioManifest {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.entries)) {
    throw new Error('Audio manifest nemá podporovaný formát.');
  }
  if (typeof value.generatedAt !== 'string' || Number.isNaN(Date.parse(value.generatedAt))) {
    throw new Error('Audio manifest nemá platné datum.');
  }
  const seen = new Set<string>();
  const entries = value.entries.map((raw) => {
    if (!isRecord(raw)) throw new Error('Audio manifest obsahuje neplatnou položku.');
    const id = raw.id;
    const url = raw.url;
    if (
      typeof id !== 'string' ||
      !/^[a-z0-9][a-z0-9-]{0,199}$/u.test(id) ||
      seen.has(id) ||
      typeof url !== 'string' ||
      !url.startsWith('/audio/') ||
      url.includes('..') ||
      url.includes('?') ||
      url.includes('#')
    ) {
      throw new Error('Audio manifest obsahuje neplatnou nebo duplicitní identitu.');
    }
    if (
      typeof raw.transcriptHash !== 'string' ||
      !/^[a-f0-9]{64}$/u.test(raw.transcriptHash) ||
      typeof raw.durationMs !== 'number' ||
      !Number.isInteger(raw.durationMs) ||
      raw.durationMs < 100 ||
      raw.durationMs > 300_000 ||
      typeof raw.voice !== 'string' ||
      raw.voice.length === 0 ||
      raw.voice.length > 100 ||
      typeof raw.license !== 'string' ||
      raw.license.length === 0 ||
      raw.license.length > 200 ||
      typeof raw.version !== 'number' ||
      !Number.isInteger(raw.version) ||
      raw.version < 1
    ) {
      throw new Error(`Audio položka „${id}“ nemá platná metadata.`);
    }
    seen.add(id);
    return {
      id,
      url,
      transcriptHash: raw.transcriptHash,
      durationMs: raw.durationMs,
      voice: raw.voice,
      license: raw.license,
      version: raw.version,
    };
  });
  return { schemaVersion: 1, generatedAt: value.generatedAt, entries };
}

export function loadLearningAudioManifest(): Promise<LearningAudioManifest> {
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetch(MANIFEST_URL, { credentials: 'same-origin' })
    .then((response) => {
      if (!response.ok) throw new Error('Audio manifest není dostupný.');
      return response.json() as Promise<unknown>;
    })
    .then(parseLearningAudioManifest)
    .catch((error: unknown) => {
      manifestPromise = undefined;
      throw error;
    });
  return manifestPromise;
}

async function canonicalAudioResponse(entry: LearningAudioEntry): Promise<Response> {
  if (!('caches' in globalThis)) {
    const response = await fetch(entry.url, { credentials: 'same-origin', redirect: 'error' });
    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok || !contentType.toLocaleLowerCase('en-US').startsWith('audio/')) {
      throw new Error('Kanonické audio nemá platnou odpověď.');
    }
    return response;
  }
  const cache = await caches.open(AUDIO_CACHE);
  const cacheKey = `${entry.url}?wortly-version=${entry.version}`;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;
  const response = await fetch(entry.url, { credentials: 'same-origin', redirect: 'error' });
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok || !contentType.toLocaleLowerCase('en-US').startsWith('audio/')) {
    throw new Error('Kanonické audio nemá platnou odpověď.');
  }
  await cache.put(cacheKey, response.clone());
  return response;
}

async function playCanonical(entry: LearningAudioEntry): Promise<void> {
  const response = await canonicalAudioResponse(entry);
  const objectUrl = URL.createObjectURL(await response.blob());
  const audio = new Audio(objectUrl);
  activeAudio = audio;
  await new Promise<void>((resolve, reject) => {
    const finish = () => {
      URL.revokeObjectURL(objectUrl);
      if (activeAudio === audio) activeAudio = undefined;
    };
    audio.addEventListener(
      'ended',
      () => {
        finish();
        resolve();
      },
      { once: true },
    );
    audio.addEventListener(
      'error',
      () => {
        finish();
        reject(new Error('Kanonické audio se nepodařilo přehrát.'));
      },
      { once: true },
    );
    void audio.play().catch((error: unknown) => {
      finish();
      reject(error);
    });
  });
}

function playSystemVoice(text: string, rate: number): Promise<void> {
  if (!('speechSynthesis' in globalThis) || !('SpeechSynthesisUtterance' in globalThis)) {
    return Promise.reject(new Error('V tomto prohlížeči není dostupné přehrávání němčiny.'));
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'de-DE';
  utterance.rate = Math.min(1.15, Math.max(0.65, rate));
  let germanVoice: SpeechSynthesisVoice | undefined;
  for (const voice of speechSynthesis.getVoices()) {
    const language = voice.lang.toLocaleLowerCase('en-US');
    if (language === 'de-de') {
      germanVoice = voice;
      break;
    }
    if (!germanVoice && language.startsWith('de')) germanVoice = voice;
  }
  utterance.voice = germanVoice ?? null;
  activeUtterance = utterance;
  return new Promise<void>((resolve, reject) => {
    utterance.addEventListener(
      'end',
      () => {
        if (activeUtterance === utterance) activeUtterance = undefined;
        resolve();
      },
      { once: true },
    );
    utterance.addEventListener(
      'error',
      () => {
        if (activeUtterance === utterance) activeUtterance = undefined;
        reject(new Error('Systémový hlas se nepodařilo přehrát.'));
      },
      { once: true },
    );
    speechSynthesis.speak(utterance);
  });
}

export function stopLearningAudio(): void {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.removeAttribute('src');
    activeAudio.load();
    activeAudio = undefined;
  }
  if ('speechSynthesis' in globalThis) speechSynthesis.cancel();
  activeUtterance = undefined;
}

export async function playLearningAudio(input: {
  audioId: string;
  text: string;
  rate?: number;
}): Promise<LearningAudioResult> {
  stopLearningAudio();
  try {
    const manifest = await loadLearningAudioManifest();
    const entry = manifest.entries.find((candidate) => candidate.id === input.audioId);
    if (entry && entry.transcriptHash === (await hashLearningAudioTranscript(input.text))) {
      await playCanonical(entry);
      return { source: 'canonical', audioId: input.audioId };
    }
  } catch {
    // A missing manifest or failed canonical file is an expected offline fallback.
  }
  await playSystemVoice(input.text, input.rate ?? 0.88);
  return { source: 'system-voice', audioId: input.audioId };
}

export async function downloadLearningAudio(audioIds?: string[]): Promise<{
  downloaded: number;
  unavailable: number;
}> {
  const manifest = await loadLearningAudioManifest();
  const requested = audioIds ? new Set(audioIds) : undefined;
  let downloaded = 0;
  let unavailable = 0;
  for (const entry of manifest.entries) {
    if (requested && !requested.has(entry.id)) continue;
    try {
      // Keep large offline downloads sequential so they do not saturate a
      // constrained school or mobile connection.
      // oxlint-disable-next-line no-await-in-loop
      await canonicalAudioResponse(entry);
      downloaded += 1;
    } catch {
      unavailable += 1;
    }
  }
  return { downloaded, unavailable };
}

export async function clearDownloadedLearningAudio(): Promise<boolean> {
  if (!('caches' in globalThis)) return false;
  return caches.delete(AUDIO_CACHE);
}
