import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiErrorMessage } from '../api/client';
import { oauthUrl } from '../api/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2 text-primary">
          <Sparkles size={22} />
          <span className="text-lg font-semibold text-slate-900">Rapid Prototype Assistant</span>
        </div>
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Welcome back</h1>
        <p className="mb-6 text-sm text-slate-500">Log in to keep building.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-dark disabled:opacity-60"
          >
            {busy ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          or continue with
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <a
            href={oauthUrl('google')}
            className="rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Google
          </a>
          <a
            href={oauthUrl('github')}
            className="rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            GitHub
          </a>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          No account?{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
