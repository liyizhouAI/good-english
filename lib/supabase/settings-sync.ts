import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppSettings } from '@/lib/types/provider';

const TABLE = 'user_settings';

export async function loadRemoteSettings(
  supabase: SupabaseClient,
): Promise<AppSettings | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('settings_data')
    .single();

  if (error || !data) return null;

  try {
    return JSON.parse(data.settings_data) as AppSettings;
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

  await supabase
    .from(TABLE)
    .upsert(
      { user_id: user.id, settings_data: JSON.stringify(settings), updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
}
