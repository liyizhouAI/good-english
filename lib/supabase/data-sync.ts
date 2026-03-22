import type { SupabaseClient } from "@supabase/supabase-js";
import { db } from "@/lib/db/database";

const TABLE = "user_learning_data";

export async function pushLearningData(
  supabase: SupabaseClient,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const [words, patterns, materials] = await Promise.all([
    db.words.toArray(),
    db.patterns.toArray(),
    db.materials.toArray(),
  ]);

  await supabase.from(TABLE).upsert(
    {
      user_id: user.id,
      words_data: JSON.stringify(words),
      patterns_data: JSON.stringify(patterns),
      materials_data: JSON.stringify(materials),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

export async function pullLearningData(
  supabase: SupabaseClient,
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from(TABLE)
    .select("words_data, patterns_data, materials_data")
    .single();

  if (error || !data) return false;

  const remoteWords = data.words_data ? JSON.parse(data.words_data) : [];
  const remotePatterns = data.patterns_data
    ? JSON.parse(data.patterns_data)
    : [];
  const remoteMaterials = data.materials_data
    ? JSON.parse(data.materials_data)
    : [];

  // Cloud-first: replace local data entirely so deletions propagate
  await Promise.all([
    db.words.clear().then(() => db.words.bulkPut(remoteWords)),
    db.patterns.clear().then(() => db.patterns.bulkPut(remotePatterns)),
    db.materials.clear().then(() => db.materials.bulkPut(remoteMaterials)),
  ]);

  return true;
}
