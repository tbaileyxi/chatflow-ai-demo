import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LogIn, UserPlus } from 'lucide-react';

interface SignupPromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  huddleId?: string;
}

export const SignupPromptModal: React.FC<SignupPromptModalProps> = ({
  open,
  onOpenChange,
  huddleId,
}) => {
  const navigate = useNavigate();

  const handleSignup = () => {
    // Store intended huddle for auto-join after signup
    if (huddleId) {
      localStorage.setItem('intended_huddle_id', huddleId);
    }
    navigate('/auth?signup=true');
  };

  const handleSignin = () => {
    // Store intended huddle for redirect after signin
    if (huddleId) {
      localStorage.setItem('intended_huddle_id', huddleId);
    }
    navigate('/auth');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Join the Conversation</DialogTitle>
          <DialogDescription className="text-base">
            Create your free account to join the conversation.
            <br />
            <span className="font-semibold text-primary">Takes 5 seconds.</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-4">
          <Button
            onClick={handleSignup}
            size="lg"
            className="w-full bg-primary hover:bg-primary/90"
          >
            <UserPlus className="w-5 h-5 mr-2" />
            Create Free Account
          </Button>

          <Button
            onClick={handleSignin}
            size="lg"
            variant="outline"
            className="w-full"
          >
            <LogIn className="w-5 h-5 mr-2" />
            Sign In
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-2">
          By signing up, you agree to our{' '}
          <a
            href="https://docs.google.com/document/d/e/2PACX-1vStEnMeiAhNukWvnEO0_4VbNxuBFU5kQ5y7froaOF8H_hjUFa1_nhIclOPnmXe8OL3Vx6-WhL-wMy4M/pub"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Terms & Privacy
          </a>
        </p>
      </DialogContent>
    </Dialog>
  );
};
