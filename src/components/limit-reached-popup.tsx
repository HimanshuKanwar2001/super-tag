
'use client';

import type React from 'react';
import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ExternalLink, Users, X, Mail, Loader2, AlertCircle } from 'lucide-react';

interface LimitReachedPopupProps {
  isOpen: boolean;
  onClose: () => void;
  resetTime: number | undefined; // Timestamp for next reset
  referralCode: string | null;
  communityUrl: string;
  privacyPolicyUrl: string; // Added for consent text
  onEmailSubmit: (email: string) => Promise<boolean>;
  isSubmittingEmail: boolean;
  emailSubmissionError: string | null;
}

const calculateTimeLeft = (targetTime: number | undefined) => {
  if (!targetTime) return { hours: 0, minutes: 0, seconds: 0, total: 0 };
  const difference = targetTime - Date.now();
  let timeLeft = {
    hours: 0,
    minutes: 0,
    seconds: 0,
    total: difference,
  };

  if (difference > 0) {
    timeLeft = {
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
      total: difference,
    };
  }
  return timeLeft;
};

export function LimitReachedPopup({
  isOpen,
  onClose,
  resetTime,
  referralCode,
  communityUrl,
  privacyPolicyUrl,
  onEmailSubmit,
  isSubmittingEmail,
  emailSubmissionError,
}: LimitReachedPopupProps) {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft(resetTime));
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!resetTime || !isOpen) {
      setTimeLeft(calculateTimeLeft(resetTime));
      return;
    }

    setTimeLeft(calculateTimeLeft(resetTime)); // Initial calculation

    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft(resetTime);
      setTimeLeft(newTimeLeft);
      if (newTimeLeft.total <= 0) {
        clearInterval(timer);
        onClose();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [resetTime, isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setEmail(''); // Reset email field when popup opens
    }
  }, [isOpen]);

  const handleLocalEmailSubmit = async () => {
    if (!email.trim()) {
      // Basic validation, more robust validation can be added
      return;
    }
    const success = await onEmailSubmit(email);
    if (success) {
      setEmail(''); // Clear email on success
    }
  };

  if (!isOpen) {
    return null;
  }

  const unlockBaseUrl = "https://creatorpreneurclub.superprofile.bio/india/";
  const unlockUrl = referralCode ? `${unlockBaseUrl}?referralCode=${referralCode}` : unlockBaseUrl;

  return (
    <AlertDialog open={isOpen} onOpenChange={(openState) => { if (!openState) onClose(); }}>
      <AlertDialogContent className="max-w-lg w-full p-6 rounded-xl shadow-2xl">
        <AlertDialogHeader className="mb-2">
          <AlertDialogTitle className="text-2xl font-bold text-center text-foreground">
            Daily Limit Reached
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center pt-2 text-muted-foreground text-sm">
            You've used your free generations for today. New generations available in:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-3 text-center">
          <div className="text-4xl font-extrabold text-primary">
            {String(timeLeft.hours).padStart(2, '0')}:
            {String(timeLeft.minutes).padStart(2, '0')}:
            {String(timeLeft.seconds).padStart(2, '0')}
          </div>
        </div>
        
        <div className="my-4 p-4 border border-dashed border-border rounded-lg bg-card/50">
          <p className="text-sm text-center text-foreground font-medium mb-2">
            Want more generations now?
          </p>
          <p className="text-xs text-center text-muted-foreground mb-3">
            Share your email to get <strong>15 bonus generations</strong> for this cycle and subscribe to our updates.
            By submitting, you agree to our{' '}
            <a href={privacyPolicyUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
              Privacy Policy
            </a>.
          </p>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 w-full"
              disabled={isSubmittingEmail}
            />
          </div>
          {emailSubmissionError && (
            <p className="mt-2 text-xs text-destructive flex items-center">
              <AlertCircle className="mr-1 h-3 w-3" />
              {emailSubmissionError}
            </p>
          )}
          <Button
            onClick={handleLocalEmailSubmit}
            disabled={isSubmittingEmail || !email.includes('@')}
            className="w-full mt-3"
            variant="default"
          >
            {isSubmittingEmail ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
            ) : (
              'Submit Email & Get Bonus'
            )}
          </Button>
        </div>

        <AlertDialogFooter className="flex flex-col sm:flex-row sm:justify-between items-center pt-2 gap-2">
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
             <Button
              variant="default"
              onClick={() => window.open(unlockUrl, '_blank')}
              className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150 ease-in-out w-full sm:w-auto"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Unlock Unlimited
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open(communityUrl, '_blank')}
              className="border-primary text-primary hover:bg-primary/10 transition-colors duration-150 ease-in-out w-full sm:w-auto"
            >
              <Users className="mr-2 h-4 w-4" />
              Access Community
            </Button>
          </div>
          <Button 
            variant="ghost" 
            onClick={onClose} 
            className="text-muted-foreground hover:bg-muted transition-colors duration-150 ease-in-out w-full sm:w-auto mt-2 sm:mt-0"
          >
            <X className="mr-2 h-4 w-4" />
            Close
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
