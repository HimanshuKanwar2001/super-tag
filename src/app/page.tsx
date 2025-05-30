
'use client';

import type React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { KeywordForm } from '@/components/keyword-form';
import { KeywordResults } from '@/components/keyword-results';
import { getKeywordsAction } from './actions';
import type { SuggestKeywordsInput, SuggestKeywordsOutput } from '@/ai/flows/suggest-keywords';
import { useToast } from "@/hooks/use-toast";
import { LimitReachedPopup } from '@/components/limit-reached-popup';
import { useIsMobile } from '@/hooks/use-mobile';

const CLIENT_MAX_GENERATIONS_PER_DAY = 5;
const CLIENT_USAGE_STORAGE_KEY = 'keywordGeneratorUsage';
const REFERRAL_CODE_STORAGE_KEY = 'referralCodeData';
const REFERRAL_CODE_EXPIRY_DAYS = 30;
const COMMUNITY_URL_PLACEHOLDER = 'https://example.com/community'; // Remember to replace this!
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface ClientUsageData {
  count: number;
  lastReset: number; // Timestamp of the last reset
}

interface ReferralCodeData {
  code: string;
  expiresAt: number; // Timestamp
}

export default function HomePage() {
  const [results, setResults] = useState<SuggestKeywordsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [remainingGenerations, setRemainingGenerations] = useState<number>(CLIENT_MAX_GENERATIONS_PER_DAY);
  const [maxGenerations, setMaxGenerations] = useState<number>(CLIENT_MAX_GENERATIONS_PER_DAY);
  const [resetTime, setResetTime] = useState<number | undefined>(undefined);
  const [isLimitReached, setIsLimitReached] = useState(false); 
  
  const [isLimitPopupOpen, setIsLimitPopupOpen] = useState(false);
  const [storedReferralCode, setStoredReferralCode] = useState<string | null>(null);
  
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  const loadDataFromLocalStorage = useCallback(() => {
    const now = Date.now();

    // Load Usage Data
    try {
      const storedUsage = localStorage.getItem(CLIENT_USAGE_STORAGE_KEY);
      if (storedUsage) {
        const usage: ClientUsageData = JSON.parse(storedUsage);
        if (now < usage.lastReset + ONE_DAY_MS) {
          setRemainingGenerations(usage.count);
          setResetTime(usage.lastReset + ONE_DAY_MS);
          setIsLimitReached(usage.count <= 0);
        } else {
          // If 24 hours have passed, reset usage
          console.log("Daily limit period expired, resetting usage.");
          resetClientUsage();
        }
      } else {
        // No usage data found, initialize it
        console.log("No usage data found, initializing.");
        resetClientUsage();
      }
    } catch (e) {
      console.error("Failed to load usage data from localStorage:", e);
      resetClientUsage(); // Reset to a known state on error
    }
    setMaxGenerations(CLIENT_MAX_GENERATIONS_PER_DAY);

    // Load/Update Referral Code
    const queryParams = new URLSearchParams(window.location.search);
    const urlReferralCode = queryParams.get('referralCode');
    let activeReferralCode: string | null = null;

    if (urlReferralCode) {
      const newReferralData: ReferralCodeData = {
        code: urlReferralCode,
        expiresAt: now + REFERRAL_CODE_EXPIRY_DAYS * ONE_DAY_MS,
      };
      localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, JSON.stringify(newReferralData));
      activeReferralCode = urlReferralCode;
      console.log(`Referral code "${urlReferralCode}" from URL stored/updated. Expires: ${new Date(newReferralData.expiresAt).toLocaleDateString()}`);
      // Optionally clean URL: window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      const storedReferralString = localStorage.getItem(REFERRAL_CODE_STORAGE_KEY);
      if (storedReferralString) {
        try {
          const storedData: ReferralCodeData = JSON.parse(storedReferralString);
          if (now < storedData.expiresAt) {
            activeReferralCode = storedData.code;
            console.log(`Using stored referral code "${activeReferralCode}". Expires: ${new Date(storedData.expiresAt).toLocaleDateString()}`);
          } else {
            console.log("Stored referral code has expired.");
            localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY);
          }
        } catch (e) {
          console.error("Error parsing stored referral data:", e);
          localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY);
        }
      }
    }
    setStoredReferralCode(activeReferralCode);

  }, []);

  const resetClientUsage = () => {
    const now = Date.now();
    const newUsage: ClientUsageData = { count: CLIENT_MAX_GENERATIONS_PER_DAY, lastReset: now };
    localStorage.setItem(CLIENT_USAGE_STORAGE_KEY, JSON.stringify(newUsage));
    setRemainingGenerations(newUsage.count);
    setResetTime(newUsage.lastReset + ONE_DAY_MS);
    setIsLimitReached(newUsage.count <= 0);
    setIsLimitPopupOpen(false); // Close popup if it was open due to limit
    console.log("Client usage reset. Generations remaining:", newUsage.count);
  };

  const recordClientGeneration = () => {
    const now = Date.now();
    const newCount = Math.max(0, remainingGenerations - 1);
    // Ensure lastReset is from the current cycle, not potentially a future resetTime
    const storedUsage = localStorage.getItem(CLIENT_USAGE_STORAGE_KEY);
    let currentLastReset = now; // Default to now if no prior reset time found
    if (storedUsage) {
        try {
            const usage: ClientUsageData = JSON.parse(storedUsage);
            currentLastReset = usage.lastReset; // Use the stored last reset time
        } catch (e) {
            console.error("Error reading stored usage for recording generation:", e);
        }
    }
    
    const newUsage: ClientUsageData = { count: newCount, lastReset: currentLastReset };
    localStorage.setItem(CLIENT_USAGE_STORAGE_KEY, JSON.stringify(newUsage));
    setRemainingGenerations(newCount);
    const limitReachedAfterGeneration = newCount <= 0;
    setIsLimitReached(limitReachedAfterGeneration);
    console.log("Generation recorded. Remaining:", newCount, "Limit reached:", limitReachedAfterGeneration);
  };

  useEffect(() => {
    loadDataFromLocalStorage();
  }, [loadDataFromLocalStorage]);


  const handleGenerateKeywords = async (values: SuggestKeywordsInput) => {
    setError(null); 
    setResults(null); // Clear previous results

    setIsLoading(true);

    if (isMobile && resultsContainerRef.current) {
      resultsContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Check limit *after* setting loading and potentially scrolling, but before API call
    if (remainingGenerations <= 0) {
        setIsLimitReached(true); 
        setIsLimitPopupOpen(true);
        setIsLoading(false); 
        console.log("Attempted generation, but limit reached.");
        return;
    }
    
    const response = await getKeywordsAction(values);

    if (response.success) {
      setResults(response.data);
      recordClientGeneration(); 
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
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-grow container mx-auto px-4 md:px-6 py-8 md:py-12">
        <section className="max-w-6xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Unlock Your Content's Potential
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Get powerful keyword suggestions, identified from thousands of trending Reels and Shorts, to rank higher and boost engagement.
            </p>
            <p className="mt-2 text-xs text-muted-foreground/80">
              (Daily usage limit of {CLIENT_MAX_GENERATIONS_PER_DAY} generations is stored in your browser and resets every 24 hours.)
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 items-stretch">
            <div className="bg-card p-6 sm:p-8 rounded-xl shadow-xl h-full flex flex-col">
              <KeywordForm 
                onSubmit={handleGenerateKeywords} 
                isLoading={isLoading}
              />
            </div>
            
            <div ref={resultsContainerRef} className="h-full flex flex-col">
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
      <LimitReachedPopup
        isOpen={isLimitPopupOpen}
        onClose={() => setIsLimitPopupOpen(false)}
        resetTime={resetTime}
        referralCode={storedReferralCode}
        communityUrl={COMMUNITY_URL_PLACEHOLDER} 
      />
    </div>
  );
}
