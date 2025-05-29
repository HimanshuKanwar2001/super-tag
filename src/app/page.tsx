
'use client';

import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { KeywordForm } from '@/components/keyword-form';
import { KeywordResults } from '@/components/keyword-results';
import { getKeywordsAction } from './actions';
import type { SuggestKeywordsInput, SuggestKeywordsOutput } from '@/ai/flows/suggest-keywords';
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const CLIENT_MAX_GENERATIONS_PER_DAY = 5;
const CLIENT_USAGE_STORAGE_KEY = 'keywordGeneratorUsage';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface ClientUsageData {
  count: number;
  lastReset: number; // Timestamp of the last reset
}

export default function HomePage() {
  const [results, setResults] = useState<SuggestKeywordsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [remainingGenerations, setRemainingGenerations] = useState<number>(CLIENT_MAX_GENERATIONS_PER_DAY);
  const [maxGenerations, setMaxGenerations] = useState<number>(CLIENT_MAX_GENERATIONS_PER_DAY);
  const [resetTime, setResetTime] = useState<number | undefined>(undefined);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [formattedResetTimeForAlert, setFormattedResetTimeForAlert] = useState<string | null>(null);
  
  const { toast } = useToast();

  const loadUsageFromLocalStorage = useCallback(() => {
    const now = Date.now();
    try {
      const storedData = localStorage.getItem(CLIENT_USAGE_STORAGE_KEY);
      if (storedData) {
        const usage: ClientUsageData = JSON.parse(storedData);
        if (now < usage.lastReset + ONE_DAY_MS) {
          // Still within the 24-hour window
          setRemainingGenerations(usage.count);
          setResetTime(usage.lastReset + ONE_DAY_MS);
          setIsLimitReached(usage.count <= 0);
        } else {
          // 24-hour window has passed, reset
          resetClientUsage();
        }
      } else {
        // No data, initialize
        resetClientUsage();
      }
    } catch (e) {
      console.error("Failed to load usage data from localStorage:", e);
      // Fallback to default if localStorage is corrupt or inaccessible
      resetClientUsage();
    }
    setMaxGenerations(CLIENT_MAX_GENERATIONS_PER_DAY);
  }, []);

  const resetClientUsage = () => {
    const now = Date.now();
    const newUsage: ClientUsageData = { count: CLIENT_MAX_GENERATIONS_PER_DAY, lastReset: now };
    localStorage.setItem(CLIENT_USAGE_STORAGE_KEY, JSON.stringify(newUsage));
    setRemainingGenerations(newUsage.count);
    setResetTime(newUsage.lastReset + ONE_DAY_MS);
    setIsLimitReached(newUsage.count <= 0);
  };

  const recordClientGeneration = () => {
    const now = Date.now();
    const newCount = remainingGenerations - 1;
    // Ensure lastReset reflects the start of the current 24h cycle
    // It should have been set correctly by loadUsageFromLocalStorage or resetClientUsage
    const currentLastReset = resetTime ? resetTime - ONE_DAY_MS : now; 
    const newUsage: ClientUsageData = { count: newCount, lastReset: currentLastReset };
    localStorage.setItem(CLIENT_USAGE_STORAGE_KEY, JSON.stringify(newUsage));
    setRemainingGenerations(newCount);
    setIsLimitReached(newCount <= 0);
  };

  useEffect(() => {
    loadUsageFromLocalStorage();
  }, [loadUsageFromLocalStorage]);

  useEffect(() => {
    if (resetTime) {
      setFormattedResetTimeForAlert(new Date(resetTime).toLocaleTimeString());
    } else {
      setFormattedResetTimeForAlert(null);
    }
  }, [resetTime]);

  const handleGenerateKeywords = async (values: SuggestKeywordsInput) => {
    setError(null); // Clear previous errors

    if (isLimitReached) {
      const limitErrorMsg = `Daily limit of ${CLIENT_MAX_GENERATIONS_PER_DAY} generations reached. Please try again after ${formattedResetTimeForAlert || 'the reset time'}.`;
      setError(limitErrorMsg);
      toast({
        variant: "destructive",
        title: "Daily Limit Reached",
        description: limitErrorMsg,
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    const response = await getKeywordsAction(values);

    if (response.success) {
      setResults(response.data);
      recordClientGeneration(); // Record successful generation
      toast({
        title: "Keywords Generated!",
        description: "Successfully fetched keyword suggestions.",
      });
    } else {
      setError(response.error);
      // Do not decrement count for failed server-side actions (e.g. validation error, AI error)
      // Only decrement for successful generation or if limit was hit client-side *before* call.
      toast({
        variant: "destructive",
        title: "Error Generating Keywords",
        description: response.error,
      });
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-grow container mx-auto px-4 md:px-6 py-8 md:py-12">
        <section className="max-w-6xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Unlock Your Content's Potential
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Get AI-powered keyword suggestions to rank higher and boost engagement for your Reels and Shorts.
            </p>
            <p className="mt-2 text-xs text-muted-foreground/80">
              (Prototype Feature: Daily usage limit is stored in your browser and resets every 24 hours.)
            </p>
          </div>
          
          {isLimitReached && formattedResetTimeForAlert && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Daily Limit Reached</AlertTitle>
              <AlertDescription>
                You have used all your keyword generations for today. Please try again after {formattedResetTimeForAlert}.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid md:grid-cols-2 gap-8 items-stretch">
            <div className="bg-card p-6 sm:p-8 rounded-xl shadow-xl h-full flex flex-col">
              <KeywordForm 
                onSubmit={handleGenerateKeywords} 
                isLoading={isLoading && !results} // Show loading on form only if results aren't there yet
                isDisabled={isLoading || isLimitReached} // Disable if loading or limit reached
              />
            </div>
            
            <div className="h-full flex flex-col">
              <KeywordResults 
                results={results} 
                isLoading={isLoading && (results === null)} // Show loading on results only if they are truly null
                error={error} 
                remainingGenerations={remainingGenerations}
                maxGenerations={maxGenerations}
                resetTime={resetTime}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
