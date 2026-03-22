'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { LogIn, LogOut, Mail, Check, Cloud, CloudOff } from 'lucide-react';

interface Props {
  syncing: boolean;
  synced: boolean;
}

export function LoginCard({ syncing, synced }: Props) {
  const { user, loading, signInWithEmail, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function handleSend() {
    if (!email.includes('@')) { setError('请输入有效邮箱'); return; }
    setSending(true);
    setError('');
    const { error: err } = await signInWithEmail(email);
    setSending(false);
    if (err) { setError(err.message); return; }
    setSent(true);
  }

  if (loading) return null;

  if (user) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {syncing ? (
              <Cloud className="h-4 w-4 text-[var(--muted-foreground)] animate-pulse" />
            ) : synced ? (
              <Cloud className="h-4 w-4 text-emerald-400" />
            ) : (
              <CloudOff className="h-4 w-4 text-[var(--muted-foreground)]" />
            )}
            <span className="font-semibold text-sm">账号同步</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${synced ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[var(--secondary)] text-[var(--muted-foreground)]'}`}>
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
          {user.email} · API Key 已加密同步到云端，换设备登录即可自动恢复
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
        输入邮箱，收到魔法链接后点击即可登录。API Key 加密保存在云端，换设备也能自动恢复。
      </p>

      {sent ? (
        <div className="flex items-center gap-2 text-emerald-400 text-sm">
          <Check className="h-4 w-4" />
          邮件已发送，请查收并点击链接登录
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="your@email.com"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-9 pr-3 py-2 text-sm outline-none focus:border-[var(--primary)] transition-colors"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] text-white px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <LogIn className="h-4 w-4" />
            {sending ? '发送中…' : '发送'}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}
