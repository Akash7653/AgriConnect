import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Mail } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Input } from '@/components/ui';
import { AuthService } from '@/services/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await AuthService.requestPasswordReset(email);
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not request a reset link. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Reset your password." subtitle="We’ll email you a secure link if an account matches that address.">
      {submitted ? (
        <div role="status" className="rounded-xl border border-agri-green/20 bg-white p-4 text-sm leading-relaxed text-charcoal/75">
          If an account exists for that email, password reset instructions will be sent. Check your inbox and spam folder.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            placeholder="you@example.com"
            icon={<Mail className="h-4 w-4" />}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-agri-emerald py-3.5 font-semibold text-forest transition-colors hover:bg-ivory disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-charcoal/60">
        Remembered it? <Link to="/login" className="font-semibold text-agri-green hover:underline">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
