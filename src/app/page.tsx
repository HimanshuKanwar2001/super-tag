
<<<<<<< HEAD
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Zap, ShieldCheck } from 'lucide-react';

export default function RootPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
      {/* Header section removed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full mt-12"> {/* Added mt-12 for some top spacing */}
        <div className="bg-card p-8 rounded-xl shadow-xl flex flex-col items-center text-center">
          <ShieldCheck className="h-16 w-16 text-primary mb-6" />
          {/* <h2 className="text-3xl font-semibold mb-3">Standard Access</h2> */}
          {/* <p className="text-muted-foreground mb-8">
            Get 5 free keyword generations daily, with an option for bonus generations. Perfect for regular use.
          </p> */}
          <Link href="/limit" legacyBehavior passHref>
            <Button size="lg" className="w-full mt-auto"> {/* Added mt-auto to push button down if space allows */}
              Go to Standard Version
            </Button>
          </Link>
        </div>

        <div className="bg-card p-8 rounded-xl shadow-xl flex flex-col items-center text-center">
          <Zap className="h-16 w-16 text-accent mb-6" />
          <h2 className="text-3xl font-semibold mb-3">Unlimited Access</h2>
          <p className="text-muted-foreground mb-8">
            Enjoy unlimited keyword generations. Ideal for extensive research and power users.
          </p>
          <Link href="/free" legacyBehavior passHref>
            <Button size="lg" variant="outline" className="w-full border-accent text-accent hover:bg-accent/10">
              Go to Unlimited Version
            </Button>
          </Link>
        </div>
      </div>

      <footer className="mt-16 text-center text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} ReelRank Keywords. All rights reserved.</p>
        <p className="mt-1">
          <Link href="/privacy-policy" className="underline hover:text-primary">Privacy Policy</Link>
        </p>
      </footer>
=======
'use client';

import type React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { KeywordForm } from '@/components/keyword-form';
import { KeywordResults } from '@/components/keyword-results';
import { getKeywordsAction, logAnalyticsEvent, saveContactDetailsAction } from '@/app/actions';
import type { SuggestKeywordsInput, SuggestKeywordsOutput } from '@/ai/flows/suggest-keywords';
import { useToast } from "@/hooks/use-toast";
import { LimitReachedPopup } from '@/components/limit-reached-popup';
import { useIsMobile } from '@/hooks/use-mobile';
import { AppHeader } from '@/components/layout/header';

const CLIENT_MAX_GENERATIONS_PER_DAY_BASE = 5;
const BONUS_GENERATIONS = 5;
const CLIENT_USAGE_STORAGE_KEY_LIMIT = 'keywordGeneratorUsage_limit';
const REFERRAL_CODE_STORAGE_KEY_LIMIT = 'referralCodeData_limit';
const EMAIL_BONUS_STORAGE_KEY_LIMIT = 'keywordGeneratorEmailBonusData_limit';
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

interface EmailBonusData {
  grantedInCycleTimestamp: number | null;
}

