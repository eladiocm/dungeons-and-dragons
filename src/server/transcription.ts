import { RuleError } from '../game/types.ts';
export function validateRecording(raw: unknown): string {
  if (
    typeof raw !== 'string' ||
    raw.length > 1920100 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(raw)
  )
    throw new RuleError('Grabación no válida o demasiado larga.', 413);
  const b = Buffer.from(raw, 'base64');
  if (
    b.length < 46 ||
    b.toString('ascii', 0, 4) !== 'RIFF' ||
    b.toString('ascii', 8, 12) !== 'WAVE' ||
    b.toString('ascii', 12, 16) !== 'fmt ' ||
    b.readUInt32LE(16) !== 16 ||
    b.readUInt16LE(20) !== 1 ||
    b.readUInt16LE(22) !== 1 ||
    b.readUInt32LE(24) !== 16000 ||
    b.readUInt32LE(28) !== 32000 ||
    b.readUInt16LE(32) !== 2 ||
    b.readUInt16LE(34) !== 16 ||
    b.toString('ascii', 36, 40) !== 'data' ||
    b.readUInt32LE(40) !== b.length - 44 ||
    b.readUInt32LE(4) !== b.length - 8 ||
    (b.length - 44) % 2 !== 0
  )
    throw new RuleError('Se requiere audio WAV PCM mono de 16 kHz.');
  if ((b.length - 44) / 32000 > 45)
    throw new RuleError('La grabación supera los 45 segundos.', 413);
  return raw;
}
export function createTranscriber(
  config: { accountId?: string; token?: string },
  fetcher: typeof fetch = fetch,
) {
  return async (raw: unknown, signal?: AbortSignal): Promise<string> => {
    const audio = validateRecording(raw);
    if (!/^[a-f\d]{32}$/i.test(config.accountId || '') || !config.token)
      throw new RuleError(
        'El dictado grabado no está configurado. Puedes escribir tu acción.',
        503,
      );
    let response: Response;
    try {
      response = await fetcher(
        `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/@cf/openai/whisper-large-v3-turbo`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.token}`,
          },
          body: JSON.stringify({
            audio,
            language: 'es',
            task: 'transcribe',
            vad_filter: true,
            condition_on_previous_text: false,
          }),
          signal: AbortSignal.any([
            AbortSignal.timeout(60000),
            ...(signal ? [signal] : []),
          ]),
        },
      );
    } catch {
      throw new RuleError(
        'No se pudo transcribir. Puedes escribir o volver a dictar.',
        503,
      );
    }
    if (!response.ok)
      throw new RuleError(
        response.status === 429
          ? 'Se alcanzó la cuota de dictado. Puedes escribir tu acción.'
          : 'El dictado no está disponible en este momento.',
        response.status === 429 ? 429 : 502,
      );
    const data = await response.json();
    if (
      data?.success !== true ||
      typeof data.result?.text !== 'string' ||
      data.result.text.length > 4000
    )
      throw new RuleError('La transcripción recibida no es válida.', 502);
    return data.result.text.trim();
  };
}
