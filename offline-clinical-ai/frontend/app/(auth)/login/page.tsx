'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

import { login } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await login(username, password);
      localStorage.setItem('ocip_token', data.access_token);
      router.push('/dashboard');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form className="w-full max-w-md rounded-2xl border bg-[var(--surface)] p-6" onSubmit={onSubmit}>
        <h1 className="font-heading text-3xl font-black">Secure Login</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Local-only access for clinical staff.</p>
        <div className="mt-6 space-y-4">
          <input
            className="w-full rounded-xl border bg-transparent px-3 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            required
          />
          <input
            className="w-full rounded-xl border bg-transparent px-3 py-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
          />
          {error ? <p className="text-sm text-rose-500">{error}</p> : null}
          <button
            className="w-full rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-white hover:bg-cyan-600"
            disabled={loading}
            type="submit"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>
      </form>
    </div>
  );
}
