
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
import { ExternalLink, Users, X } from 'lucide-react';

interface LimitReachedPopupProps {
  isOpen: boolean;
  onClose: () => void;
  resetTime: number | undefined; // Timestamp for next reset
  referralCode: string | null;
  communityUrl: string;
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
}: LimitReachedPopupProps) {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft(resetTime));

  useEffect(() => {
    if (!resetTime || !isOpen) {
      // Ensure timer doesn't run if resetTime is undefined or popup is closed
      setTimeLeft(calculateTimeLeft(resetTime)); // Recalculate if resetTime changes while closed
      return;
    }

    // Initialize immediately
    setTimeLeft(calculateTimeLeft(resetTime));

    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft(resetTime);
      setTimeLeft(newTimeLeft);
      if (newTimeLeft.total <= 0) {
        clearInterval(timer);
        onClose(); // Auto-close when time is up
        // Consider a mechanism to re-fetch usage or prompt user to refresh
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [resetTime, isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const unlockBaseUrl = "https://creatorpreneurclub.superprofile.bio/india/";
  const unlockUrl = referralCode ? `${unlockBaseUrl}?referralCode=${referralCode}` : unlockBaseUrl;

  return (
    <AlertDialog open={isOpen} onOpenChange={(openState) => { if (!openState) onClose(); }}>
      <AlertDialogContent className="max-w-md w-full p-6 rounded-xl shadow-2xl">
        <AlertDialogHeader className="mb-4">
          <AlertDialogTitle className="text-2xl font-bold text-center text-foreground">
            Daily Limit Reached
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center pt-2 text-muted-foreground">
            You've used all your free keyword generations for today.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-6 text-center">
          <p className="text-sm text-muted-foreground mb-2">New generations available in:</p>
          <div className="text-4xl font-extrabold text-primary">
            {String(timeLeft.hours).padStart(2, '0')}:
            {String(timeLeft.minutes).padStart(2, '0')}:
            {String(timeLeft.seconds).padStart(2, '0')}
          </div>
        </div>

        <AlertDialogFooter className="flex flex-col gap-3 pt-4">
          <Button
            variant="default"
            size="lg"
            onClick={() => window.open(unlockUrl, '_blank')}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150 ease-in-out"
          >
            <ExternalLink className="mr-2 h-5 w-5" />
            Unlock Unlimited
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => window.open(communityUrl, '_blank')}
            className="w-full border-primary text-primary hover:bg-primary/10 transition-colors duration-150 ease-in-out"
          >
            <Users className="mr-2 h-5 w-5" />
            Access the Community
          </Button>
          <Button variant="ghost" size="lg" onClick={onClose} className="w-full text-muted-foreground hover:bg-muted transition-colors duration-150 ease-in-out">
            <X className="mr-2 h-5 w-5" />
            Close
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
