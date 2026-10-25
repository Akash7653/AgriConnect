import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Mail } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Input } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { AuthService } from '@/services/api';

interface VerificationLocationState {
  email?: string;
  otpSent?: boolean;
  redirectTo?: string;
}

function safeDestination(path?: string): string {
  return path && path.startsWith('/') && !path.startsWith('//') ? path : '/dashboard';
}

export function VerifyAccountPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyOtp } = useAuth();
  const state = location.state as VerificationLocationState | null;
  const token = new URLSearchParams(location.hash.slice(1)).get('token') || '';
  const emailTokenAttempted = useRef(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [email, setEmail] = useState(state?.email || '');
  const [otp, setOtp] = useState('');
  const [emailVerified, setEmailVerified] = useState(
    new URLSearchParams(location.search).get('status') === 'success'
  );
  const [loading, setLoading] = useState(Boolean(token));
  const [resending, setResending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(state?.otpSent ? 60 : 0);
  const [hasSentOtp, setHasSentOtp] = useState(Boolean(state?.otpSent));
  const [notice, setNotice] = useState('');
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

  useEffect(() => {
    if (token || emailVerified || !email || state?.otpSent) return;
    let active = true;
    setResending(true);
    AuthService.resendOtp(email)
      .then((result) => {
        if (!active) return;
        setHasSentOtp(true);
        setResendCooldown(60);
        setNotice(result.message);
      })
      .catch((sendError: unknown) => {
        if (active) setError(sendError instanceof Error ? sendError.message : 'Could not send your verification code. Retry below.');
      })
      .finally(() => {
        if (active) setResending(false);
      });
    return () => { active = false; };
  }, [email, emailVerified, state?.otpSent, token]);

  async function resendCode() {
    setError('');
    setNotice('');
    setResending(true);
    try {
      const result = await AuthService.resendOtp(email.trim().toLowerCase());
      setHasSentOtp(true);
      setResendCooldown(60);
      setOtp('');
      setNotice(result.message);
      inputRefs.current[0]?.focus();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not send your verification code. Retry below.');
    } finally {
      setResending(false);
    }
  }

  function updateOtp(index: number, value: string) {
    const digits = value.replace(/\D/g, '');
    const next = otp.split('');
    if (digits.length > 1) {
      digits.slice(0, 6 - index).split('').forEach((digit, offset) => {
        next[index + offset] = digit;
      });
    } else {
      next[index] = digits;
    }
    setOtp(next.join('').slice(0, 6));
    if (digits && index < 5) inputRefs.current[Math.min(index + digits.length, 5)]?.focus();
  }

  function pasteOtp(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    setOtp(pasted);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  }

  function handleOtpKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus();
    if (event.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
    if (event.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus();
  }

  async function submitOtp(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Enter your account email to verify your signup.');
      return;
    }
    if (otp.length !== 6) {
      setError('Enter all six digits of the verification code.');
      return;
    }
    setVerifying(true);
    try {
      await verifyOtp(email.trim().toLowerCase(), otp);
      navigate(safeDestination(state?.redirectTo), { replace: true });
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : 'Verification failed. Check the code and try again.');
      setOtp('');
      inputRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  }

  function changeEmail() {
    setOtp('');
    setError('');
    setNotice('');
    navigate('/register', { replace: true, state: null });
  }

  return (
    <AuthLayout
      title={emailVerified ? 'Email verified.' : 'Verify your email.'}
      subtitle="Enter the one-time code sent to your email to finish creating your account."
    >
      <div className="space-y-5">
        {loading ? (
          <div role="status" className="flex items-center justify-center gap-2 rounded-xl border border-forest/10 bg-white p-5 text-sm text-charcoal/70">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking your verification link…
          </div>
        ) : null}

        {emailVerified ? (
          <div role="status" className="space-y-4 rounded-xl border border-agri-green/20 bg-white p-4 text-sm leading-relaxed text-charcoal/75">
            <p>Your email address is verified. Sign in to continue.</p>
            <Link to="/login" className="inline-flex font-semibold text-agri-green underline">Continue to sign in</Link>
          </div>
        ) : (
          <div className="rounded-xl border border-forest/10 bg-white p-4">
            <div className="flex items-center gap-2 font-semibold text-forest">
              <Mail className="h-4 w-4" /> Email verification code
            </div>
            <p className="mt-2 text-sm text-charcoal/65">
              Enter the six-digit code. It expires in 10 minutes. Check your spam folder if it doesn’t arrive.
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
            <form onSubmit={(event) => void submitOtp(event)} className="mt-4 space-y-3">
              <div className="flex justify-between gap-2" aria-label="Six-digit verification code">
                {Array.from({ length: 6 }, (_, index) => (
                  <input
                    key={index}
                    ref={(element) => { inputRefs.current[index] = element; }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    pattern="[0-9]*"
                    maxLength={1}
                    aria-label={`Verification digit ${index + 1}`}
                    value={otp[index] || ''}
                    onChange={(event) => updateOtp(index, event.target.value)}
                    onPaste={pasteOtp}
                    onKeyDown={(event) => handleOtpKeyDown(index, event)}
                    disabled={verifying}
                    className="h-12 min-w-0 w-full max-w-12 rounded-xl border border-forest/20 bg-ivory text-center text-xl font-bold text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-agri-green disabled:opacity-60"
                  />
                ))}
              </div>
              <button
                type="submit"
                disabled={verifying || otp.length !== 6 || !email}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-agri-emerald px-4 py-3 font-semibold text-forest disabled:opacity-50"
              >
                {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
                {verifying ? 'Verifying…' : 'Verify and continue'}
              </button>
            </form>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => void resendCode()}
                disabled={loading || resending || resendCooldown > 0 || !email}
                className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-agri-green underline disabled:opacity-50"
              >
                {resending && <Loader2 className="h-4 w-4 animate-spin" />}
                {resending
                  ? 'Sending…'
                  : resendCooldown > 0
                    ? `Resend available in ${resendCooldown}s`
                    : hasSentOtp
                      ? 'Resend code'
                      : 'Send verification code'}
              </button>
              <button type="button" onClick={changeEmail} className="text-sm font-semibold text-charcoal/65 underline">
                Change email
              </button>
            </div>
            {!hasSentOtp && error && (
              <button
                type="button"
                onClick={() => void resendCode()}
                disabled={resending || !email}
                className="mt-2 text-sm font-semibold text-agri-green underline disabled:opacity-50"
              >
                Retry sending code
              </button>
            )}
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
