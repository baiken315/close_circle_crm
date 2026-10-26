import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { setToken, setStoredUser } from '../../lib/auth';
import { useUIStore } from '../../stores/ui';
import type { User, UserPreferences } from '../../types';

interface LoginResponse {
  token: string;
  user: User;
  preferences: UserPreferences | null;
}

export function LoginPage() {
  const navigate = useNavigate();
  const applyPreferences = useUIStore((s) => s.applyPreferences);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetMode, setResetMode] = useState<'login' | 'instructions' | 'form'>('login');
  const [resetToken, setResetToken] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const result = await api.post<LoginResponse>('/api/auth/login', { email, password }, true);
        setToken(result.token);
        setStoredUser(result.user);
        if (result.preferences) {
          applyPreferences(result.preferences);
        }
        navigate('/contacts', { replace: true });
      } else {
        const result = await api.post<LoginResponse>('/api/auth/register', { email, password, name }, true);
        setToken(result.token);
        setStoredUser(result.user);
        navigate('/contacts', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError('');
    setResettingPassword(true);
    try {
      await api.post('/api/auth/forgot-password', {
        email,
        token: resetToken,
        new_password: resetNewPassword,
      }, true);
      setResetMode('login');
      setError('Password reset successful! You can now sign in.');
      setResetToken('');
      setResetNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/20 mb-4">
            <svg className="w-9 h-9 text-accent-300" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Close Circle</h1>
          <p className="text-slate-400 text-sm mt-1">Personal CRM for people who matter</p>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-2xl">
          <div className="flex rounded-lg bg-slate-700/50 p-1 mb-6">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                mode === 'login' ? 'bg-slate-600 text-slate-50 shadow' : 'text-slate-400 hover:text-slate-50'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                mode === 'register' ? 'bg-slate-600 text-slate-50 shadow' : 'text-slate-400 hover:text-slate-50'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-colors"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Minimum 8 characters' : '••••••••'}
                required
                minLength={mode === 'register' ? 8 : 1}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-colors"
              />
            </div>

            {resetMode === 'instructions' ? (
              <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 text-sm space-y-3">
                <p className="text-slate-100 font-medium">Reset your password</p>
                <p className="text-slate-300">This requires SSH access to your server:</p>
                <ol className="text-slate-300 space-y-1 list-decimal list-inside">
                  <li>SSH!nto your server</li>
                  <li>Generate a token: <code className="bg-slate-800 px-1.5 py-0.5 rounded text-xs">echo &lt;secret&gt; &gt; ~/close-circle-v2/data/.password-reset-token</code></li>
                  <li>Enter the token below along with your new password</li>
                </ol>
                <button
                  onClick={() => { setResetMode('login'); }}
                  className="text-accent hover:text-accent-400 text-sm font-medium"
                >
                  Back to sign in
                </button>
              </div>
            ) : resetMode === 'form' ? (
                <div className="space-y-3">
                <input
                  type="text"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Reset token (from server)"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-colors"
                />
                <input
                  type="password"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="New password (min 8 characters)"
                  minLength={8}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-colors"
                />
                <button
                  onClick={() => void handleResetPassword()}
                  disabled={resettingPassword}
                  className="w-full py-2.5 px-4 bg-accent hover:bg-accent-400 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resettingPassword ? 'Resetting...' : 'Reset Password'}
                </button>
                <button
                  onClick={() => { setResetMode('login'); }}
                  className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Back to sign in
                </button>
              </div>
            ) : error && (
              <div className="text-rose-400 text-sm bg-rose-900/20 border border-rose-800/50 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {true && (
              <div className="text-center">
                <button
                  onClick={() => setResetMode('instructions')}
                  className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Forgot your password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-accent hover:bg-accent-400 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading
                ? 'Please wait...'
                : mode === 'login'
                ? 'Sign In'
                : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
