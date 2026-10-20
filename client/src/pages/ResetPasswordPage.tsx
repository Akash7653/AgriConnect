import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Input } from '@/components/ui';
import { AuthService } from '@/services/api';

export function ResetPasswordPage() {
  const { hash } = useLocation();
  const token = new URLSearchParams(hash.slice(1)).get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await AuthService.resetPassword(token, password);
      setComplete(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'This reset link is invalid or expired. Request a new one.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Choose a new password." subtitle="Use at least 12 characters for your AgriConnect account.">
      {!token ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          This reset link is incomplete. <Link to="/forgot-password" className="font-semibold underline">Request a new link</Link>.
        </div>
      ) : complete ? (
        <div role="status" className="rounded-xl border border-agri-green/20 bg-white p-4 text-sm text-charcoal/75">
          Your password has been updated. <Link to="/login" className="font-semibold text-agri-green underline">Sign in</Link>.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="New password"
            name="password"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            placeholder="At least 12 characters"
            icon={<Lock className="h-4 w-4" />}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Input
            label="Confirm new password"
            name="confirmPassword"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            placeholder="Enter the new password again"
            icon={<Lock className="h-4 w-4" />}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          <button
            type="button"
            onClick={() => setShow((visible) => !visible)}
            className="flex items-center gap-1.5 text-xs text-charcoal/60 hover:text-forest"
          >
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {show ? 'Hide passwords' : 'Show passwords'}
          </button>
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-agri-emerald py-3.5 font-semibold text-forest transition-colors hover:bg-ivory disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
