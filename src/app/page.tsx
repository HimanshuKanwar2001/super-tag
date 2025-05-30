
'use client';

import type React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { KeywordForm } from '@/components/keyword-form';
import { KeywordResults } from '@/components/keyword-results';
import { getKeywordsAction, logAnalyticsEvent, saveContactDetailsAction } from './actions';
import type { SuggestKeywordsInput, SuggestKeywordsOutput } from '@/ai/flows/suggest-keywords';
import { useToast } from "@/hooks/use-toast";
import { LimitReachedPopup } from '@/components/limit-reached-popup';
import { SubscribeForm, type SubscribeFormValues } from '@/components/subscribe-form';
import { useIsMobile } from '@/hooks/use-mobile';
import { Separator } from '@/components/ui/separator';

const CLIENT_MAX_GENERATIONS_PER_DAY = 5;
const CLIENT_USAGE_STORAGE_KEY = 'keywordGeneratorUsage';
const REFERRAL_CODE_STORAGE_KEY = 'referralCodeData';
const REFERRAL_CODE_EXPIRY_DAYS = 30;
const COMMUNITY_URL_PLACEHOLDER = 'https://example.com/community'; // Remember to replace this!
const PRIVACY_POLICY_URL_PLACEHOLDER = '/privacy-policy'; // Remember to replace this!
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
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
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
          console.log("Daily limit period expired, resetting usage.");
          resetClientUsage();
        }
      } else {
        console.log("No usage data found, initializing.");
        resetClientUsage();
      }
    } catch (e) {
      console.error("Failed to load usage data from localStorage:", e);
      resetClientUsage(); 
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
      logAnalyticsEvent({
        eventType: 'referral_code_applied', 
        referralCode: activeReferralCode,
        isMobile: isMobile,
      }).catch(console.error);
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

  }, [isMobile]); 

  const resetClientUsage = () => {
    const now = Date.now();
    const newUsage: ClientUsageData = { count: CLIENT_MAX_GENERATIONS_PER_DAY, lastReset: now };
    localStorage.setItem(CLIENT_USAGE_STORAGE_KEY, JSON.stringify(newUsage));
    setRemainingGenerations(newUsage.count);
    setResetTime(newUsage.lastReset + ONE_DAY_MS);
    setIsLimitReached(newUsage.count <= 0);
    setIsLimitPopupOpen(false); 
    console.log("Client usage reset. Generations remaining:", newUsage.count);
  };

  const recordClientGeneration = () => {
    const now = Date.now();
    const newCount = Math.max(0, remainingGenerations - 1);
    const storedUsage = localStorage.getItem(CLIENT_USAGE_STORAGE_KEY);
    let currentLastReset = now; 
    if (storedUsage) {
        try {
            const usage: ClientUsageData = JSON.parse(storedUsage);
            currentLastReset = usage.lastReset; 
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
    return limitReachedAfterGeneration; 
  };

  useEffect(() => {
    loadDataFromLocalStorage();
  }, [loadDataFromLocalStorage]);


  const handleGenerateKeywords = async (values: SuggestKeywordsInput) => {
    setError(null); 
    setResults(null); 

    setIsLoading(true);

    if (isMobile && resultsContainerRef.current) {
      resultsContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    const wasAlreadyLimited = remainingGenerations <= 0;

    if (wasAlreadyLimited) {
        setIsLimitReached(true); 
        setIsLimitPopupOpen(true);
        setIsLoading(false); 
        console.log("Attempted generation, but limit reached.");
        logAnalyticsEvent({
            eventType: 'already_limited_attempt',
            inputMethod: values.inputMethod,
            platform: values.platform,
            inputTextLength: values.inputText.length,
            referralCode: storedReferralCode,
            wasAlreadyLimited: true,
            isMobile: isMobile,
        }).catch(console.error);
        return;
    }
    
    logAnalyticsEvent({
        eventType: 'keyword_generation_attempt',
        inputMethod: values.inputMethod,
        platform: values.platform,
        inputTextLength: values.inputText.length,
        referralCode: storedReferralCode,
        wasAlreadyLimited: false,
        isMobile: isMobile,
    }).catch(console.error);
    
    const response = await getKeywordsAction(values);
    let dailyLimitReachedThisAttempt = false;

    if (response.success) {
      setResults(response.data);
      dailyLimitReachedThisAttempt = recordClientGeneration(); 
      toast({
        title: "Keywords Generated!",
        description: "Successfully fetched keyword suggestions.",
      });
      logAnalyticsEvent({
        eventType: 'keyword_generation_success',
        inputMethod: values.inputMethod,
        platform: values.platform,
        inputTextLength: values.inputText.length,
        numberOfKeywordsGenerated: response.data.keywords.length,
        referralCode: storedReferralCode,
        dailyLimitReachedThisAttempt: dailyLimitReachedThisAttempt,
        wasAlreadyLimited: false, 
        isMobile: isMobile,
      }).catch(console.error);
    } else {
      setError(response.error);
      toast({
        variant: "destructive",
        title: "Error Generating Keywords",
        description: response.error,
      });
       logAnalyticsEvent({
        eventType: 'keyword_generation_failure',
        inputMethod: values.inputMethod,
        platform: values.platform,
        inputTextLength: values.inputText.length,
        referralCode: storedReferralCode,
        wasAlreadyLimited: false,
        isMobile: isMobile,
        errorMessage: response.error,
      }).catch(console.error);
    }
    setIsLoading(false);

    if (dailyLimitReachedThisAttempt) {
        setIsLimitPopupOpen(true);
        logAnalyticsEvent({
          eventType: 'limit_hit_on_attempt',
          inputMethod: values.inputMethod,
          platform: values.platform,
          inputTextLength: values.inputText.length,
          referralCode: storedReferralCode,
          dailyLimitReachedThisAttempt: true,
          wasAlreadyLimited: false,
          isMobile: isMobile,
        }).catch(console.error);
    }
  };

  const handleSubscribe = async (values: SubscribeFormValues) => {
    setIsSubmittingContact(true);
    const response = await saveContactDetailsAction(values);
    if (response.success) {
      toast({
        title: "Subscribed!",
        description: "Thanks for subscribing. We'll keep you updated.",
      });
      // Optionally log this to your general analytics if desired,
      // but PII itself is handled separately by saveContactDetailsAction.
      logAnalyticsEvent({
        eventType: 'contact_details_submitted', // Make sure this eventType is handled in your GSheet setup if you add it
        isMobile: isMobile,
        referralCode: storedReferralCode
      }).catch(console.error);
    } else {
      toast({
        variant: "destructive",
        title: "Subscription Failed",
        description: response.error || "Could not save your details. Please try again.",
      });
    }
    setIsSubmittingContact(false);
  };
  

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-grow container mx-auto px-4 md:px-6 py-8 md:py-12">
        <section className="max-w-6xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Unlock Your Content's Potential
            </h1>
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

        <Separator className="my-12 md:my-16" />

        <section className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                    Stay Updated!
                </h2>
                <p className="mt-3 text-lg text-muted-foreground">
                    Subscribe to get the latest tips, feature updates, and exclusive content directly to your inbox.
                </p>
            </div>
            <div className="bg-card p-6 sm:p-8 rounded-xl shadow-xl">
                <SubscribeForm 
                    onSubmit={handleSubscribe} 
                    isLoading={isSubmittingContact}
                    privacyPolicyUrl={PRIVACY_POLICY_URL_PLACEHOLDER}
                />
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
