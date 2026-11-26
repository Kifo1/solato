import Button from '@/shared/components/Button';
import Modal from '@/shared/components/Modal';
import { SolatoLogo } from '@/shared/components/SolatoLogo';
import { TextInput } from '@/shared/components/TextInput';
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, MailCheck } from 'lucide-react';
import {
  Dispatch,
  FormEvent,
  SetStateAction,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { useAuth } from '../hooks/useAuth';

enum ModalView {
  Welcome,
  Login,
  Register,
  Verify,
}

interface LoginModalProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PASSWORD_REGEX = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9\s]).*$/;

export default function LoginModal({ isOpen, setIsOpen }: Readonly<LoginModalProps>) {
  const [currentView, setCurrentView] = useState<ModalView>(ModalView.Welcome);
  const [verificationEmail, setVerificationEmail] = useState<string>('');
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearResetTimeout = useCallback(() => {
    if (closeTimeoutRef.current !== null) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      clearResetTimeout();
    }
  }, [isOpen, clearResetTimeout]);

  useEffect(() => {
    return () => {
      clearResetTimeout();
    };
  }, [clearResetTimeout]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    clearResetTimeout();
    closeTimeoutRef.current = setTimeout(() => {
      setCurrentView(ModalView.Welcome);
      setVerificationEmail('');
      closeTimeoutRef.current = null;
    }, 200);
  }, [setIsOpen, clearResetTimeout]);

  return (
    <Modal isOpen={isOpen} setIsOpen={handleClose} scale="sm">
      {currentView === ModalView.Welcome && (
        <div className="flex flex-col items-center pt-1 text-center">
          <SolatoLogo size={44} />

          <h2 className="mt-4 text-xl font-semibold tracking-tight text-fg">
            Sync with Solato Cloud
          </h2>
          <p className="mt-2 max-w-[300px] text-sm leading-relaxed text-fg-secondary">
            Keep your focus sessions, projects, and analytics seamlessly backed up across all your
            devices.
          </p>

          <div className="mt-6 flex w-full flex-col gap-2.5">
            <Button
              variant="primary"
              scale="lg"
              className="w-full"
              onClick={() => setCurrentView(ModalView.Register)}
            >
              Create account
            </Button>
            <Button
              variant="secondary"
              scale="lg"
              className="w-full"
              onClick={() => setCurrentView(ModalView.Login)}
            >
              Sign in
            </Button>
            <Button
              variant="ghost"
              scale="md"
              className="mt-0.5 w-full text-fg-muted hover:text-fg-secondary"
              onClick={handleClose}
            >
              Continue as guest
            </Button>
          </div>
        </div>
      )}

      {currentView === ModalView.Login && (
        <LoginForm
          onBack={() => setCurrentView(ModalView.Welcome)}
          onSwitchToRegister={() => setCurrentView(ModalView.Register)}
          onSuccess={handleClose}
        />
      )}

      {currentView === ModalView.Register && (
        <RegisterForm
          onBack={() => setCurrentView(ModalView.Welcome)}
          onSwitchToLogin={() => setCurrentView(ModalView.Login)}
          onSuccess={(email) => {
            setVerificationEmail(email);
            setCurrentView(ModalView.Verify);
          }}
        />
      )}

      {currentView === ModalView.Verify && (
        <VerifyForm
          email={verificationEmail}
          onBack={() => setCurrentView(ModalView.Register)}
          onSuccess={handleClose}
        />
      )}
    </Modal>
  );
}

function ErrorBanner({ message }: Readonly<{ message: string }>) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-rose-300"
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
      <span>{message}</span>
    </div>
  );
}

function AuthModeTabs({
  active,
  onSelectLogin,
  onSelectRegister,
  disabled,
}: Readonly<{
  active: 'login' | 'register';
  onSelectLogin: () => void;
  onSelectRegister: () => void;
  disabled?: boolean;
}>) {
  return (
    <div className="surface-well grid grid-cols-2 gap-1 rounded-xl p-1">
      <button
        type="button"
        disabled={disabled}
        onClick={onSelectLogin}
        className={`h-8 cursor-pointer rounded-lg text-xs font-medium transition-all duration-150 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 ${
          active === 'login'
            ? 'bg-elevated text-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
            : 'text-fg-muted hover:text-fg-secondary'
        }`}
      >
        Sign in
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onSelectRegister}
        className={`h-8 cursor-pointer rounded-lg text-xs font-medium transition-all duration-150 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 ${
          active === 'register'
            ? 'bg-elevated text-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
            : 'text-fg-muted hover:text-fg-secondary'
        }`}
      >
        Create account
      </button>
    </div>
  );
}

interface LoginFormProps {
  onBack: () => void;
  onSwitchToRegister: () => void;
  onSuccess: () => void;
}

interface RegisterFormProps {
  onBack: () => void;
  onSwitchToLogin: () => void;
  onSuccess: (email: string) => void;
}

interface VerifyFormProps {
  email: string;
  onBack: () => void;
  onSuccess: () => void;
}

