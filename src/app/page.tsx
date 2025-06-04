
'use client';

import type React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { KeywordForm } from '@/components/keyword-form';
import { KeywordResults } from '@/components/keyword-results';
import { getKeywordsAction, logAnalyticsEvent, saveContactDetailsAction } from './actions';
import type { SuggestKeywordsInput, SuggestKeywordsOutput } from '@/ai/flows/suggest-keywords';
import { useToast } from "@/hooks/use-toast";
import { LimitReachedPopup } from '@/components/limit-reached-popup';
import { useIsMobile } from '@/hooks/use-mobile';

const CLIENT_MAX_GENERATIONS_PER_DAY_BASE = 5;
const BONUS_GENERATIONS = 5;
const CLIENT_USAGE_STORAGE_KEY = 'keywordGeneratorUsage';
const REFERRAL_CODE_STORAGE_KEY = 'referralCodeData';
const EMAIL_BONUS_STORAGE_KEY = 'keywordGeneratorEmailBonusData'; // New key for bonus tracking
const REFERRAL_CODE_EXPIRY_DAYS = 30;
const COMMUNITY_URL_PLACEHOLDER = 'https://example.com/community';
const PRIVACY_POLICY_URL_PLACEHOLDER = '/privacy-policy';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface ClientUsageData {
  count: number;
  lastReset: number;
}

interface ReferralCodeData {
  code: string;
  expiresAt: number;
}

// Interface for tracking email bonus
interface EmailBonusData {
  grantedInCycleTimestamp: number | null; // Stores the 'lastReset' timestamp when bonus was granted
}

