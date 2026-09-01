import type { MotherTongue } from '../domain/types.ts';

export type SpeechRecognitionErrorCode =
  | 'aborted'
  | 'audio-capture'
  | 'language-not-supported'
  | 'network'
  | 'no-speech'
  | 'not-allowed'
  | 'service-not-allowed'
  | 'start-failed'
  | 'unsupported'
  | string;

type SpeechAlternativeLike = {
  transcript: string;
};

type SpeechResultLike = {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechAlternativeLike;
};

type SpeechResultListLike = {
  readonly length: number;
  readonly [index: number]: SpeechResultLike;
};

type SpeechResultEventLike = {
  readonly results: SpeechResultListLike;
} & Event;

type SpeechErrorEventLike = {
  readonly error: SpeechRecognitionErrorCode;
} & Event;

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
} & EventTarget;

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export type SpeechRecognitionHandle = {
  stop(): void;
  abort(): void;
};

export type SpeechRecognitionCallbacks = {
  onstart?: () => void;
  ontranscript: (transcript: string, final: boolean) => void;
  onerror: (message: string, code: SpeechRecognitionErrorCode) => void;
  onend?: () => void;
};

function recognitionConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const currentWindow = window as SpeechRecognitionWindow;
  return currentWindow.SpeechRecognition ?? currentWindow.webkitSpeechRecognition;
}

export function speechRecognitionSupported(): boolean {
  return Boolean(recognitionConstructor());
}

export function speechRecognitionErrorMessage(
  code: SpeechRecognitionErrorCode,
  language: MotherTongue = 'cs',
): string {
  if (language === 'en') {
    if (code === 'no-speech')
      return 'I did not catch anything. Move closer to the microphone and try again.';
    if (code === 'audio-capture')
      return 'The microphone is unavailable. You can type the answer instead.';
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      return 'The browser did not allow microphone access. You can type the answer instead.';
    }
    if (code === 'network') {
      return 'Speech recognition could not connect. You can type the answer instead.';
    }
    if (code === 'language-not-supported') {
      return 'This browser does not support German speech recognition. You can type the answer instead.';
    }
    if (code === 'unsupported') {
      return 'Speech recognition is not available here. You can type the answer instead.';
    }
    if (code === 'start-failed') return 'The microphone could not start. Please try again.';
    if (code === 'aborted') return '';
    return 'Speech recognition stopped unexpectedly. You can type the answer instead.';
  }

  if (code === 'no-speech') return 'Nic jsem nezachytil. Přibliž se k mikrofonu a zkus to znovu.';
  if (code === 'audio-capture') return 'Mikrofon teď není dostupný. Odpověď můžeš napsat ručně.';
  if (code === 'not-allowed' || code === 'service-not-allowed') {
    return 'Prohlížeč nepovolil mikrofon. Odpověď můžeš napsat ručně.';
  }
  if (code === 'network') {
    return 'Rozpoznání řeči se nepřipojilo. Odpověď můžeš napsat ručně.';
  }
  if (code === 'language-not-supported') {
    return 'Tento prohlížeč neumí německé rozpoznání. Odpověď můžeš napsat ručně.';
  }
  if (code === 'unsupported') {
    return 'Rozpoznání řeči tu není dostupné. Odpověď můžeš napsat ručně.';
  }
  if (code === 'start-failed') return 'Mikrofon se nepodařilo spustit. Zkus to ještě jednou.';
  if (code === 'aborted') return '';
  return 'Rozpoznání řeči se přerušilo. Odpověď můžeš napsat ručně.';
}

export function startGermanSpeechRecognition(
  callbacks: SpeechRecognitionCallbacks,
  language: MotherTongue = 'cs',
): SpeechRecognitionHandle | undefined {
  const Recognition = recognitionConstructor();
  if (!Recognition) {
    callbacks.onerror(speechRecognitionErrorMessage('unsupported', language), 'unsupported');
    return undefined;
  }

  const recognition = new Recognition();
  recognition.lang = 'de-DE';
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.addEventListener('start', () => callbacks.onstart?.());
  recognition.addEventListener('result', (event) => {
    const resultEvent = event as SpeechResultEventLike;
    const parts: string[] = [];
    let final = true;
    let index = 0;
    while (index < resultEvent.results.length) {
      const result = resultEvent.results[index];
      const transcript = result?.[0]?.transcript?.trim();
      if (transcript) parts.push(transcript);
      if (!result?.isFinal) final = false;
      index += 1;
    }
    callbacks.ontranscript(parts.join(' ').trim(), final);
  });
  recognition.addEventListener('error', (event) => {
    const errorEvent = event as SpeechErrorEventLike;
    callbacks.onerror(speechRecognitionErrorMessage(errorEvent.error, language), errorEvent.error);
  });
  recognition.addEventListener('end', () => callbacks.onend?.());

  try {
    recognition.start();
  } catch {
    callbacks.onerror(speechRecognitionErrorMessage('start-failed', language), 'start-failed');
    callbacks.onend?.();
    return undefined;
  }

  return {
    stop: () => recognition.stop(),
    abort: () => recognition.abort(),
  };
}
