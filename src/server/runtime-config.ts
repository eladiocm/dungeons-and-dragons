import { RuleError } from '../game/types.ts';

type Environment = Record<string, string | undefined>;
export function storageConfig(env: Environment = process.env):
  | { kind: 'sqlite'; directory: string }
  | {
      kind: 'supabase';
      url: string;
      publishableKey: string;
      secret: string;
      saveKey: Uint8Array;
      dailyLimit: number;
    } {
  const kind = env.GAME_STORE || (env.VERCEL ? '' : 'sqlite');
  if (kind === 'sqlite' && !env.VERCEL)
    return { kind, directory: env.GAME_DATA_DIR || '.data' };
  if (kind !== 'supabase')
    throw new RuleError(
      'Configura el guardado remoto antes de publicar la demo.',
      503,
    );
  const url = env.SUPABASE_URL || '',
    publishableKey = env.SUPABASE_PUBLISHABLE_KEY || '',
    secret = env.DND_BACKEND_SECRET || '',
    encoded = env.SAVE_KEY_BASE64 || '',
    dailyLimit = Number(env.DEMO_AI_DAILY_LIMIT || 100);
  const saveKey = Buffer.from(encoded, 'base64');
  if (
    !url.startsWith('https://') ||
    !publishableKey ||
    !/^[a-f0-9]{64}$/i.test(secret) ||
    saveKey.length !== 32 ||
    saveKey.toString('base64') !== encoded ||
    !Number.isInteger(dailyLimit) ||
    dailyLimit < 1 ||
    dailyLimit > 1000
  )
    throw new RuleError(
      'La configuración del guardado remoto está incompleta.',
      503,
    );
  return { kind, url, publishableKey, secret, saveKey, dailyLimit };
}
