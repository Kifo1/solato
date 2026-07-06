import Button from '@/shared/components/Button';
import { LogIn } from 'lucide-react';
import { useState } from 'react';
import LoginModal from './LoginModal';

export default function LoginButton() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button className="rounded-xl" onClick={() => setIsOpen(!isOpen)}>
        <LogIn />
        Login/Sign up
      </Button>
      <LoginModal isOpen={isOpen} setIsOpen={setIsOpen}></LoginModal>
    </>
  );
}
