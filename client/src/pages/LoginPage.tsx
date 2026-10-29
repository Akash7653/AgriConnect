import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, Loader2 } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Input } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

export function LoginPage() {
  const { signIn, isBackendConfigured } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    if (!isBackendConfigured) {
      setError(
        'Backend not configured. Set VITE_API_BASE_URL to enable authentication. This is a development-only message.'
      );
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
      showToast('Welcome back.', 'success');
      navigate(searchParams.get('redirect') || '/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back."
      subtitle="Sign in to your AgriConnect account to continue."
    >
      {!isBackendConfigured && (
        <div className="mb-6 rounded-xl bg-soil/10 border border-soil/20 p-4 text-sm text-soil-dark">
          <strong className="font-semibold">Development mode:</strong> No backend is configured.
          Authentication is disabled. Set <code className="font-mono">VITE_API_BASE_URL</code> to
          enable it.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          icon={<Mail className="h-4 w-4" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div>
          <Input
            label="Password"
            name="password"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Your password"
            icon={<Lock className="h-4 w-4" />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="mt-2 text-xs text-charcoal/60 hover:text-forest flex items-center gap-1.5"
          >
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {show ? 'Hide password' : 'Show password'}
          </button>
        </div>
        <div className="-mt-2 text-right">
          <Link to="/forgot-password" className="text-sm font-medium text-agri-green hover:underline">
            Forgot password?
          </Link>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 bg-agri-emerald text-forest font-semibold py-3.5 rounded-full hover:bg-ivory transition-colors disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-sm text-charcoal/60 text-center">
        New to AgriConnect?{' '}
        <Link to="/register" className="text-agri-green font-semibold hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
