
'use client';

import type React from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ThumbsUp, AlertCircle, Info, Copy, ListChecks, Users, Brain, Loader2, Sparkles, SearchCheck } from 'lucide-react';
import type { SuggestKeywordsOutput } from '@/ai/flows/suggest-keywords';
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from '@/components/ui/scroll-area';

interface KeywordResultsProps {
  results: SuggestKeywordsOutput | null;
  isLoading: boolean;
  error: string | null;
  remainingGenerations: number | null; 
  maxGenerations: number | null;     
  resetTime?: number;               
}

export function KeywordResults({ 
  results, 
  isLoading, 
  error, 
  remainingGenerations, 
  maxGenerations,
  resetTime 
}: KeywordResultsProps) {
  const { toast } = useToast();
  const [formattedResetTimeForDisplay, setFormattedResetTimeForDisplay] = useState<string | null>(null);

  useEffect(() => {
    if (resetTime) {
      const date = new Date(resetTime);
      setFormattedResetTimeForDisplay(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } else {
      setFormattedResetTimeForDisplay(null);
    }
  }, [resetTime]);

  const handleCopyAllKeywords = () => {
    if (results && results.keywords.length > 0) {
      const keywordsString = results.keywords.join(', ');
      const allKeywordsText = `[${keywordsString}]`;
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

  const renderUsageInfo = () => {
    if (isLoading && (remainingGenerations === null || maxGenerations === null)) {
        return <div className="h-4 w-28 bg-muted rounded animate-pulse" />; 
    }
    if (remainingGenerations !== null && maxGenerations !== null) {
      const isDepleted = remainingGenerations <= 0;
      return (
        <div className={`text-xs ${isDepleted ? 'text-destructive' : 'text-muted-foreground'} flex items-center whitespace-nowrap`}>
          <Users className="mr-1.5 h-3.5 w-3.5 shrink-0" />
          Daily Usage: {remainingGenerations}/{maxGenerations}
          {isDepleted && formattedResetTimeForDisplay && (
            <span className="ml-1 truncate"> (Resets: {formattedResetTimeForDisplay})</span>
          )}
        </div>
      );
    }
    return null; 
  };


  if (isLoading && !results && !error) { 
    return (
      <Card className="h-full flex flex-col shadow-xl rounded-xl">
        <CardHeader>
          <div className="flex justify-between items-start gap-2">
            <CardTitle className="flex items-center">
              <SearchCheck className="mr-3 h-6 w-6 text-primary shrink-0 animate-pulse" />
              Finding Your Keywords...
            </CardTitle>
            {renderUsageInfo()} 
          </div>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col items-center justify-center text-center p-6 sm:p-10 space-y-3">
           <Brain className="h-12 w-12 sm:h-16 sm:w-16 text-primary opacity-80" />
            <p className="text-lg sm:text-xl font-semibold text-foreground">
              Our system is hard at work!
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Analyzing your input, scanning thousands of successful videos, and identifying top-performing keywords for you.
            </p>
            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground animate-spin mt-3" />
            <p className="text-xs text-muted-foreground/80">
              This might take a moment...
            </p>
        </CardContent>
      </Card>
    );
  }
  
  if (error && (!results || results.keywords.length === 0 || error.toLowerCase().includes("limit reached") || error.toLowerCase().includes("daily limit"))) {
    return (
      <Card className="h-full flex flex-col shadow-xl rounded-xl">
        <CardHeader>
           <div className="flex justify-between items-start gap-2">
            <CardTitle className="flex items-center text-destructive">
               <AlertCircle className="mr-3 h-6 w-6 shrink-0" />
              Error
            </CardTitle>
            {renderUsageInfo()}
          </div>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center p-6">
          <Alert variant="destructive" className="w-full">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Generation Failed</AlertTitle>
            <AlertDescription>
                {error}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }
  
  if (!results || results.keywords.length === 0) {
    return (
      <Card className="h-full flex flex-col shadow-xl rounded-xl">
        <CardHeader>
            <div className="flex justify-between items-start gap-2">
                <CardTitle className="flex items-center">
                    <ListChecks className="mr-3 h-6 w-6 text-primary shrink-0" />
                    Keyword Suggestions
                </CardTitle>
                {renderUsageInfo()}
            </div>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col items-center justify-center text-center p-6">
          <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-foreground mb-1">
            {results && results.keywords.length === 0 ? "No Keywords Found" : "No Keywords Yet"}
          </p>
          <p className="text-sm text-muted-foreground">
            {results && results.keywords.length === 0 
              ? "We couldn't find relevant keywords. Try refining your input." 
              : 'Enter content details and click "Suggest Keywords" to see results.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col shadow-xl rounded-xl">
      <CardHeader>
        <div className="flex flex-row justify-between items-start gap-2">
            <div>
            <CardTitle className="flex items-center">
                <ThumbsUp className="mr-3 h-7 w-7 text-primary shrink-0" />
                Suggested Keywords
            </CardTitle>
            {results.keywords.length === 0 && ( 
                <CardDescription className="mt-1">No keywords were generated for this input.</CardDescription>
            )}
            </div>
            <div className="flex flex-col items-end gap-2">
                {results.keywords.length > 0 && (
                <Button onClick={handleCopyAllKeywords} variant="outline" size="sm" className="shrink-0">
                    <Copy className="mr-2 h-4 w-4" />
                    Copy All
                </Button>
                )}
                {renderUsageInfo()}
            </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
         {results.keywords.length > 0 ? (
            <ScrollArea className="h-full pr-4"> 
                <div className="p-3 rounded-md border border-border/70 bg-background hover:shadow-md transition-shadow">
                  <p className="text-md font-semibold text-primary break-words">
                      {results.keywords.join(', ')}
                  </p>
                </div>
            </ScrollArea>
         ) : (
            <div className="flex-grow flex flex-col items-center justify-center text-center p-6">
                <Info className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-md text-muted-foreground">
                  No keywords were generated.
                </p>
          </div>
         )}
      </CardContent>
    </Card>
  );
}
