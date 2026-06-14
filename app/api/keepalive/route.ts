export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TIMEOUT_MS = 15_000;

type ProbeTarget = {
  name: string;
  url: string;
  expectedStatuses?: number[];
  bodyIncludes?: string;
  headers?: HeadersInit;
};

type ProbeResult = {
  name: string;
  ok: boolean;
  status: number | null;
  durationMs: number;
  url: string;
  error?: string;
};

function noStoreHeaders(headers?: HeadersInit): HeadersInit {
  return {
    ...headers,
    "Cache-Control": "no-store",
  };
}

function messageFromError(error: unknown): string {
  if (error instanceof Error) {
    return error.name === "AbortError"
      ? `Request timed out after ${TIMEOUT_MS}ms`
      : error.message;
  }

  return String(error);
}

async function probe(target: ProbeTarget): Promise<ProbeResult> {
  const startedAt = Date.now();
  const expectedStatuses = target.expectedStatuses ?? [200];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(target.url, {
      cache: "no-store",
      headers: noStoreHeaders(target.headers),
      signal: controller.signal,
    });
    const body = await response.text();
    const hasExpectedStatus = expectedStatuses.includes(response.status);
    const hasExpectedBody = target.bodyIncludes
      ? body.includes(target.bodyIncludes)
      : true;

    return {
      name: target.name,
      ok: hasExpectedStatus && hasExpectedBody,
      status: response.status,
      durationMs: Date.now() - startedAt,
      url: target.url,
      error: hasExpectedBody
        ? undefined
        : `Response body did not include "${target.bodyIncludes}"`,
    };
  } catch (error) {
    return {
      name: target.name,
      ok: false,
      status: null,
      durationMs: Date.now() - startedAt,
      url: target.url,
      error: messageFromError(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function appTargets(origin: string): ProbeTarget[] {
  return [
    {
      name: "app-health",
      url: new URL("/api/health", origin).toString(),
      bodyIncludes: '"ok":true',
    },
    {
      name: "home-page",
      url: new URL("/", origin).toString(),
      bodyIncludes: "Good English",
    },
    {
      name: "import-page",
      url: new URL("/import", origin).toString(),
      bodyIncludes: "Good English",
    },
  ];
}

function supabaseTargets(): ProbeTarget[] {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    return [
      {
        name: "supabase-config",
        url: "missing:NEXT_PUBLIC_SUPABASE_URL",
        expectedStatuses: [200],
      },
    ];
  }

  return [
    {
      name: "supabase-auth-health",
      url: new URL("/auth/v1/health", supabaseUrl).toString(),
      headers: supabaseAnonKey ? { apikey: supabaseAnonKey } : undefined,
    },
  ];
}

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const targets = [...appTargets(origin), ...supabaseTargets()];
  const checks = await Promise.all(targets.map(probe));
  const ok = checks.every((check) => check.ok);

  return Response.json(
    {
      ok,
      service: "good-english",
      purpose: "scheduled keepalive",
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