export default function HomePage() {
  const [results, setResults] = useState<SuggestKeywordsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [remainingGenerations, setRemainingGenerations] = useState<number>(CLIENT_MAX_GENERATIONS_PER_DAY_BASE);
  const [maxGenerations, setMaxGenerations] = useState<number>(CLIENT_MAX_GENERATIONS_PER_DAY_BASE);
  const [resetTime, setResetTime] = useState<number | undefined>(undefined);
  const [isLimitReachedPopupOpen, setIsLimitReachedPopupOpen] = useState(false);

  const [storedReferralCode, setStoredReferralCode] = useState<string | null>(null);

  const [isSubmittingEmailForBonus, setIsSubmittingEmailForBonus] = useState(false);
  const [emailForBonusError, setEmailForBonusError] = useState<string | null>(null);

  const { toast } = useToast();
  const isMobile = useIsMobile();
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  const resetClientUsage = useCallback(() => {
    const now = Date.now();
    const newUsage: ClientUsageData = { count: CLIENT_MAX_GENERATIONS_PER_DAY_BASE, lastReset: now };
    localStorage.setItem(CLIENT_USAGE_STORAGE_KEY, JSON.stringify(newUsage));
    
    // Reset email bonus tracking for the new cycle
    const newBonusData: EmailBonusData = { grantedInCycleTimestamp: null };
    localStorage.setItem(EMAIL_BONUS_STORAGE_KEY, JSON.stringify(newBonusData));

    setRemainingGenerations(newUsage.count);
    setMaxGenerations(CLIENT_MAX_GENERATIONS_PER_DAY_BASE); // Max generations initially is base
    setResetTime(newUsage.lastReset + ONE_DAY_MS);

    setIsLimitReachedPopupOpen(false);
  }, []);


  const loadDataFromLocalStorage = useCallback(() => {
    const now = Date.now();
    let currentMaxGenerations = CLIENT_MAX_GENERATIONS_PER_DAY_BASE;
    let currentRemainingGenerations = CLIENT_MAX_GENERATIONS_PER_DAY_BASE;
    let currentResetTime = now + ONE_DAY_MS;

    // Initialize EMAIL_BONUS_STORAGE_KEY if it doesn't exist
    if (!localStorage.getItem(EMAIL_BONUS_STORAGE_KEY)) {
      const initialBonusData: EmailBonusData = { grantedInCycleTimestamp: null };
      localStorage.setItem(EMAIL_BONUS_STORAGE_KEY, JSON.stringify(initialBonusData));
    }

    try {
      const storedUsageString = localStorage.getItem(CLIENT_USAGE_STORAGE_KEY);
      let usage: ClientUsageData;

      if (storedUsageString) {
        usage = JSON.parse(storedUsageString);
        if (now < usage.lastReset + ONE_DAY_MS) { // Still within current cycle
          currentRemainingGenerations = usage.count;
          currentResetTime = usage.lastReset + ONE_DAY_MS;

          // Check if bonus was granted in this cycle
          const storedBonusString = localStorage.getItem(EMAIL_BONUS_STORAGE_KEY);
          if (storedBonusString) {
            const bonusData: EmailBonusData = JSON.parse(storedBonusString);
            if (bonusData.grantedInCycleTimestamp === usage.lastReset) {
              currentMaxGenerations = CLIENT_MAX_GENERATIONS_PER_DAY_BASE + BONUS_GENERATIONS;
            }
          }
        } else { // Cycle expired
          resetClientUsage(); // This also resets bonus eligibility
          const freshUsageString = localStorage.getItem(CLIENT_USAGE_STORAGE_KEY); // Read fresh data after reset
          usage = freshUsageString ? JSON.parse(freshUsageString) : { count: CLIENT_MAX_GENERATIONS_PER_DAY_BASE, lastReset: now };
          currentRemainingGenerations = usage.count;
          currentResetTime = usage.lastReset + ONE_DAY_MS;
          // currentMaxGenerations remains CLIENT_MAX_GENERATIONS_PER_DAY_BASE after reset
        }
      } else { // No usage data, first time or cleared
        resetClientUsage(); // This also resets bonus eligibility
        const freshUsageString = localStorage.getItem(CLIENT_USAGE_STORAGE_KEY);
        usage = freshUsageString ? JSON.parse(freshUsageString) : { count: CLIENT_MAX_GENERATIONS_PER_DAY_BASE, lastReset: now };
        currentRemainingGenerations = usage.count;
        currentResetTime = usage.lastReset + ONE_DAY_MS;
        // currentMaxGenerations remains CLIENT_MAX_GENERATIONS_PER_DAY_BASE
      }
      setRemainingGenerations(currentRemainingGenerations);
      setMaxGenerations(currentMaxGenerations);
      setResetTime(currentResetTime);

    } catch (e) {
      console.error("[PAGE ERROR] Failed to load usage/bonus data from localStorage:", e);
      resetClientUsage(); // Reset everything if parsing fails
    }

    // Referral code logic (remains the same)
    const queryParams = new URLSearchParams(window.location.search);
    const urlReferralCode = queryParams.get('referralCode');
    let activeReferralCode: string | null = null;
    let newlyAppliedByUrl = false;

    if (urlReferralCode) {
      const newReferralData: ReferralCodeData = {
        code: urlReferralCode,
        expiresAt: now + REFERRAL_CODE_EXPIRY_DAYS * ONE_DAY_MS,
      };
      localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, JSON.stringify(newReferralData));
      activeReferralCode = urlReferralCode;
      newlyAppliedByUrl = true;
    } else {
      const storedReferralString = localStorage.getItem(REFERRAL_CODE_STORAGE_KEY);
      if (storedReferralString) {
        try {
          const storedData: ReferralCodeData = JSON.parse(storedReferralString);
          if (now < storedData.expiresAt) {
            activeReferralCode = storedData.code;
          } else {
            localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY);
          }
        } catch (e) {
          localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY);
          console.error("[PAGE ERROR] Error parsing referralCodeData, removed from localStorage:", e);
        }
      }
    }
    
    let newlyAppliedByPostMessage = false;
    if (!activeReferralCode) {
      const postMessageReferralCode = localStorage.getItem("referralCode"); // Simple string from postMessage
      if (postMessageReferralCode) {
        activeReferralCode = postMessageReferralCode;
        const newReferralData: ReferralCodeData = {
          code: postMessageReferralCode,
          expiresAt: now + REFERRAL_CODE_EXPIRY_DAYS * ONE_DAY_MS,
        };
        localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, JSON.stringify(newReferralData)); // Promote to standard format
        newlyAppliedByPostMessage = true;
      }
    }

    if (activeReferralCode && (newlyAppliedByUrl || newlyAppliedByPostMessage)) {
        const eventData = {
            eventType: 'referral_code_applied' as const,
            referralCode: activeReferralCode,
            isMobile: isMobile,
        };
        logAnalyticsEvent(eventData).catch(err => console.error("[PAGE ERROR] Failed to log 'referral_code_applied' event:", err));
    }
    setStoredReferralCode(activeReferralCode);

  }, [isMobile, resetClientUsage]);

  useEffect(() => {
    loadDataFromLocalStorage();

    const handleReferralCodeUpdate = (event: Event) => {
      loadDataFromLocalStorage();
    };

    window.addEventListener('referralCodeUpdated', handleReferralCodeUpdate);

    return () => {
      window.removeEventListener('referralCodeUpdated', handleReferralCodeUpdate);
    };
  }, [loadDataFromLocalStorage]);


  const recordClientGeneration = () => {
    const storedUsageString = localStorage.getItem(CLIENT_USAGE_STORAGE_KEY);
    if (!storedUsageString) {
      resetClientUsage(); // Should not happen if loadDataFromLocalStorage ran
      return CLIENT_MAX_GENERATIONS_PER_DAY_BASE -1 <= 0;
    }
    const usage: ClientUsageData = JSON.parse(storedUsageString);
    const newCount = Math.max(0, usage.count - 1);

    const newUsage: ClientUsageData = { ...usage, count: newCount };
    localStorage.setItem(CLIENT_USAGE_STORAGE_KEY, JSON.stringify(newUsage));
    setRemainingGenerations(newCount);

    return newCount <= 0;
  };


  const handleGenerateKeywords = async (values: SuggestKeywordsInput) => {
    setError(null);
    setResults(null);
    setIsLoading(true);

    if (isMobile && resultsContainerRef.current) {
      resultsContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    const currentUsageString = localStorage.getItem(CLIENT_USAGE_STORAGE_KEY);
    const currentUsage: ClientUsageData = currentUsageString ? JSON.parse(currentUsageString) : { count: 0, lastReset: Date.now() };
    const localRemainingGenerations = currentUsage.count;
    const wasAlreadyLimited = localRemainingGenerations <= 0;

    if (wasAlreadyLimited) {
        setIsLimitReachedPopupOpen(true);
        setIsLoading(false);
        const eventData = {
            eventType: 'already_limited_attempt' as const,
            inputMethod: values.inputMethod,
            platform: values.platform,
            inputTextLength: values.inputText.length,
            referralCode: storedReferralCode,
            wasAlreadyLimited: true,
            isMobile: isMobile,
        };
        console.log("[PAGE CLIENT LOG] Logging 'already_limited_attempt' event. Data:", JSON.stringify(eventData));
        logAnalyticsEvent(eventData).catch(err => console.error("[PAGE ERROR] Failed to log 'already_limited_attempt' event:", err));
        return;
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
    console.log("[PAGE CLIENT LOG] Logging 'keyword_generation_attempt' event. Data:", JSON.stringify(attemptEventData));
    logAnalyticsEvent(attemptEventData).catch(err => console.error("[PAGE ERROR] Failed to log 'keyword_generation_attempt' event:", err));

    const response = await getKeywordsAction(values);
    let dailyLimitReachedThisAttempt = false;

    if (response.success) {
      setResults(response.data);
      dailyLimitReachedThisAttempt = recordClientGeneration();
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
        dailyLimitReachedThisAttempt: dailyLimitReachedThisAttempt,
        wasAlreadyLimited: false,
        isMobile: isMobile,
      };
      console.log("[PAGE CLIENT LOG] Logging 'keyword_generation_success' event. Data:", JSON.stringify(successEventData));
      logAnalyticsEvent(successEventData).catch(err => console.error("[PAGE ERROR] Failed to log 'keyword_generation_success' event:", err));
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
      console.log("[PAGE CLIENT LOG] Logging 'keyword_generation_failure' event. Data:", JSON.stringify(failureEventData));
      logAnalyticsEvent(failureEventData).catch(err => console.error("[PAGE ERROR] Failed to log 'keyword_generation_failure' event:", err));
    }
    setIsLoading(false);

    if (dailyLimitReachedThisAttempt) {
        setIsLimitReachedPopupOpen(true);
        const limitHitEventData = {
          eventType: 'limit_hit_on_attempt' as const,
          inputMethod: values.inputMethod,
          platform: values.platform,
          inputTextLength: values.inputText.length,
          referralCode: storedReferralCode,
          dailyLimitReachedThisAttempt: true,
          wasAlreadyLimited: false,
          isMobile: isMobile,
        };
        console.log("[PAGE CLIENT LOG] Logging 'limit_hit_on_attempt' event. Data:", JSON.stringify(limitHitEventData));
        logAnalyticsEvent(limitHitEventData).catch(err => console.error("[PAGE ERROR] Failed to log 'limit_hit_on_attempt' event:", err));
    }
  };

  const handleEmailSubmitForBonus = async (email: string): Promise<boolean> => {
    setIsSubmittingEmailForBonus(true);
    setEmailForBonusError(null);

    const response = await saveContactDetailsAction({ email, consent: true });

    if (response.success) {
      // Log contact submission event immediately after successful save
      const contactEventData = {
        eventType: 'contact_details_submitted' as const,
        email: email,
        referralCode: storedReferralCode,
        isMobile: isMobile,
      };
      console.log("[PAGE CLIENT LOG] Logging 'contact_details_submitted' event. Data:", JSON.stringify(contactEventData));
      logAnalyticsEvent(contactEventData).catch(err => console.error("[PAGE ERROR] Failed to log 'contact_details_submitted' event:", err));

      // Now handle bonus generation logic
      const storedUsageString = localStorage.getItem(CLIENT_USAGE_STORAGE_KEY);
      const storedBonusString = localStorage.getItem(EMAIL_BONUS_STORAGE_KEY);
      const usage: ClientUsageData | null = storedUsageString ? JSON.parse(storedUsageString) : null;
      let bonusData: EmailBonusData | null = storedBonusString ? JSON.parse(storedBonusString) : null;

      // Ensure bonusData is initialized if it's somehow null (defensive)
      if (!bonusData) {
          bonusData = { grantedInCycleTimestamp: null };
          localStorage.setItem(EMAIL_BONUS_STORAGE_KEY, JSON.stringify(bonusData));
      }

      if (usage && bonusData) {
        if (bonusData.grantedInCycleTimestamp === usage.lastReset) {
          // Bonus already granted in this cycle
          toast({
            title: "Bonus Already Claimed",
            description: `You've already received your ${BONUS_GENERATIONS} bonus generations for this cycle.`,
          });
        } else {
          // Grant bonus
          const newRemaining = Math.min(usage.count + BONUS_GENERATIONS, CLIENT_MAX_GENERATIONS_PER_DAY_BASE + BONUS_GENERATIONS);
          const updatedUsage: ClientUsageData = { ...usage, count: newRemaining };
          localStorage.setItem(CLIENT_USAGE_STORAGE_KEY, JSON.stringify(updatedUsage));

          // Mark bonus as granted for this cycle
          const newBonusData: EmailBonusData = { grantedInCycleTimestamp: usage.lastReset };
          localStorage.setItem(EMAIL_BONUS_STORAGE_KEY, JSON.stringify(newBonusData));

          setRemainingGenerations(newRemaining);
          setMaxGenerations(CLIENT_MAX_GENERATIONS_PER_DAY_BASE + BONUS_GENERATIONS);

          toast({
            title: "Bonus Generations Added!",
            description: `You've got ${BONUS_GENERATIONS} more generations for this cycle. You're also subscribed for updates.`,
          });
        }
      } else {
        console.error("[PAGE ERROR] Usage or Bonus data missing in localStorage during email bonus handling.");
        toast({ variant: "destructive", title: "Client State Error", description: "Could not apply bonus due to an internal state issue. Please refresh and try again."});
      }
      
      setIsLimitReachedPopupOpen(false); // Close popup after handling
      setIsSubmittingEmailForBonus(false);
      return true; // For the outcome of saveContactDetailsAction

    } else { // saveContactDetailsAction failed
      setEmailForBonusError(response.error || "Could not save email. Please try again.");
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: response.error || "Could not save your email. Please try again.",
      });
      setIsSubmittingEmailForBonus(false);
      return false;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-grow container mx-auto px-4 md:px-6 py-8 md:py-12">
        <section className="max-w-6xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <p className="mt-2 text-xs text-muted-foreground/80">
              Try it out with {CLIENT_MAX_GENERATIONS_PER_DAY_BASE} free keyword generations daily, which reset every 24 hours. Reached your limit? You can get {BONUS_GENERATIONS} bonus generations.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-stretch">
            <div className="bg-card p-6 sm:p-8 rounded-xl shadow-xl h-full flex flex-col">
              <KeywordForm
                onSubmit={handleGenerateKeywords}
                isLoading={isLoading}
                remainingGenerations={remainingGenerations}
                maxGenerations={maxGenerations}
                resetTime={resetTime}
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
      <LimitReachedPopup
        isOpen={isLimitReachedPopupOpen}
        onClose={() => setIsLimitReachedPopupOpen(false)}
        resetTime={resetTime}
        referralCode={storedReferralCode}
        communityUrl={COMMUNITY_URL_PLACEHOLDER}
        privacyPolicyUrl={PRIVACY_POLICY_URL_PLACEHOLDER}
        onEmailSubmit={handleEmailSubmitForBonus}
        isSubmittingEmail={isSubmittingEmailForBonus}
        emailSubmissionError={emailForBonusError}
        bonusGenerationsCount={BONUS_GENERATIONS}
      />
    </div>
  );
}
