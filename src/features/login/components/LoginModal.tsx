import Button from '@/shared/components/Button';
import Modal from '@/shared/components/Modal';
import { TextInput } from '@/shared/components/TextInput';
import { CloudOff } from 'lucide-react';
import { Dispatch, SetStateAction, useState } from 'react';

enum ModalView {
  Welcome,
  Login,
  Register,
}

interface LoginModalProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

export default function LoginModal({ isOpen, setIsOpen }: Readonly<LoginModalProps>) {
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
        <LoginForm onBack={() => setCurrentView(ModalView.Welcome)} />
      )}

      {currentView === ModalView.Register && (
        <RegisterForm onBack={() => setCurrentView(ModalView.Welcome)} />
      )}
    </Modal>
  );
}

function LoginForm({ onBack }: Readonly<{ onBack: () => void }>) {
  return (
    <div className="flex max-w-64 flex-col gap-3 text-white">
      <h2 className="text-2xl font-semibold">Welcome Back</h2>
      <TextInput type="email" placeholder="Email"></TextInput>
      <TextInput type="password" placeholder="Password"></TextInput>
      <Button variant="primary" className="rounded-lg">
        Sign In
      </Button>
      <Button variant="ghost" className="rounded-lg" onClick={onBack}>
        Back
      </Button>
    </div>
  );
}

function RegisterForm({ onBack }: Readonly<{ onBack: () => void }>) {
  return (
    <div className="flex max-w-64 flex-col gap-3 text-white">
      <h2 className="text-2xl font-semibold">Create Account</h2>
      <TextInput type="email" placeholder="Email"></TextInput>
      <TextInput type="password" placeholder="Password"></TextInput>
      <Button variant="primary" className="rounded-lg">
        Register
      </Button>
      <Button variant="ghost" className="rounded-lg" onClick={onBack}>
        Back
      </Button>
    </div>
  );
}