function LoginForm({ onBack, onSwitchToRegister, onSuccess }: Readonly<LoginFormProps>) {
  const emailId = useId();
  const passwordId = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const { login, isLoggingIn, loginError } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setLocalError('Email cannot be empty.');
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setLocalError('Password cannot be empty.');
      return;
    }

    try {
      await login({ email: trimmedEmail, password });
      onSuccess();
    } catch {
      // Error surfaced via loginError from useAuth
    }
  };

  const activeError = localError || loginError;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col items-center text-center">
        <SolatoLogo size={44} />
        <h2 className="mt-3.5 text-lg font-semibold tracking-tight text-fg">
          Welcome back
        </h2>
        <p className="mt-1 text-xs text-fg-secondary">Sign in to resume syncing your workspace.</p>
      </div>

      <AuthModeTabs
        active="login"
        onSelectLogin={() => {}}
        onSelectRegister={onSwitchToRegister}
        disabled={isLoggingIn}
      />

      {activeError && <ErrorBanner message={activeError} />}

      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={emailId} className="text-xs font-medium text-fg-secondary">
            Email
          </label>
          <TextInput
            id={emailId}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (localError) setLocalError(null);
            }}
            disabled={isLoggingIn}
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={passwordId} className="text-xs font-medium text-fg-secondary">
            Password
          </label>
          <div className="relative">
            <TextInput
              id={passwordId}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (localError) setLocalError(null);
              }}
              disabled={isLoggingIn}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              disabled={isLoggingIn}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute top-1/2 right-2.5 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-tint hover:text-fg focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none disabled:pointer-events-none"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <Button type="submit" variant="primary" scale="lg" className="w-full" disabled={isLoggingIn}>
          {isLoggingIn ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </Button>

        <Button
          type="button"
          variant="ghost"
          scale="sm"
          className="w-full text-fg-muted hover:text-fg-secondary"
          onClick={onBack}
          disabled={isLoggingIn}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
      </div>
    </form>
  );
}

function RegisterForm({ onBack, onSwitchToLogin, onSuccess }: Readonly<RegisterFormProps>) {
  const emailId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const { register, isRegistering, registerError } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setLocalError('Email cannot be empty.');
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setLocalError('Password cannot be empty.');
      return;
    }
    if (password.length < 8 || password.length > 64) {
      setLocalError('Password must be between 8 and 64 characters.');
      return;
    }
    if (!PASSWORD_REGEX.test(password)) {
      setLocalError(
        'Password must include uppercase, lowercase, a number, and a symbol.',
      );
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    try {
      await register({ email: trimmedEmail, password });
      onSuccess(trimmedEmail);
    } catch {
      // Error surfaced via registerError from useAuth
    }
  };

  const activeError = localError || registerError;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col items-center text-center">
        <SolatoLogo size={44} />
        <h2 className="mt-3.5 text-lg font-semibold tracking-tight text-fg">
          Create your account
        </h2>
        <p className="mt-1 text-xs text-fg-secondary">
          Start syncing your sessions and projects with Solato Cloud.
        </p>
      </div>

      <AuthModeTabs
        active="register"
        onSelectLogin={onSwitchToLogin}
        onSelectRegister={() => {}}
        disabled={isRegistering}
      />

      {activeError && <ErrorBanner message={activeError} />}

      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={emailId} className="text-xs font-medium text-fg-secondary">
            Email
          </label>
          <TextInput
            id={emailId}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (localError) setLocalError(null);
            }}
            disabled={isRegistering}
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={passwordId} className="text-xs font-medium text-fg-secondary">
            Password
          </label>
          <div className="relative">
            <TextInput
              id={passwordId}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (localError) setLocalError(null);
              }}
              disabled={isRegistering}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              disabled={isRegistering}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute top-1/2 right-2.5 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-tint hover:text-fg focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none disabled:pointer-events-none"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[11px] leading-snug text-fg-muted">
            8–64 chars with uppercase, lowercase, a number, and a symbol.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={confirmPasswordId} className="text-xs font-medium text-fg-secondary">
            Confirm password
          </label>
          <div className="relative">
            <TextInput
              id={confirmPasswordId}
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (localError) setLocalError(null);
              }}
              disabled={isRegistering}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              disabled={isRegistering}
              aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
              className="absolute top-1/2 right-2.5 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-tint hover:text-fg focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none disabled:pointer-events-none"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <Button
          type="submit"
          variant="primary"
          scale="lg"
          className="w-full"
          disabled={isRegistering}
        >
          {isRegistering ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            'Create account'
          )}
        </Button>

        <Button
          type="button"
          variant="ghost"
          scale="sm"
          className="w-full text-fg-muted hover:text-fg-secondary"
          onClick={onBack}
          disabled={isRegistering}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
      </div>
    </form>
  );
}

function VerifyForm({ email, onBack, onSuccess }: Readonly<VerifyFormProps>) {
  const codeId = useId();
  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const { verify, isVerifying, verifyError } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (code.length !== 6) {
      setLocalError('Verification code must be 6 digits.');
      return;
    }

    try {
      await verify({ email, code });
      onSuccess();
    } catch {
      // Error surfaced via verifyError from useAuth
    }
  };

  const activeError = localError || verifyError;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-500/25 bg-amber-500/10 text-amber-400">
          <MailCheck className="h-5 w-5" />
        </div>
        <h2 className="mt-3.5 text-lg font-semibold tracking-tight text-fg">
          Verify your email
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-fg-secondary">
          Enter the 6-digit code sent to{' '}
          <span className="font-medium break-all text-fg">{email}</span>
        </p>
      </div>

      {activeError && <ErrorBanner message={activeError} />}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={codeId} className="text-xs font-medium text-fg-secondary">
          Verification code
        </label>
        <TextInput
          id={codeId}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => {
            const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
            setCode(digitsOnly);
            if (localError) setLocalError(null);
          }}
          disabled={isVerifying}
          autoFocus
          className="h-13 text-center font-mono text-2xl tracking-[0.4em] tabular-nums placeholder:text-fg-muted/50"
        />
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <Button type="submit" variant="primary" scale="lg" className="w-full" disabled={isVerifying}>
          {isVerifying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            'Verify & sign in'
          )}
        </Button>

        <Button
          type="button"
          variant="ghost"
          scale="sm"
          className="w-full text-fg-muted hover:text-fg-secondary"
          onClick={onBack}
          disabled={isVerifying}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
      </div>
    </form>
  );
}
