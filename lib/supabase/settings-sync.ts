import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppSettings } from '@/lib/types/provider';

const TABLE = 'user_settings';

function isAppSettings(value: unknown): value is AppSettings {
  if (!value || typeof value !== 'object') return false;
  const settings = value as Partial<AppSettings>;
  return (
    typeof settings.activeProviderId === 'string' &&
    (settings.voiceProviderId === 'openai' ||
      settings.voiceProviderId === 'minimax') &&
    Array.isArray(settings.providers)
  );
}

export async function loadRemoteSettings(
  supabase: SupabaseClient,
): Promise<AppSettings | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('settings_data')
    .maybeSingle();

  if (error || !data) return null;

  try {
    const parsed = JSON.parse(data.settings_data) as unknown;
    return isAppSettings(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveRemoteSettings(
  supabase: SupabaseClient,
  settings: AppSettings,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from(TABLE)
    .upsert(
      { user_id: user.id, settings_data: JSON.stringify(settings), updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );

  if (error) {
    throw new Error(error.message);
  }
}
