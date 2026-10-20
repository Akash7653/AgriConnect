import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, User, Loader2 } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Input } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

function registrationRoleLabel(role: 'buyer' | 'farmer' | 'business' | 'logistics'): string {
  switch (role) {
    case 'farmer':
      return 'Farmer / Seller';
    case 'business':
      return 'Business buyer';
    case 'logistics':
      return 'Delivery partner';
    case 'buyer':
      return 'Buyer';
  }
}

export function RegisterPage() {
  const { signUp, isBackendConfigured } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const validRoles = ['buyer', 'farmer', 'business', 'logistics'] as const;
  type RegistrationRole = (typeof validRoles)[number];
  const queryRole = searchParams.get('role');
  const initialRole: RegistrationRole = validRoles.find((role) => role === queryRole) ?? 'buyer';
  const [role, setRole] = useState<RegistrationRole>(initialRole);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [farm, setFarm] = useState({ farmName: '', village: '', district: '', state: '', pinCode: '' });
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
    if (password.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (role === 'farmer' && Object.values(farm).some((value) => !value.trim())) {
      setError('Please complete all farm details for your farmer access request.');
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
      await signUp({ fullName, email, password, phone, role, ...(role === 'farmer' ? { farm } : {}) });
      showToast(
        role === 'buyer'
          ? 'Your buyer account was created successfully.'
          : `Your buyer account is ready. Your ${registrationRoleLabel(role)} access request is pending admin approval.`,
        'success'
      );
      navigate('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed.';
      setError(message);
      showToast(message, 'error');
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
        <label className="block text-sm font-medium text-charcoal">
          Register as
          <select
            name="role"
            value={role}
            onChange={(event) => setRole(event.target.value as RegistrationRole)}
            className="mt-1 w-full rounded-lg border border-forest/15 bg-ivory px-3 py-2.5"
          >
            <option value="buyer">Buyer</option>
            <option value="farmer">Farmer / Seller</option>
            <option value="business">Business buyer</option>
            <option value="logistics">Delivery partner</option>
          </select>
        </label>
        <p className="rounded-lg bg-forest/5 p-3 text-sm text-charcoal/65">
          {role === 'buyer'
            ? 'Buyer access is available after registration.'
            : `You can use buyer features immediately. ${registrationRoleLabel(role)} features become available after an administrator reviews and approves your request.`}
        </p>
        {role === 'farmer' && (
          <fieldset className="grid gap-3 rounded-xl border border-forest/10 p-4 sm:grid-cols-2">
            <legend className="px-1 text-sm font-semibold text-forest">Farm details for review</legend>
            {Object.entries(farm).map(([field, value]) => (
              <Input
                key={field}
                label={field === 'pinCode' ? 'PIN code' : field.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())}
                name={`farm-${field}`}
                autoComplete="off"
                value={value}
                onChange={(event) => setFarm((current) => ({ ...current, [field]: event.target.value }))}
              />
            ))}
          </fieldset>
        )}

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
            placeholder="At least 12 characters"
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
