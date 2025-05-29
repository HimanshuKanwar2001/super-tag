'use client';

import type React from 'react';
import { useState } from 'react';
import { AppHeader } from '@/components/layout/header';
import { KeywordForm } from '@/components/keyword-form';
import { KeywordResults } from '@/components/keyword-results';
import { getKeywordsAction } from './actions';
import type { SuggestKeywordsInput, SuggestKeywordsOutput } from '@/ai/flows/suggest-keywords';
import { useToast } from "@/hooks/use-toast";
import { Separator } from '@/components/ui/separator';

export default function HomePage() {
  const [results, setResults] = useState<SuggestKeywordsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleGenerateKeywords = async (values: SuggestKeywordsInput) => {
    setIsLoading(true);
    setError(null);
    setResults(null);

    const response = await getKeywordsAction(values);

    if (response.success) {
      setResults(response.data);
      toast({
        title: "Keywords Generated!",
        description: "Successfully fetched keyword suggestions.",
      });
    } else {
      setError(response.error);
      toast({
        variant: "destructive",
        title: "Error Generating Keywords",
        description: response.error,
      });
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-grow container mx-auto px-4 md:px-6 py-8 md:py-12">
        <section className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Unlock Your Content's Potential
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Get AI-powered keyword suggestions to rank higher and boost engagement for your Reels and Shorts.
            </p>
          </div>
          
          <div className="bg-card p-6 sm:p-8 rounded-xl shadow-xl">
            <KeywordForm onSubmit={handleGenerateKeywords} isLoading={isLoading} />
          </div>

          {(results || isLoading || error) && (
             <Separator className="my-8 md:my-12" />
          )}
          
          <KeywordResults results={results} isLoading={isLoading} error={error} />
        </section>
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/60">
        © {new Date().getFullYear()} ReelRank Keywords. All rights reserved.
      </footer>
    </div>
  );
}
