export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function hasValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export async function GET() {
  const checks = {
    app: true,
    supabaseUrl: hasValue(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: hasValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  };
  const ok = Object.values(checks).every(Boolean);

  return Response.json(
    {
      ok,
      service: "good-english",
      environment:
        process.env.GOOD_ENGLISH_ENV ??
        process.env.VERCEL_ENV ??
        process.env.NODE_ENV ??
        "local",
      commit:
        process.env.GOOD_ENGLISH_COMMIT_SHA?.slice(0, 7) ??
        process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
        null,
      timestamp: new Date().toISOString(),
      checks,
    },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
