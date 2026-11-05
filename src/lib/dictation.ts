export interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void)
    | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export interface RecorderLike {
  state: string;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  start(): void;
  stop(): void;
}
export interface DictationPlatform {
  recognition?: () => RecognitionLike;
  stream?: () => Promise<MediaStream>;
  recorder?: (stream: MediaStream) => RecorderLike;
  encode?: (blob: Blob) => Promise<string>;
  transcribe?: (audio: string, signal?: AbortSignal) => Promise<string>;
}
export type DictationPhase =
  | 'idle'
  | 'requesting'
  | 'listening'
  | 'transcribing';
export type DictationState = { phase: DictationPhase; hint: string };
export class DictationController {
  private platform: DictationPlatform;
  private write: (draft: string) => void;
  private state: (state: DictationState) => void;
  private generation = 0;
  private held = false;
  private recognition?: RecognitionLike;
  private recorder?: RecorderLike;
  private stream?: MediaStream;
  private timer?: ReturnType<typeof setTimeout>;
  private fallback = false;
  private controller?: AbortController;
  constructor(
    platform: DictationPlatform,
    write: (draft: string) => void,
    state: (state: DictationState) => void,
  ) {
    this.platform = platform;
    this.write = write;
    this.state = state;
  }
  private tracks() {
    this.stream?.getTracks().forEach((t) => {
      t.stop();
    });
    this.stream = undefined;
  }
  cancel(): void {
    this.generation++;
    this.controller?.abort();
    this.held = false;
    clearTimeout(this.timer);
    try {
      this.recognition?.abort();
    } catch {}
    try {
      if (this.recorder?.state === 'recording') this.recorder.stop();
    } catch {}
    this.tracks();
    this.recognition = undefined;
    this.recorder = undefined;
    this.state({ phase: 'idle', hint: '' });
  }
  async start(initial: string): Promise<void> {
    this.cancel();
    this.controller = new AbortController();
    this.held = true;
    const run = this.generation,
      append = (spoken: string) =>
        `${initial}${initial.trim() && spoken ? ' ' : ''}${spoken}`;
    this.state({
      phase: 'requesting',
      hint: 'Permite el micrófono y mantén pulsado mientras hablas.',
    });
    const limit = () => {
      this.timer = setTimeout(() => this.stop(), 45000);
    };
    if (this.platform.recognition && !this.fallback) {
      try {
        const r = this.platform.recognition();
        this.recognition = r;
        r.lang = 'es-ES';
        r.continuous = true;
        r.interimResults = true;
        r.onresult = (event) => {
          if (run !== this.generation || !this.held) return;
          const text = Array.from(event.results)
            .map((result) => result[0]?.transcript || '')
            .join(' ')
            .trim();
          this.write(append(text));
          this.state({
            phase: 'listening',
            hint: 'Escuchando… Suelta para revisar.',
          });
        };
        r.onerror = (event) => {
          if (run !== this.generation) return;
          this.fallback = true;
          this.cancel();
          this.state({
            phase: 'idle',
            hint:
              event.error === 'not-allowed'
                ? 'El permiso del micrófono fue rechazado. Puedes escribir tu acción.'
                : 'El dictado en vivo no está disponible. Al volver a mantener pulsado se intentará grabar y transcribir al soltar.',
          });
        };
        r.onend = () => {
          if (run !== this.generation) return;
          this.held = false;
          clearTimeout(this.timer);
          this.state({
            phase: 'idle',
            hint: 'Dictado finalizado. Revisa el texto antes de enviarlo.',
          });
        };
        r.start();
        this.state({
          phase: 'listening',
          hint: 'Escuchando… Suelta para revisar.',
        });
        limit();
        return;
      } catch {
        this.fallback = true;
        this.recognition = undefined;
      }
    }
    try {
      if (
        !this.platform.stream ||
        !this.platform.recorder ||
        !this.platform.encode ||
        !this.platform.transcribe
      )
        throw new Error(
          'Este navegador no ofrece captura de voz compatible. Puedes escribir tu acción.',
        );
      const stream = await this.platform.stream();
      if (run !== this.generation || !this.held) {
        stream.getTracks().forEach((t) => {
          t.stop();
        });
        return;
      }
      this.stream = stream;
      const recorder = this.platform.recorder(stream),
        parts: Blob[] = [];
      this.recorder = recorder;
      recorder.ondataavailable = (event) => {
        if (run === this.generation && event.data.size) parts.push(event.data);
      };
      recorder.onstop = () => {
        if (run !== this.generation) return;
        this.tracks();
        this.state({
          phase: 'transcribing',
          hint: 'Transcribiendo… El resultado quedará en el borrador.',
        });
        void (async () => {
          try {
            const blob = new Blob(parts, {
              type: parts[0]?.type || 'audio/webm',
            });
            if (!blob.size)
              throw new Error(
                'La grabación llegó vacía. Vuelve a mantener pulsado para hablar.',
              );
            const audio = await this.platform.encode?.(blob);
            if (run !== this.generation || !audio) return;
            const text = await this.platform.transcribe?.(
              audio,
              this.controller?.signal,
            );
            if (run !== this.generation) return;
            if (text) this.write(append(text));
            this.state({
              phase: 'idle',
              hint: text
                ? 'Revisa el texto y pulsa Enviar cuando esté correcto.'
                : 'No se detectó voz. Puedes volver a dictar o escribir.',
            });
          } catch (e) {
            if (run === this.generation)
              this.state({
                phase: 'idle',
                hint:
                  e instanceof Error
                    ? e.message
                    : 'No se pudo transcribir la grabación.',
              });
          }
        })();
      };
      recorder.start();
      this.state({
        phase: 'listening',
        hint: 'Grabando… Se transcribirá al soltar (máximo 45 s).',
      });
      limit();
    } catch (e) {
      if (run === this.generation) {
        this.held = false;
        this.tracks();
        this.state({
          phase: 'idle',
          hint:
            e instanceof Error && e.name !== 'NotAllowedError'
              ? e.message
              : 'No se pudo acceder al micrófono. Revisa el permiso o escribe tu acción.',
        });
      }
    }
  }
  stop(): void {
    if (!this.held) return;
    this.held = false;
    clearTimeout(this.timer);
    if (this.recorder?.state === 'recording') {
      this.recorder.stop();
      return;
    }
    this.generation++;
    try {
      this.recognition?.stop();
    } catch {}
    this.recognition = undefined;
    this.tracks();
    this.state({
      phase: 'idle',
      hint: 'Revisa el texto y pulsa Enviar cuando esté correcto.',
    });
  }
}
