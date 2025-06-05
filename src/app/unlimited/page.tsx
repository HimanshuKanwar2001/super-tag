
'use client';

import type React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { KeywordForm } from '@/components/keyword-form';
import { KeywordResults } from '@/components/keyword-results';
import { getKeywordsAction, logAnalyticsEvent } from '@/app/actions';
import type { SuggestKeywordsInput, SuggestKeywordsOutput } from '@/ai/flows/suggest-keywords';
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from '@/hooks/use-mobile';
import { AppHeader } from '@/components/layout/header';


const REFERRAL_CODE_STORAGE_KEY_UNLIMITED = 'referralCodeData_unlimited';
const REFERRAL_CODE_EXPIRY_DAYS = 30;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface ReferralCodeData {
  code: string;
  expiresAt: number;
}

export default function UnlimitedHomePage() {
  const [results, setResults] = useState<SuggestKeywordsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storedReferralCode, setStoredReferralCode] = useState<string | null>(null);

  const { toast } = useToast();
  const isMobile = useIsMobile();
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  const loadDataFromLocalStorage = useCallback(() => {
    const now = Date.now();
    
    const queryParams = new URLSearchParams(window.location.search);
    const urlReferralCode = queryParams.get('referralCode');
    let activeReferralCode: string | null = null;
    let newlyAppliedByUrl = false;

    if (urlReferralCode) {
      const newReferralData: ReferralCodeData = {
        code: urlReferralCode,
        expiresAt: now + REFERRAL_CODE_EXPIRY_DAYS * ONE_DAY_MS,
      };
      localStorage.setItem(REFERRAL_CODE_STORAGE_KEY_UNLIMITED, JSON.stringify(newReferralData));
      activeReferralCode = urlReferralCode;
      newlyAppliedByUrl = true;
    } else {
      const storedReferralString = localStorage.getItem(REFERRAL_CODE_STORAGE_KEY_UNLIMITED);
      if (storedReferralString) {
        try {
          const storedData: ReferralCodeData = JSON.parse(storedReferralString);
          if (now < storedData.expiresAt) {
            activeReferralCode = storedData.code;
          } else {
            localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY_UNLIMITED);
          }
        } catch (e) {
          localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY_UNLIMITED);
          console.error("[PAGE ERROR] Error parsing referralCodeData_unlimited, removed from localStorage:", e);
        }
      }
    }
    
    let newlyAppliedByPostMessage = false;
    if (!activeReferralCode) {
      const postMessageReferralCode = localStorage.getItem("referralCode"); 
      if (postMessageReferralCode) {
        activeReferralCode = postMessageReferralCode;
        const newReferralData: ReferralCodeData = {
          code: postMessageReferralCode,
          expiresAt: now + REFERRAL_CODE_EXPIRY_DAYS * ONE_DAY_MS,
        };
        localStorage.setItem(REFERRAL_CODE_STORAGE_KEY_UNLIMITED, JSON.stringify(newReferralData));
        localStorage.removeItem("referralCode"); 
        newlyAppliedByPostMessage = true;
      }
    }

    if (activeReferralCode && (newlyAppliedByUrl || newlyAppliedByPostMessage)) {
        const eventData = {
            eventType: 'referral_code_applied' as const,
            referralCode: activeReferralCode,
            isMobile: isMobile,
        };
        console.log("[PAGE CLIENT LOG /unlimited] Logging 'referral_code_applied' event. Data:", JSON.stringify(eventData));
        logAnalyticsEvent(eventData).catch(err => console.error("[PAGE ERROR /unlimited] Failed to log 'referral_code_applied' event:", err));
    }
    setStoredReferralCode(activeReferralCode);

  }, [isMobile]);

  useEffect(() => {
    loadDataFromLocalStorage();

    const handleReferralCodeUpdate = (event: Event) => {
      console.log("[PAGE CLIENT LOG /unlimited] 'referralCodeUpdated' event received. Reloading data from localStorage.");
      loadDataFromLocalStorage();
    };

    window.addEventListener('referralCodeUpdated', handleReferralCodeUpdate);

    return () => {
      window.removeEventListener('referralCodeUpdated', handleReferralCodeUpdate);
    };
  }, [loadDataFromLocalStorage]);


  const handleGenerateKeywords = async (values: SuggestKeywordsInput) => {
    setError(null);
    setResults(null);
    setIsLoading(true);

    if (isMobile && resultsContainerRef.current) {
      resultsContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    const attemptEventData = {
        eventType: 'keyword_generation_attempt' as const,
        inputMethod: values.inputMethod,
        platform: values.platform,
        inputTextLength: values.inputText.length,
        referralCode: storedReferralCode,
        wasAlreadyLimited: false, 
        isMobile: isMobile,
    };
    console.log("[PAGE CLIENT LOG /unlimited] Logging 'keyword_generation_attempt' event. Data:", JSON.stringify(attemptEventData));
    logAnalyticsEvent(attemptEventData).catch(err => console.error("[PAGE ERROR /unlimited] Failed to log 'keyword_generation_attempt' event:", err));

    const response = await getKeywordsAction(values);

    if (response.success) {
      setResults(response.data);
      toast({
        title: "Keywords Generated!",
        description: "Successfully fetched keyword suggestions.",
      });
      const successEventData = {
        eventType: 'keyword_generation_success' as const,
        inputMethod: values.inputMethod,
        platform: values.platform,
        inputTextLength: values.inputText.length,
        numberOfKeywordsGenerated: response.data.keywords.length,
        referralCode: storedReferralCode,
        dailyLimitReachedThisAttempt: false, 
        wasAlreadyLimited: false, 
        isMobile: isMobile,
      };
      console.log("[PAGE CLIENT LOG /unlimited] Logging 'keyword_generation_success' event. Data:", JSON.stringify(successEventData));
      logAnalyticsEvent(successEventData).catch(err => console.error("[PAGE ERROR /unlimited] Failed to log 'keyword_generation_success' event:", err));
    } else {
      setError(response.error);
      toast({
        variant: "destructive",
        title: "Error Generating Keywords",
        description: response.error,
      });
       const failureEventData = {
        eventType: 'keyword_generation_failure' as const,
        inputMethod: values.inputMethod,
        platform: values.platform,
        inputTextLength: values.inputText.length,
        referralCode: storedReferralCode,
        wasAlreadyLimited: false, 
        isMobile: isMobile,
        errorMessage: response.error,
      };
      console.log("[PAGE CLIENT LOG /unlimited] Logging 'keyword_generation_failure' event. Data:", JSON.stringify(failureEventData));
      logAnalyticsEvent(failureEventData).catch(err => console.error("[PAGE ERROR /unlimited] Failed to log 'keyword_generation_failure' event:", err));
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />
      <main className="flex-grow container mx-auto px-4 md:px-6 py-8 md:py-12">
        <section className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 items-stretch">
            <div className="bg-card p-6 sm:p-8 rounded-xl shadow-xl h-full flex flex-col">
              <KeywordForm
                onSubmit={handleGenerateKeywords}
                isLoading={isLoading}
                remainingGenerations={null} 
                maxGenerations={null} 
                isUnlimited={true} 
              />
            </div>

            <div ref={resultsContainerRef} className="h-full flex flex-col">
              <KeywordResults
                results={results}
                isLoading={isLoading && (results === null)}
                error={error}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
