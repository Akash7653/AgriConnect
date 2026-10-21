import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Mail } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Input } from '@/components/ui';
import { AuthService } from '@/services/api';

interface VerificationLocationState {
  email?: string;
  verification?: { emailSent?: boolean };
}

export function VerifyAccountPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as VerificationLocationState | null;
  const token = new URLSearchParams(location.hash.slice(1)).get('token') || '';
  const emailTokenAttempted = useRef(false);
  const [email, setEmail] = useState(state?.email || '');
  const [emailVerified, setEmailVerified] = useState(
    new URLSearchParams(location.search).get('status') === 'success'
  );
  const [emailSent, setEmailSent] = useState(state?.verification?.emailSent ?? false);
  const [loading, setLoading] = useState(Boolean(token));
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(state?.verification?.emailSent ? 60 : 0);
  const [notice, setNotice] = useState(
    state?.verification?.emailSent
      ? 'We sent a verification link. Check your inbox and spam folder.'
      : state?.email
        ? 'Your account was created, but the verification email could not be sent. You can retry below.'
        : ''
  );
  const [error, setError] = useState('');

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((remaining) => Math.max(0, remaining - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (!token || emailTokenAttempted.current) return;
    emailTokenAttempted.current = true;
    setLoading(true);
    setError('');
    AuthService.confirmEmailVerification(token)
      .then((result) => {
        setEmail(result.email);
        setEmailVerified(true);
        setNotice('Your email is verified. You can now sign in.');
        navigate('/verify-account?status=success', { replace: true, state: { email: result.email } });
      })
      .catch((verificationError: unknown) => {
        setError(verificationError instanceof Error
          ? verificationError.message
          : 'This email verification link is invalid or expired. Request a new one.');
      })
      .finally(() => setLoading(false));
  }, [navigate, token]);

  async function resendEmail() {
    setError('');
    setNotice('');
    setResending(true);
    try {
      const result = await AuthService.resendEmailVerification(email);
      setEmailSent(true);
      setResendCooldown(60);
      setNotice(result.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not process the request. Please try again shortly.');
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthLayout
      title={emailVerified ? 'Email verified.' : 'Verify your email.'}
      subtitle="Verify your email address to activate sign-in to AgriConnect."
    >
      <div className="space-y-5">
        {loading ? (
          <div role="status" className="flex items-center justify-center gap-2 rounded-xl border border-forest/10 bg-white p-5 text-sm text-charcoal/70">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking your verification link…
          </div>
        ) : null}

        {emailVerified ? (
          <div role="status" className="space-y-4 rounded-xl border border-agri-green/20 bg-white p-4 text-sm leading-relaxed text-charcoal/75">
            <p>Your email address is verified and your account is ready.</p>
            <Link to="/login" className="inline-flex font-semibold text-agri-green underline">Continue to sign in</Link>
          </div>
        ) : (
          <div className="rounded-xl border border-forest/10 bg-white p-4">
            <div className="flex items-center gap-2 font-semibold text-forest">
              <Mail className="h-4 w-4" /> Email verification
            </div>
            <p className="mt-2 text-sm text-charcoal/65">
              We’ll send a secure, one-time link that expires after 30 minutes. Check your spam folder if it doesn’t arrive.
            </p>
            <div className="mt-3">
              <Input
                label="Account email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => void resendEmail()}
              disabled={loading || resending || resendCooldown > 0 || !email}
              className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-agri-green underline disabled:opacity-50"
            >
              {resending && <Loader2 className="h-4 w-4 animate-spin" />}
              {resending
                ? 'Sending…'
                : resendCooldown > 0
                  ? `Resend available in ${resendCooldown}s`
                  : emailSent
                    ? 'Resend verification email'
                    : 'Send verification email'}
            </button>
          </div>
        )}

        {notice && <p role="status" className="rounded-xl border border-agri-green/20 bg-agri-green/5 p-3 text-sm text-forest">{notice}</p>}
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        {!emailVerified && (
          <p className="text-center text-sm text-charcoal/60">
            Already verified? <Link to="/login" className="font-semibold text-agri-green hover:underline">Sign in</Link>
          </p>
        )}
      </div>
    </AuthLayout>
  );
}
