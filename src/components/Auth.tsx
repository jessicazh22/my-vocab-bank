import { useState } from 'react';
import { useAuth } from '../lib/hooks';
import { supabase } from '../lib/supabase';

type View = 'waitlist' | 'waitlist-success' | 'login';

export default function Auth() {
  const [view, setView] = useState<View>('waitlist');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: dbError } = await supabase
      .from('beta_signups')
      .insert({ email });
    setLoading(false);
    if (dbError && dbError.code !== '23505') {
      setError('Something went wrong. Please try again.');
    } else {
      setView('waitlist-success');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);
    if (result) setError('Incorrect email or password.');
  };

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {view === 'waitlist' && (
          <>
            <div className="mb-8 text-center">
              <span className="inline-block text-[10px] uppercase tracking-widest text-zinc-600 border border-zinc-800 rounded-full px-3 py-1 mb-4">
                Beta
              </span>
              <h1 className="text-2xl font-light text-zinc-100">Vocabulary Bank</h1>
              <p className="text-sm text-zinc-500 mt-2">Enter your email to join the waitlist.</p>
            </div>

            <form onSubmit={handleWaitlist} className="space-y-3">
              <input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-800 text-zinc-100 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500 text-sm"
                required
                autoFocus
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg transition-colors text-sm disabled:opacity-50"
              >
                {loading ? 'Submitting…' : 'Join waitlist'}
              </button>
            </form>

            <p className="text-center mt-8">
              <button
                onClick={() => { setView('login'); setError(''); }}
                className="text-[11px] text-zinc-700 hover:text-zinc-500 transition-colors"
              >
                Sign in
              </button>
            </p>
          </>
        )}

        {view === 'waitlist-success' && (
          <div className="text-center">
            <span className="inline-block text-[10px] uppercase tracking-widest text-zinc-600 border border-zinc-800 rounded-full px-3 py-1 mb-6">
              Beta
            </span>
            <p className="text-xl font-light text-zinc-100 mb-2">You're on the list.</p>
            <p className="text-sm text-zinc-500">We'll let you know when you're in.</p>
          </div>
        )}

        {view === 'login' && (
          <>
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-light text-zinc-100">Sign in</h1>
            </div>

            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-800 text-zinc-100 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500 text-sm"
                required
                autoFocus
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-800 text-zinc-100 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500 text-sm"
                required
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg transition-colors text-sm disabled:opacity-50"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p className="text-center mt-6">
              <button
                onClick={() => { setView('waitlist'); setError(''); }}
                className="text-[11px] text-zinc-700 hover:text-zinc-500 transition-colors"
              >
                ← Back
              </button>
            </p>
          </>
        )}

      </div>
    </div>
  );
}
