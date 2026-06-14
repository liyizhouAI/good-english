"use client";

import { useEffect, useState } from "react";
import type {
  AuthChangeEvent,
  Session,
  User,
} from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

const AUTH_BOOT_TIMEOUT_MS = 5_000;
const AUTH_LOCK_RETRY_MS = 180;
const AUTH_LOCK_RETRY_COUNT = 3;

function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "登录状态检查失败，请稍后重试。";
}

function isAuthLockError(error: unknown) {
  return (
    error instanceof Error &&
    /lock:.*auth-token.*stole it/i.test(error.message)
  );
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      setUser(null);
      setError("登录状态检查超时，请检查网络或重新登录。");
      setLoading(false);
    }, AUTH_BOOT_TIMEOUT_MS);

    async function loadSession() {
      for (let attempt = 0; attempt <= AUTH_LOCK_RETRY_COUNT; attempt += 1) {
        try {
          return await supabase.auth.getSession();
        } catch (sessionError) {
          if (!isAuthLockError(sessionError) || attempt === AUTH_LOCK_RETRY_COUNT) {
            throw sessionError;
          }
          await delay(AUTH_LOCK_RETRY_MS * (attempt + 1));
        }
      }

      return await supabase.auth.getSession();
    }

    loadSession()
      .then(({ data }) => {
        if (cancelled) return;
        window.clearTimeout(timeoutId);
        setUser(data.session?.user ?? null);
        setError(null);
        setLoading(false);
      })
      .catch((sessionError) => {
        if (cancelled) return;
        window.clearTimeout(timeoutId);
        setUser(null);
        setError(getAuthErrorMessage(sessionError));
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((
      _event: AuthChangeEvent,
      session: Session | null,
    ) => {
      window.clearTimeout(timeoutId);
      setUser(session?.user ?? null);
      setError(null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  async function signInWithGoogle(nextPath?: string) {
    const supabase = createClient();
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            nextPath || `${window.location.pathname}${window.location.search}`,
          )}`
        : "";

    for (let attempt = 0; attempt <= AUTH_LOCK_RETRY_COUNT; attempt += 1) {
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
          },
        });
        return { error };
      } catch (authError) {
        if (!isAuthLockError(authError) || attempt === AUTH_LOCK_RETRY_COUNT) {
          return {
            error:
              authError instanceof Error
                ? authError
                : new Error("Google 登录启动失败，请稍后重试。"),
          };
        }
        await delay(AUTH_LOCK_RETRY_MS * (attempt + 1));
      }
    }

    return { error: new Error("Google 登录启动失败，请稍后重试。") };
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
  }

  return { user, loading, error, signInWithGoogle, signOut };
}
