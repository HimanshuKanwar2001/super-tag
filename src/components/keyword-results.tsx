
'use client';

import type React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ThumbsUp, AlertCircle, Info, Copy, ListChecks } from 'lucide-react';
import type { SuggestKeywordsOutput } from '@/ai/flows/suggest-keywords';
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from '@/components/ui/scroll-area';

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
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center">
            <ListChecks className="mr-3 h-6 w-6 text-primary" />
            Generating Keywords...
            </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center text-destructive">
             <AlertCircle className="mr-3 h-6 w-6" />
            Error Generating Keywords
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center">
          <Alert variant="destructive" className="w-full">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!results) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
            <CardTitle className="flex items-center">
                <ListChecks className="mr-3 h-6 w-6 text-primary" />
                Keyword Suggestions
            </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col items-center justify-center text-center p-6">
          <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-foreground mb-1">No Keywords Yet</p>
          <p className="text-sm text-muted-foreground">
            Enter your content details in the form and click "Suggest Keywords" to see results here.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (results.keywords.length === 0) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
           <CardTitle className="flex items-center">
                <ListChecks className="mr-3 h-6 w-6 text-primary" />
                Keyword Suggestions
            </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center">
          <Alert className="w-full">
            <Info className="h-4 w-4" />
            <AlertTitle>No Keywords Found</AlertTitle>
            <AlertDescription>
              We couldn't find any relevant keywords for your input. Try refining your text or changing the input method/platform.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col shadow-xl rounded-xl">
      <CardHeader className="flex flex-row justify-between items-center">
        <CardTitle className="flex items-center">
          <ThumbsUp className="mr-3 h-7 w-7 text-primary" />
          Suggested Keywords
        </CardTitle>
        {results.keywords.length > 0 && (
          <Button onClick={handleCopyAllKeywords} variant="outline" size="sm">
            <Copy className="mr-2 h-4 w-4" />
            Copy All
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
        <ScrollArea className="h-full pr-4"> {/* Added pr-4 for scrollbar spacing */}
          <div className="space-y-4">
            {results.keywords.map((keyword, index) => (
              <div key={index} className="p-4 rounded-md border border-border/70 bg-card hover:shadow-md transition-shadow">
                <h4 className="text-md font-semibold text-primary mb-1">{keyword}</h4>
                <p className="text-sm text-foreground/80">
                  {results.keywordExplanations[index] || 'No explanation available.'}
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
