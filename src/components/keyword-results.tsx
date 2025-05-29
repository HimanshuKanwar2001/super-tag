
'use client';

import type React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ThumbsUp, AlertCircle, Info, Copy } from 'lucide-react';
import type { SuggestKeywordsOutput } from '@/ai/flows/suggest-keywords';
import { useToast } from "@/hooks/use-toast";

interface KeywordResultsProps {
  results: SuggestKeywordsOutput | null;
  isLoading: boolean;
  error: string | null;
}

export function KeywordResults({ results, isLoading, error }: KeywordResultsProps) {
  const { toast } = useToast();

  const handleCopyAllKeywords = () => {
    if (results && results.keywords.length > 0) {
      const allKeywordsText = results.keywords.join(', ');
      navigator.clipboard.writeText(allKeywordsText)
        .then(() => {
          toast({
            title: 'Keywords Copied!',
            description: 'All keywords have been copied to your clipboard.',
          });
        })
        .catch(err => {
          console.error('Failed to copy keywords: ', err);
          toast({
            variant: 'destructive',
            title: 'Copy Failed',
            description: 'Could not copy keywords to clipboard.',
          });
        });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 mt-8">
        <h2 className="text-xl font-semibold text-foreground mb-4">Generating Keywords...</h2>
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-5/6" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mt-8">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!results) {
    return (
      <div className="mt-8 text-center py-10 border border-dashed rounded-lg">
        <Info className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">
          Enter your content details above and click "Suggest Keywords" to see results.
        </p>
      </div>
    );
  }

  if (results.keywords.length === 0) {
    return (
      <Alert className="mt-8">
        <Info className="h-4 w-4" />
        <AlertTitle>No Keywords Found</AlertTitle>
        <AlertDescription>
          We couldn't find any relevant keywords for your input. Try refining your text or changing the input method/platform.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mt-10 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-semibold text-foreground flex items-center">
          <ThumbsUp className="mr-3 h-7 w-7 text-primary" />
          Suggested Keywords
        </h2>
        {results.keywords.length > 0 && (
          <Button onClick={handleCopyAllKeywords} variant="outline" size="sm">
            <Copy className="mr-2 h-4 w-4" />
            Copy All Keywords
          </Button>
        )}
      </div>
      <Accordion type="single" collapsible className="w-full">
        {results.keywords.map((keyword, index) => (
          <AccordionItem value={`item-${index}`} key={index} className="bg-card border-border rounded-lg mb-3 shadow-sm hover:shadow-md transition-shadow duration-200">
            <AccordionTrigger className="px-6 py-4 text-lg font-medium text-primary hover:no-underline">
              {keyword}
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4 pt-0 text-foreground/80">
              <p>{results.keywordExplanations[index] || 'No explanation available.'}</p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