export default function HomePage() { // Renamed from LimitedHomePage
  const [results, setResults] = useState<SuggestKeywordsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [remainingGenerations, setRemainingGenerations] = useState<number>(CLIENT_MAX_GENERATIONS_PER_DAY_BASE);
  const [maxGenerations, setMaxGenerations] = useState<number>(CLIENT_MAX_GENERATIONS_PER_DAY_BASE);
  const [resetTime, setResetTime] = useState<number | undefined>(undefined);
  const [isLimitReachedPopupOpen, setIsLimitReachedPopupOpen] = useState(false);
  const [bonusClaimedThisCycle, setBonusClaimedThisCycle] = useState(false);

  const [storedReferralCode, setStoredReferralCode] = useState<string | null>(null);

  const [isSubmittingEmailForBonus, setIsSubmittingEmailForBonus] = useState(false);
  const [emailForBonusError, setEmailForBonusError] = useState<string | null>(null);

  const { toast } = useToast();
  const isMobile = useIsMobile();
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  const resetClientUsage = useCallback(() => {
    const now = Date.now();
    const newUsage: ClientUsageData = { count: CLIENT_MAX_GENERATIONS_PER_DAY_BASE, lastReset: now };
    localStorage.setItem(CLIENT_USAGE_STORAGE_KEY_LIMIT, JSON.stringify(newUsage));
    
    const newBonusData: EmailBonusData = { grantedInCycleTimestamp: null };
    localStorage.setItem(EMAIL_BONUS_STORAGE_KEY_LIMIT, JSON.stringify(newBonusData));

    setRemainingGenerations(newUsage.count);
    setMaxGenerations(CLIENT_MAX_GENERATIONS_PER_DAY_BASE);
    setResetTime(newUsage.lastReset + ONE_DAY_MS);
    setBonusClaimedThisCycle(false);

    setIsLimitReachedPopupOpen(false);
  }, []);


  const loadDataFromLocalStorage = useCallback(() => {
    const now = Date.now();
    let currentMaxGenerations = CLIENT_MAX_GENERATIONS_PER_DAY_BASE;
    let currentRemainingGenerations = CLIENT_MAX_GENERATIONS_PER_DAY_BASE;
    let currentResetTime = now + ONE_DAY_MS;
    let currentBonusClaimed = false;

    if (!localStorage.getItem(EMAIL_BONUS_STORAGE_KEY_LIMIT)) {
      const initialBonusData: EmailBonusData = { grantedInCycleTimestamp: null };
      localStorage.setItem(EMAIL_BONUS_STORAGE_KEY_LIMIT, JSON.stringify(initialBonusData));
    }

    try {
      const storedUsageString = localStorage.getItem(CLIENT_USAGE_STORAGE_KEY_LIMIT);
      let usage: ClientUsageData;

      if (storedUsageString) {
        usage = JSON.parse(storedUsageString);
        if (now < usage.lastReset + ONE_DAY_MS) {
          currentRemainingGenerations = usage.count;
          currentResetTime = usage.lastReset + ONE_DAY_MS;

          const storedBonusString = localStorage.getItem(EMAIL_BONUS_STORAGE_KEY_LIMIT);
          if (storedBonusString) {
            const bonusData: EmailBonusData = JSON.parse(storedBonusString);
            if (bonusData.grantedInCycleTimestamp === usage.lastReset) {
              currentMaxGenerations = CLIENT_MAX_GENERATIONS_PER_DAY_BASE + BONUS_GENERATIONS;
              currentBonusClaimed = true;
            }
          }
        } else {
          resetClientUsage();
          const freshUsageString = localStorage.getItem(CLIENT_USAGE_STORAGE_KEY_LIMIT);
          usage = freshUsageString ? JSON.parse(freshUsageString) : { count: CLIENT_MAX_GENERATIONS_PER_DAY_BASE, lastReset: now };
          currentRemainingGenerations = usage.count;
          currentResetTime = usage.lastReset + ONE_DAY_MS;
        }
      } else {
        resetClientUsage();
        const freshUsageString = localStorage.getItem(CLIENT_USAGE_STORAGE_KEY_LIMIT);
        usage = freshUsageString ? JSON.parse(freshUsageString) : { count: CLIENT_MAX_GENERATIONS_PER_DAY_BASE, lastReset: now };
        currentRemainingGenerations = usage.count;
        currentResetTime = usage.lastReset + ONE_DAY_MS;
      }
      setRemainingGenerations(currentRemainingGenerations);
      setMaxGenerations(currentMaxGenerations);
      setResetTime(currentResetTime);
      setBonusClaimedThisCycle(currentBonusClaimed);

    } catch (e) {
      console.error("[PAGE ERROR /] Failed to load usage/bonus data from localStorage:", e); // Updated path
      resetClientUsage();
    }

    const queryParams = new URLSearchParams(window.location.search);
    const urlReferralCode = queryParams.get('referralCode');
    let activeReferralCode: string | null = null;
    let newlyAppliedByUrl = false;

    if (urlReferralCode) {
      const newReferralData: ReferralCodeData = {
        code: urlReferralCode,
        expiresAt: now + REFERRAL_CODE_EXPIRY_DAYS * ONE_DAY_MS,
      };
      localStorage.setItem(REFERRAL_CODE_STORAGE_KEY_LIMIT, JSON.stringify(newReferralData));
      activeReferralCode = urlReferralCode;
      newlyAppliedByUrl = true;
    } else {
      const storedReferralString = localStorage.getItem(REFERRAL_CODE_STORAGE_KEY_LIMIT);
      if (storedReferralString) {
        try {
          const storedData: ReferralCodeData = JSON.parse(storedReferralString);
          if (now < storedData.expiresAt) {
            activeReferralCode = storedData.code;
          } else {
            localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY_LIMIT);
          }
        } catch (e) {
          localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY_LIMIT);
          console.error("[PAGE ERROR /] Error parsing referralCodeData_limit, removed from localStorage:", e); // Updated path
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
        localStorage.setItem(REFERRAL_CODE_STORAGE_KEY_LIMIT, JSON.stringify(newReferralData));
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
        console.log("[PAGE CLIENT LOG /] Logging 'referral_code_applied' event. Data:", JSON.stringify(eventData)); // Updated path
        logAnalyticsEvent(eventData).catch(err => console.error("[PAGE ERROR /] Failed to log 'referral_code_applied' event:", err)); // Updated path
    }
    setStoredReferralCode(activeReferralCode);

  }, [isMobile, resetClientUsage]);

  useEffect(() => {
    loadDataFromLocalStorage();

    const handleReferralCodeUpdate = (event: Event) => {
      console.log("[PAGE CLIENT LOG /] 'referralCodeUpdated' event received. Reloading data from localStorage."); // Updated path
      loadDataFromLocalStorage();
    };

    window.addEventListener('referralCodeUpdated', handleReferralCodeUpdate);

    return () => {
      window.removeEventListener('referralCodeUpdated', handleReferralCodeUpdate);
    };
  }, [loadDataFromLocalStorage]);


  const recordClientGeneration = () => {
    const storedUsageString = localStorage.getItem(CLIENT_USAGE_STORAGE_KEY_LIMIT);
    if (!storedUsageString) {
      resetClientUsage(); 
      return CLIENT_MAX_GENERATIONS_PER_DAY_BASE -1 <= 0;
    }
    const usage: ClientUsageData = JSON.parse(storedUsageString);
    const newCount = Math.max(0, usage.count - 1);

    const newUsage: ClientUsageData = { ...usage, count: newCount };
    localStorage.setItem(CLIENT_USAGE_STORAGE_KEY_LIMIT, JSON.stringify(newUsage));
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

    const currentUsageString = localStorage.getItem(CLIENT_USAGE_STORAGE_KEY_LIMIT);
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
        console.log("[PAGE CLIENT LOG /] Logging 'already_limited_attempt' event. Data:", JSON.stringify(eventData)); // Updated path
        logAnalyticsEvent(eventData).catch(err => console.error("[PAGE ERROR /] Failed to log 'already_limited_attempt' event:", err)); // Updated path
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
    console.log("[PAGE CLIENT LOG /] Logging 'keyword_generation_attempt' event. Data:", JSON.stringify(attemptEventData)); // Updated path
    logAnalyticsEvent(attemptEventData).catch(err => console.error("[PAGE ERROR /] Failed to log 'keyword_generation_attempt' event:", err)); // Updated path

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
      console.log("[PAGE CLIENT LOG /] Logging 'keyword_generation_success' event. Data:", JSON.stringify(successEventData)); // Updated path
      logAnalyticsEvent(successEventData).catch(err => console.error("[PAGE ERROR /] Failed to log 'keyword_generation_success' event:", err)); // Updated path
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
      console.log("[PAGE CLIENT LOG /] Logging 'keyword_generation_failure' event. Data:", JSON.stringify(failureEventData)); // Updated path
      logAnalyticsEvent(failureEventData).catch(err => console.error("[PAGE ERROR /] Failed to log 'keyword_generation_failure' event:", err)); // Updated path
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
        console.log("[PAGE CLIENT LOG /] Logging 'limit_hit_on_attempt' event. Data:", JSON.stringify(limitHitEventData)); // Updated path
        logAnalyticsEvent(limitHitEventData).catch(err => console.error("[PAGE ERROR /] Failed to log 'limit_hit_on_attempt' event:", err)); // Updated path
    }
  };

  const handleEmailSubmitForBonus = async (email: string): Promise<boolean> => {
    setIsSubmittingEmailForBonus(true);
    setEmailForBonusError(null);

    const response = await saveContactDetailsAction({ email, consent: true });

    if (response.success) {
      const contactEventData = {
        eventType: 'contact_details_submitted' as const,
        email: email,
        referralCode: storedReferralCode,
        isMobile: isMobile,
      };
      console.log("[PAGE CLIENT LOG /] Logging 'contact_details_submitted' event. Data:", JSON.stringify(contactEventData)); // Updated path
      logAnalyticsEvent(contactEventData).catch(err => console.error("[PAGE ERROR /] Failed to log 'contact_details_submitted' event:", err)); // Updated path

      const storedUsageString = localStorage.getItem(CLIENT_USAGE_STORAGE_KEY_LIMIT);
      const storedBonusString = localStorage.getItem(EMAIL_BONUS_STORAGE_KEY_LIMIT);
      const usage: ClientUsageData | null = storedUsageString ? JSON.parse(storedUsageString) : null;
      let bonusData: EmailBonusData | null = storedBonusString ? JSON.parse(storedBonusString) : null;

      if (!bonusData) {
          bonusData = { grantedInCycleTimestamp: null };
          localStorage.setItem(EMAIL_BONUS_STORAGE_KEY_LIMIT, JSON.stringify(bonusData));
      }

      if (usage && bonusData) {
        if (bonusData.grantedInCycleTimestamp === usage.lastReset) {
          toast({
            title: "Bonus Already Claimed",
            description: `You've already received your ${BONUS_GENERATIONS} bonus generations for this cycle.`,
          });
          setBonusClaimedThisCycle(true); 
        } else {
          const newRemaining = Math.min(usage.count + BONUS_GENERATIONS, CLIENT_MAX_GENERATIONS_PER_DAY_BASE + BONUS_GENERATIONS);
          const updatedUsage: ClientUsageData = { ...usage, count: newRemaining };
          localStorage.setItem(CLIENT_USAGE_STORAGE_KEY_LIMIT, JSON.stringify(updatedUsage));

          const newBonusData: EmailBonusData = { grantedInCycleTimestamp: usage.lastReset };
          localStorage.setItem(EMAIL_BONUS_STORAGE_KEY_LIMIT, JSON.stringify(newBonusData));

          setRemainingGenerations(newRemaining);
          setMaxGenerations(CLIENT_MAX_GENERATIONS_PER_DAY_BASE + BONUS_GENERATIONS);
          setBonusClaimedThisCycle(true);

          toast({
            title: "Bonus Generations Added!",
            description: `You've got ${BONUS_GENERATIONS} more generations for this cycle. You're also subscribed for updates.`,
          });
        }
      } else {
        console.error("[PAGE ERROR /] Usage or Bonus data missing in localStorage during email bonus handling."); // Updated path
        toast({ variant: "destructive", title: "Client State Error", description: "Could not apply bonus due to an internal state issue. Please refresh and try again."});
      }
      
      setIsLimitReachedPopupOpen(false); 
      setIsSubmittingEmailForBonus(false);
      return true; 

    } else { 
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
       <AppHeader />
      <main className="flex-grow container mx-auto px-4 md:px-6 py-8 md:py-12">
        <section className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 items-stretch">
            <div className="bg-card p-6 sm:p-8 rounded-xl shadow-xl h-full flex flex-col">
              <KeywordForm
                onSubmit={handleGenerateKeywords}
                isLoading={isLoading}
                remainingGenerations={remainingGenerations}
                maxGenerations={maxGenerations}
                resetTime={resetTime}
                isUnlimited={false}
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
        bonusAlreadyClaimed={bonusClaimedThisCycle}
      />
>>>>>>> 3bb97a2 (i dont want any buttons to redirections just show the limit one as defau)
    </div>
  );
}

    