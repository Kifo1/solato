import Button from '@/shared/components/Button';
import Modal from '@/shared/components/Modal';
import { TextInput } from '@/shared/components/TextInput';
import { CloudOff } from 'lucide-react';
import { Dispatch, FormEvent, SetStateAction, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';

enum ModalView {
  Welcome,
  Login,
  Register,
}

interface LoginModalProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PASSWORD_REGEX = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[@#$%^&+=!.*_]).*$/;

export default function LoginModal({ isOpen, setIsOpen }: Readonly<LoginModalProps>) {
  const queryClient = useQueryClient();
  const [currentView, setCurrentView] = useState<ModalView>(ModalView.Welcome);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => setCurrentView(ModalView.Welcome), 200);
  };

  return (
    <Modal isOpen={isOpen} setIsOpen={handleClose}>
      {currentView === ModalView.Welcome && (
        <div className="flex max-w-64 flex-col items-center gap-3">
          <CloudOff size={50} className="rounded-full bg-blue-500/30 p-2 text-blue-200" />
          <h2 className="text-2xl font-semibold text-white">Sign in to stay synced</h2>
          <p className="text-center text-sm text-blue-200">
            Login to sync your progress, projects and analytics across all your devices seamlessly.
          </p>

          <Button
            className="w-full rounded-lg"
            variant="primary"
            onClick={() => setCurrentView(ModalView.Register)}
          >
            Create Account
          </Button>
          <Button
            className="w-full rounded-lg"
            variant="secondary"
            onClick={() => setCurrentView(ModalView.Login)}
          >
            Login
          </Button>

          <Button className="w-full rounded-lg font-light" variant="ghost" onClick={handleClose}>
            Continue as guest
          </Button>
        </div>
      )}

      {currentView === ModalView.Login && (
        <LoginForm
          onBack={() => setCurrentView(ModalView.Welcome)}
          onSuccess={() => {
            handleClose();
            queryClient.setQueryData(['loginStatus'], true);
          }}
        />
      )}

      {currentView === ModalView.Register && (
        <RegisterForm
          onBack={() => setCurrentView(ModalView.Welcome)}
          onSuccess={() => {
            handleClose();
            queryClient.setQueryData(['loginStatus'], true);
          }}
        />
      )}
    </Modal>
  );
}

function FormWrapper({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <div className="flex max-w-64 flex-col gap-3 text-white">
      <h2 className="text-2xl font-semibold">{title}</h2>
      {children}
    </div>
  );
}

interface FormProps {
  onBack: () => void;
  onSuccess: () => void;
}

function LoginForm({ onBack, onSuccess }: Readonly<FormProps>) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const { login, isLoggingIn, loginError } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    e.preventDefault();
    setLocalError(null);

    if (!email.trim()) {
      setLocalError('E-Mail cannot be empty');
      return;
    }
    if (!password.trim()) {
      setLocalError('Password cannot be empty');
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      setLocalError('E-Mail is not valid');
      return;
    }

    try {
      await login({ email, password });
      onSuccess();
    } catch {} //Errors handled via tanstack
  };

  const activeError = localError || loginError;

  return (
    <form onSubmit={handleSubmit}>
      <FormWrapper title="Login">
        {activeError && (
          <div className="rounded border border-red-500 bg-red-500/20 p-2 text-xs text-red-300">
            {activeError}
          </div>
        )}

        <TextInput
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoggingIn}
        />
        <TextInput
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoggingIn}
        />

        <Button type="submit" variant="primary" className="rounded-lg" disabled={isLoggingIn}>
          {isLoggingIn ? 'Signing In...' : 'Sign In'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="rounded-lg"
          onClick={onBack}
          disabled={isLoggingIn}
        >
          Back
        </Button>
      </FormWrapper>
    </form>
  );
}

function RegisterForm({ onBack, onSuccess }: Readonly<FormProps>) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const { register, isRegistering, registerError } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email.trim()) {
      setLocalError('E-Mail cannot be empty');
      return;
    }
    if (!password.trim()) {
      setLocalError('Password cannot be empty');
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      setLocalError('E-Mail is not valid');
      return;
    }
    if (password.length < 8 || password.length > 64) {
      setLocalError('Password must have between 8 and 64 characters');
      return;
    }
    if (!PASSWORD_REGEX.test(password)) {
      setLocalError(
        'Password must contain uppercase letters, lowercase letters, numbers and special characters',
      );
      return;
    }

    try {
      await register({ email, password });
      onSuccess();
    } catch {} //Error handling via tanstack
  };

  const activeError = localError || registerError;

  return (
    <form onSubmit={handleSubmit}>
      <FormWrapper title="Create Account">
        {activeError && (
          <div className="rounded border border-red-500 bg-red-500/20 p-2 text-xs text-red-300">
            {activeError}
          </div>
        )}

        <TextInput
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isRegistering}
        />
        <TextInput
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isRegistering}
        />

        <Button type="submit" variant="primary" className="rounded-lg" disabled={isRegistering}>
          {isRegistering ? 'Registering...' : 'Register'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="rounded-lg"
          onClick={onBack}
          disabled={isRegistering}
        >
          Back
        </Button>
      </FormWrapper>
    </form>
  );
}
