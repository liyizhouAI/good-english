'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { LogOut, Cloud, CloudOff } from 'lucide-react';

interface Props {
  syncing: boolean;
  synced: boolean;
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

export function LoginCard({ syncing, synced }: Props) {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');

  async function handleGoogle() {
    setSigning(true);
    setError('');
    const { error: err } = await signInWithGoogle();
    if (err) {
      setError(err.message);
      setSigning(false);
    }
    // 成功会跳转，不需要 setSigning(false)
  }

  if (loading) return null;

  if (user) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {syncing ? (
              <Cloud className="h-4 w-4 text-[var(--muted-foreground)] animate-pulse" />
            ) : (
              <Cloud className="h-4 w-4 text-emerald-400" />
            )}
            <span className="font-semibold text-sm">账号同步</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              syncing
                ? 'bg-[var(--secondary)] text-[var(--muted-foreground)]'
                : synced
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-[var(--secondary)] text-[var(--muted-foreground)]'
            }`}>
              {syncing ? '同步中…' : synced ? '已同步' : '本地'}
            </span>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            退出
          </button>
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">
          {user.email} · API Key 自动加密同步，换设备登录即恢复
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <CloudOff className="h-4 w-4 text-amber-400" />
        <h3 className="font-semibold text-sm">登录以跨设备同步 API Key</h3>
      </div>
      <p className="text-xs text-[var(--muted-foreground)] mb-4">
        用 Google 账号一键登录，API Key 自动加密保存到云端，换设备也能自动恢复。
      </p>
      <button
        onClick={handleGoogle}
        disabled={signing}
        className="flex items-center justify-center gap-2 w-full rounded-lg border border-[var(--border)] bg-white text-gray-700 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
      >
        <GoogleIcon />
        {signing ? '跳转中…' : '用 Google 账号登录'}
      </button>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}
