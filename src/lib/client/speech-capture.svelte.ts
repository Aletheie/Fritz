import {
  speechRecognitionSupported,
  startGermanSpeechRecognition,
  type SpeechRecognitionHandle,
} from './speech-recognition.ts';

import type { MotherTongue } from '../domain/types.ts';

export type SpeechCaptureCallbacks = {
  /** Interim and final text as the recogniser hears it. */
  ontranscript: (transcript: string) => void;
  onend?: () => void;
};

/**
 * One German speech-recognition run at a time. Every start bumps a run counter so
 * late callbacks from a cancelled recogniser can never overwrite a newer answer.
 */
export class SpeechCapture {
  available = $state(false);
  listening = $state(false);
  error = $state('');
  /** Raw final recognition output, kept for pronunciation feedback even if edited. */
  transcript = $state('');
  confidence = $state<number | undefined>(undefined);

  #handle: SpeechRecognitionHandle | undefined;
  #run = 0;

  detect(): void {
    this.available = speechRecognitionSupported();
  }

  /** Clears the last run's transcript and error before a new prompt. */
  reset(error = ''): void {
    this.transcript = '';
    this.confidence = undefined;
    this.error = error;
  }

  start(language: MotherTongue, callbacks: SpeechCaptureCallbacks): void {
    this.error = '';
    const run = ++this.#run;
    this.#handle = startGermanSpeechRecognition(
      {
        onstart: () => {
          if (run === this.#run) this.listening = true;
        },
        ontranscript: (transcript, final, confidence) => {
          if (run !== this.#run || !transcript) return;
          callbacks.ontranscript(transcript);
          if (final) {
            this.transcript = transcript;
            this.confidence = confidence;
          }
        },
        onerror: (message, code) => {
          if (run !== this.#run || code === 'aborted') return;
          this.error = message;
        },
        onend: () => {
          if (run !== this.#run) return;
          this.listening = false;
          this.#handle = undefined;
          callbacks.onend?.();
        },
      },
      language,
    );
  }

  /** Stops gracefully so the final transcript still arrives; `cancel` drops it. */
  stop(cancel = false): void {
    const handle = this.#handle;
    if (!handle) {
      this.listening = false;
      return;
    }
    if (cancel) {
      this.#run += 1;
      this.#handle = undefined;
      this.listening = false;
      handle.abort();
    } else {
      handle.stop();
    }
  }
}
