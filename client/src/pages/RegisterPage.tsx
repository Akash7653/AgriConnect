import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, User, Loader2, Sprout, Store, Truck } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Input } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types';
import { classNames } from '@/utils';

const roles: { value: UserRole; label: string; icon: typeof Sprout; desc: string }[] = [
  { value: 'farmer', label: 'Farmer / FPO', icon: Sprout, desc: 'List and sell harvests' },
  { value: 'buyer', label: 'Buyer', icon: Store, desc: 'Procure fresh produce' },
  { value: 'logistics', label: 'Logistics Partner', icon: Truck, desc: 'Move produce' },
];

export function RegisterPage() {
  const { signUp, isBackendConfigured } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialRole = (params.get('role') as UserRole) ?? 'farmer';
  const validInitial = roles.some((r) => r.value === initialRole) ? initialRole : 'farmer';

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState<UserRole>(validInitial);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!fullName || !email || !phone || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid phone number with at least 10 digits.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!isBackendConfigured) {
      setError(
        'Backend not configured. Set VITE_API_BASE_URL to enable registration. This is a development-only message.'
      );
      return;
    }
    setLoading(true);
    try {
      await signUp({ fullName, email, password, phone, role });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Join the network."
      subtitle="Create your AgriConnect account in a few steps."
    >
      {!isBackendConfigured && (
        <div className="mb-6 rounded-xl bg-soil/10 border border-soil/20 p-4 text-sm text-soil-dark">
          <strong className="font-semibold">Development mode:</strong> No backend is configured.
          Registration is disabled. Set <code className="font-mono">VITE_API_BASE_URL</code> to
          enable it.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-forest mb-2">I am a…</label>
          <div className="grid grid-cols-3 gap-2">
            {roles.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                className={classNames(
                  'rounded-xl border p-3 text-center transition-all',
                  role === r.value
                    ? 'border-agri-emerald bg-agri-emerald/10'
                    : 'border-forest/15 hover:border-forest/30'
                )}
              >
                <r.icon
                  className={classNames(
                    'h-5 w-5 mx-auto mb-1.5',
                    role === r.value ? 'text-agri-emerald' : 'text-charcoal/50'
                  )}
                  strokeWidth={1.5}
                />
                <p className="text-xs font-medium text-forest leading-tight">{r.label}</p>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-charcoal/50">
            {roles.find((r) => r.value === role)?.desc}. Admin accounts cannot be self-assigned.
          </p>
        </div>

        <Input
          label="Full name"
          name="fullName"
          autoComplete="name"
          placeholder="Your name"
          icon={<User className="h-4 w-4" />}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
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
        <Input
          label="Phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="Your phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <div>
          <Input
            label="Password"
            name="password"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="At least 8 characters"
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
        <Input
          label="Confirm password"
          name="confirm"
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Re-enter password"
          icon={<Lock className="h-4 w-4" />}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

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
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-sm text-charcoal/60 text-center">
        Already have an account?{' '}
        <Link to="/login" className="text-agri-green font-semibold hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
