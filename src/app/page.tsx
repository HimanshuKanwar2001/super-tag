
'use client';

import type React from 'react';
import { useState, useEffect } from 'react';
import { KeywordForm } from '@/components/keyword-form';
import { KeywordResults } from '@/components/keyword-results';
import { getKeywordsAction, getInitialUsage } from './actions';
import type { SuggestKeywordsInput, SuggestKeywordsOutput } from '@/ai/flows/suggest-keywords';
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function HomePage() {
  const [results, setResults] = useState<SuggestKeywordsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingGenerations, setRemainingGenerations] = useState<number | null>(null);
  const [maxGenerations, setMaxGenerations] = useState<number | null>(null);
  const [resetTime, setResetTime] = useState<number | undefined>(undefined);
  const [formattedResetTimeForAlert, setFormattedResetTimeForAlert] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchInitialUsage() {
      setIsLoading(true); // Indicate loading for initial usage fetch
      try {
        const usage = await getInitialUsage();
        setRemainingGenerations(usage.remainingGenerations);
        setMaxGenerations(usage.maxGenerations);
        setResetTime(usage.resetTime);
      } catch (e) {
        console.error("Failed to fetch initial usage:", e);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not fetch usage data. Please try refreshing.",
        });
        setRemainingGenerations(null); 
        setMaxGenerations(null);
      }
      setIsLoading(false);
    }
    fetchInitialUsage();
  }, [toast]);

  useEffect(() => {
    if (resetTime) {
      setFormattedResetTimeForAlert(new Date(resetTime).toLocaleTimeString());
    } else {
      setFormattedResetTimeForAlert(null);
    }
  }, [resetTime]);

  const handleGenerateKeywords = async (values: SuggestKeywordsInput) => {
    setIsLoading(true);
    setError(null);

    const response = await getKeywordsAction(values);

    if (response.success) {
      setResults(response.data);
      setRemainingGenerations(response.remainingGenerations);
      setResetTime(response.resetTime);
      toast({
        title: "Keywords Generated!",
        description: "Successfully fetched keyword suggestions.",
      });
    } else {
      setError(response.error);
      if (response.remainingGenerations !== undefined) {
        setRemainingGenerations(response.remainingGenerations);
      }
      if (response.resetTime !== undefined) {
        setResetTime(response.resetTime);
      }
      let toastDescription = response.error;
      if (response.remainingGenerations === 0 && response.resetTime) {
        // Make toast message more generic, rely on Alert for specific time
        toastDescription += ` Please check the notice for when you can try again.`;
      }
      toast({
        variant: "destructive",
        title: "Error Generating Keywords",
        description: toastDescription,
      });
    }
    setIsLoading(false);
  };

  const isLimitReached = remainingGenerations !== null && remainingGenerations <= 0;

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
              (Prototype Feature: Daily usage limit is per-IP and uses in-memory storage, which resets on server/deployment changes.)
            </p>
          </div>
          
          {isLimitReached && resetTime && formattedResetTimeForAlert && (
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
                isLoading={isLoading && !results} 
                isDisabled={isLimitReached} 
              />
            </div>
            
            <div className="h-full flex flex-col">
              <KeywordResults 
                results={results} 
                isLoading={isLoading && (results === null)} 
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
