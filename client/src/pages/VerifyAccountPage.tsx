import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Mail, Smartphone } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Input } from '@/components/ui';
import { AuthService } from '@/services/api';

interface VerificationLocationState {
  email?: string;
  verification?: { emailSent?: boolean; phoneCodeSent?: boolean };
}

export function VerifyAccountPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as VerificationLocationState | null;
  const token = new URLSearchParams(location.hash.slice(1)).get('token') || '';
  const emailTokenAttempted = useRef(false);
  const [email, setEmail] = useState(state?.email || '');
  const [code, setCode] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [emailSent, setEmailSent] = useState(state?.verification?.emailSent ?? false);
  const [phoneCodeSent, setPhoneCodeSent] = useState(state?.verification?.phoneCodeSent ?? false);
  const [loadingAction, setLoadingAction] = useState<'email' | 'phone' | 'verify' | ''>('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || emailTokenAttempted.current) return;
    emailTokenAttempted.current = true;
    setLoadingAction('email');
    AuthService.confirmEmailVerification(token)
      .then((result) => {
        setEmail(result.email);
        setEmailVerified(true);
        setPhoneVerified(result.phoneVerified);
        setNotice('Email verified. Enter the SMS code to finish verifying your account.');
        navigate('/verify-account', { replace: true, state: { email: result.email } });
      })
      .catch((verificationError: unknown) => {
        setError(verificationError instanceof Error ? verificationError.message : 'This email link is invalid or expired.');
      })
      .finally(() => setLoadingAction(''));
  }, [navigate, token]);

  async function resendEmail() {
    setError('');
    setNotice('');
    setLoadingAction('email');
    try {
      const result = await AuthService.resendEmailVerification(email);
      setEmailSent(true);
      setNotice(result.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not resend the email link.');
    } finally {
      setLoadingAction('');
    }
  }

  async function resendPhoneCode() {
    setError('');
    setNotice('');
    setLoadingAction('phone');
    try {
      const result = await AuthService.resendPhoneVerification(email);
      setPhoneCodeSent(true);
      setNotice(result.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not resend the SMS code.');
    } finally {
      setLoadingAction('');
    }
  }

  async function verifyPhone(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    setLoadingAction('verify');
    try {
      const result = await AuthService.confirmPhoneVerification(email, code);
      setPhoneVerified(result.phoneVerified);
      setEmailVerified(result.emailVerified);
      setNotice(result.emailVerified
        ? 'Email and phone verified. You can now sign in.'
        : 'Phone verified. Use the link in your email to complete verification.');
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : 'Could not verify the SMS code.');
    } finally {
      setLoadingAction('');
    }
  }

  const complete = emailVerified && phoneVerified;

  return (
    <AuthLayout
      title={complete ? 'Account verified.' : 'Verify your account.'}
      subtitle="Verify both contact methods to keep your account secure and sign in."
    >
      {complete ? (
        <div role="status" className="space-y-4 rounded-xl border border-agri-green/20 bg-white p-4 text-sm leading-relaxed text-charcoal/75">
          <p>Your email address and phone number are verified.</p>
          <Link to="/login" className="inline-flex font-semibold text-agri-green underline">Continue to sign in</Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border border-forest/10 bg-white p-4">
            <div className="flex items-center gap-2 font-semibold text-forest">
              <Mail className="h-4 w-4" /> Email address
              {emailVerified && <span className="ml-auto text-xs font-medium text-agri-green">Verified</span>}
            </div>
            <p className="mt-2 text-sm text-charcoal/65">
              {emailVerified ? 'Your email address is verified.' : 'Open the verification link sent to your email.'}
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
            {!emailVerified && (
              <button
                type="button"
                onClick={() => void resendEmail()}
                disabled={loadingAction !== '' || !email}
                className="mt-3 text-sm font-semibold text-agri-green underline disabled:opacity-50"
              >
                {loadingAction === 'email' ? 'Sending…' : emailSent ? 'Resend verification email' : 'Send verification email'}
              </button>
            )}
          </div>

          <div className="rounded-xl border border-forest/10 bg-white p-4">
            <div className="flex items-center gap-2 font-semibold text-forest">
              <Smartphone className="h-4 w-4" /> Phone number
              {phoneVerified && <span className="ml-auto text-xs font-medium text-agri-green">Verified</span>}
            </div>
            <p className="mt-2 text-sm text-charcoal/65">
              Enter the one-time code sent by SMS to the phone number you registered.
            </p>
            {!phoneVerified && (
              <form onSubmit={(event) => void verifyPhone(event)} className="mt-4 space-y-4">
                <Input
                  label="SMS verification code"
                  name="verificationCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  minLength={4}
                  maxLength={8}
                  pattern="[0-9]{4,8}"
                  placeholder="Enter the code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
                />
                <button
                  type="submit"
                  disabled={loadingAction !== '' || !email}
                  className="w-full inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-agri-emerald py-3 font-semibold text-forest transition-colors hover:bg-ivory disabled:opacity-50"
                >
                  {loadingAction === 'verify' && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loadingAction === 'verify' ? 'Verifying…' : 'Verify phone'}
                </button>
              </form>
            )}
            {!phoneVerified && (
              <button
                type="button"
                onClick={() => void resendPhoneCode()}
                disabled={loadingAction !== '' || !email}
                className="mt-3 text-sm font-semibold text-agri-green underline disabled:opacity-50"
              >
                {loadingAction === 'phone' ? 'Sending…' : phoneCodeSent ? 'Resend SMS code' : 'Send SMS code'}
              </button>
            )}
          </div>
          {notice && <p role="status" className="rounded-xl border border-agri-green/20 bg-agri-green/5 p-3 text-sm text-forest">{notice}</p>}
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p>}
          <p className="text-center text-sm text-charcoal/60">
            Already verified? <Link to="/login" className="font-semibold text-agri-green hover:underline">Sign in</Link>
          </p>
        </div>
      )}
    </AuthLayout>
  );
}
