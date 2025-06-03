
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

const CLIENT_MAX_GENERATIONS_PER_DAY_BASE = 5;
const BONUS_GENERATIONS = 5; // Changed from 15 to 5
const CLIENT_USAGE_STORAGE_KEY = 'keywordGeneratorUsage';
const REFERRAL_CODE_STORAGE_KEY = 'referralCodeData';
const EMAIL_BONUS_STORAGE_KEY = 'keywordGeneratorEmailBonusData'; // New key for bonus tracking
const REFERRAL_CODE_EXPIRY_DAYS = 30;
const COMMUNITY_URL_PLACEHOLDER = 'https://example.com/community'; // Remember to replace this!
const PRIVACY_POLICY_URL_PLACEHOLDER = '/privacy-policy'; // Remember to replace this!
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface ClientUsageData {
  count: number; // Remaining generations
  lastReset: number; // Timestamp of the last reset
}

interface ReferralCodeData {
  code: string;
  expiresAt: number; // Timestamp
}

interface EmailBonusData {
  grantedInCycleTimestamp: number | null; // Timestamp of the usage.lastReset when bonus was granted
}

export default function HomePage() {
  const [results, setResults] = useState<SuggestKeywordsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
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
    setRemainingGenerations(newUsage.count);
    setMaxGenerations(CLIENT_MAX_GENERATIONS_PER_DAY_BASE);
    setResetTime(newUsage.lastReset + ONE_DAY_MS);
    
    const newBonusData: EmailBonusData = { grantedInCycleTimestamp: null };
    localStorage.setItem(EMAIL_BONUS_STORAGE_KEY, JSON.stringify(newBonusData));
    
    setIsLimitReachedPopupOpen(false); 
    console.log("Client usage and bonus eligibility reset. Base generations remaining:", newUsage.count);
  }, []);


  const loadDataFromLocalStorage = useCallback(() => {
    const now = Date.now();
    let currentMaxGenerations = CLIENT_MAX_GENERATIONS_PER_DAY_BASE;
    let currentRemainingGenerations = CLIENT_MAX_GENERATIONS_PER_DAY_BASE;
    let currentResetTime = now + ONE_DAY_MS;

    // Load Usage Data
    try {
      const storedUsageString = localStorage.getItem(CLIENT_USAGE_STORAGE_KEY);
      let usage: ClientUsageData;

      if (storedUsageString) {
        usage = JSON.parse(storedUsageString);
        if (now < usage.lastReset + ONE_DAY_MS) { // Current cycle active
          currentRemainingGenerations = usage.count;
          currentResetTime = usage.lastReset + ONE_DAY_MS;

          // Check for bonus in this active cycle
          const storedBonusString = localStorage.getItem(EMAIL_BONUS_STORAGE_KEY);
          if (storedBonusString) {
            const bonusData: EmailBonusData = JSON.parse(storedBonusString);
            if (bonusData.grantedInCycleTimestamp === usage.lastReset) {
              currentMaxGenerations = CLIENT_MAX_GENERATIONS_PER_DAY_BASE + BONUS_GENERATIONS;
            }
          }
        } else { // Cycle expired
          console.log("Daily limit period expired, resetting usage.");
          resetClientUsage(); // This will set initial states
          // After resetClientUsage, values are set, so we can return early or let the below setters run with reset values.
          // For clarity, we'll let the state setters at the end handle it based on fresh reset values.
          // Re-fetch fresh values after reset.
          const freshUsageString = localStorage.getItem(CLIENT_USAGE_STORAGE_KEY);
          usage = freshUsageString ? JSON.parse(freshUsageString) : { count: CLIENT_MAX_GENERATIONS_PER_DAY_BASE, lastReset: now};
          currentRemainingGenerations = usage.count;
          currentResetTime = usage.lastReset + ONE_DAY_MS;
          currentMaxGenerations = CLIENT_MAX_GENERATIONS_PER_DAY_BASE;
        }
      } else { // No usage data, initialize
        console.log("No usage data found, initializing.");
        resetClientUsage();
        const freshUsageString = localStorage.getItem(CLIENT_USAGE_STORAGE_KEY);
        usage = freshUsageString ? JSON.parse(freshUsageString) : { count: CLIENT_MAX_GENERATIONS_PER_DAY_BASE, lastReset: now};
        currentRemainingGenerations = usage.count;
        currentResetTime = usage.lastReset + ONE_DAY_MS;
        currentMaxGenerations = CLIENT_MAX_GENERATIONS_PER_DAY_BASE;
      }
      setRemainingGenerations(currentRemainingGenerations);
      setMaxGenerations(currentMaxGenerations);
      setResetTime(currentResetTime);

    } catch (e) {
      console.error("Failed to load usage data from localStorage:", e);
      resetClientUsage(); 
    }

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
      logAnalyticsEvent({
        eventType: 'referral_code_applied', 
        referralCode: activeReferralCode,
        isMobile: isMobile,
      }).catch(console.error);
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
        }
      }
    }
    setStoredReferralCode(activeReferralCode);

  }, [isMobile, resetClientUsage]); 

  useEffect(() => {
    loadDataFromLocalStorage();
  }, [loadDataFromLocalStorage]);


  const recordClientGeneration = () => {
    const storedUsageString = localStorage.getItem(CLIENT_USAGE_STORAGE_KEY);
    if (!storedUsageString) {
      // This case should ideally be handled by loadDataFromLocalStorage initializing it.
      // If somehow it's null, reset and bail, or handle error appropriately.
      resetClientUsage();
      return CLIENT_MAX_GENERATIONS_PER_DAY_BASE -1 <= 0; // Assuming one generation was just used
    }
    const usage: ClientUsageData = JSON.parse(storedUsageString);
    const newCount = Math.max(0, usage.count - 1);
    
    const newUsage: ClientUsageData = { ...usage, count: newCount };
    localStorage.setItem(CLIENT_USAGE_STORAGE_KEY, JSON.stringify(newUsage));
    setRemainingGenerations(newCount);
    
    console.log("Generation recorded. Remaining:", newCount);
    return newCount <= 0; 
  };


  const handleGenerateKeywords = async (values: SuggestKeywordsInput) => {
    setError(null); 
    setResults(null); 

    setIsLoading(true);

    if (isMobile && resultsContainerRef.current) {
      resultsContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    // Re-check current remaining generations right before attempting
    const currentUsageString = localStorage.getItem(CLIENT_USAGE_STORAGE_KEY);
    const currentUsage: ClientUsageData = currentUsageString ? JSON.parse(currentUsageString) : { count: 0, lastReset: Date.now() };
    const localRemainingGenerations = currentUsage.count;

    const wasAlreadyLimited = localRemainingGenerations <= 0;

    if (wasAlreadyLimited) {
        setIsLimitReachedPopupOpen(true);
        setIsLoading(false); 
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
        setIsLimitReachedPopupOpen(true);
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

  const handleEmailSubmitForBonus = async (email: string): Promise<boolean> => {
    setIsSubmittingEmailForBonus(true);
    setEmailForBonusError(null);

    // We pass consent: true here, assuming the popup text covers the consent implication.
    const response = await saveContactDetailsAction({ email, consent: true });

    if (response.success) {
      toast({
        title: "Bonus Generations Added!",
        description: `You've got ${BONUS_GENERATIONS} more generations for this cycle. You're also subscribed for updates.`,
      });

      const storedUsageString = localStorage.getItem(CLIENT_USAGE_STORAGE_KEY);
      if (storedUsageString) {
        const usage: ClientUsageData = JSON.parse(storedUsageString);
        const newRemaining = Math.min(usage.count + BONUS_GENERATIONS, CLIENT_MAX_GENERATIONS_PER_DAY_BASE + BONUS_GENERATIONS);
        
        const updatedUsage: ClientUsageData = { ...usage, count: newRemaining };
        localStorage.setItem(CLIENT_USAGE_STORAGE_KEY, JSON.stringify(updatedUsage));
        
        const newBonusData: EmailBonusData = { grantedInCycleTimestamp: usage.lastReset };
        localStorage.setItem(EMAIL_BONUS_STORAGE_KEY, JSON.stringify(newBonusData));

        setRemainingGenerations(newRemaining);
        setMaxGenerations(CLIENT_MAX_GENERATIONS_PER_DAY_BASE + BONUS_GENERATIONS);
      }
      
      logAnalyticsEvent({
        eventType: 'contact_details_submitted', // Could add a specific eventType for bonus if needed
        email: email,
        referralCode: storedReferralCode,
        isMobile: isMobile,
        // custom_field_source: 'bonus_popup' // Example if you want to distinguish
      }).catch(console.error);

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


  const handleSubscribe = async (values: SubscribeFormValues) => {
    setIsSubmittingContact(true);
    const response = await saveContactDetailsAction(values);
    if (response.success) {
      toast({
        title: "Subscribed!",
        description: "Thanks for subscribing. We'll keep you updated.",
      });
      logAnalyticsEvent({
        eventType: 'contact_details_submitted',
        isMobile: isMobile,
        referralCode: storedReferralCode,
        email: values.email, 
        phone: values.phone || '',
        // custom_field_source: 'subscribe_form' // Example
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
              (Base daily usage limit of {CLIENT_MAX_GENERATIONS_PER_DAY_BASE} generations stored in browser, resets every 24 hours. Option for {BONUS_GENERATIONS} bonus generations available if limit hit.)
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

    