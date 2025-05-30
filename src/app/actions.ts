
'use server';

import { suggestKeywords, type SuggestKeywordsInput, type SuggestKeywordsOutput } from '@/ai/flows/suggest-keywords';
import { z } from 'zod';
import { google } from 'googleapis';

const ActionInputSchema = z.object({
  inputMethod: z.enum(['caption', 'script', 'title']),
  inputText: z.string().min(10, { message: "Input text must be at least 10 characters long."}).max(2000, { message: "Input text must not exceed 2000 characters."}),
  platform: z.enum(['youtube shorts', 'instagram reels', 'tiktok', 'linkedin video']),
});

export async function getKeywordsAction(
  data: SuggestKeywordsInput
): Promise<
  { success: true; data: SuggestKeywordsOutput } | 
  { success: false; error: string }
> {
  try { // Outer try-catch for the entire action
    const validationResult = ActionInputSchema.safeParse(data);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => e.message).join(', ');
      // Log validation failure event
      logAnalyticsEvent({
        eventType: 'keyword_generation_failure', // Or a more specific eventType for validation
        inputMethod: data.inputMethod,
        platform: data.platform,
        inputTextLength: data.inputText?.length || 0,
        errorMessage: `Validation Error: ${errorMessage}`,
        // referralCode, isMobile, etc. might not be readily available here without passing more context
        // or making them part of the 'data' object if needed for this specific log.
      }).catch(err => {
        console.error("Failed to log validation_failure event:", err);
      });
      return { 
        success: false, 
        error: errorMessage
      };
    }

    try {
      const result = await suggestKeywords(validationResult.data);
      if (result && result.keywords) {
        // Log success event (fire and forget, but catch errors)
        logAnalyticsEvent({
          eventType: 'keyword_generation_success',
          inputMethod: validationResult.data.inputMethod,
          platform: validationResult.data.platform,
          inputTextLength: validationResult.data.inputText.length,
          numberOfKeywordsGenerated: result.keywords.length,
          // Pass other relevant fields like referralCode and isMobile if available from client state
          // For now, these are not passed directly to getKeywordsAction
        }).catch(err => {
          console.error("Failed to log keyword_generation_success event:", err);
        });
        return { 
          success: true, 
          data: result
        };
      } else {
        // Log failure event for unexpected AI result
        logAnalyticsEvent({
          eventType: 'keyword_generation_failure',
          inputMethod: validationResult.data.inputMethod,
          platform: validationResult.data.platform,
          inputTextLength: validationResult.data.inputText.length,
          errorMessage: 'Failed to generate keywords. The AI returned an unexpected result.',
        }).catch(err => {
          console.error("Failed to log keyword_generation_failure (unexpected AI result) event:", err);
        });
        return { 
          success: false, 
          error: 'Failed to generate keywords. The AI returned an unexpected result.'
        };
      }
    } catch (error: any) { // Catch errors from suggestKeywords
      console.error('Error in suggestKeywords call within getKeywordsAction:', error);
      let errorMessage = 'An unexpected error occurred while generating keywords.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      // Log failure event for error during AI call
      logAnalyticsEvent({
        eventType: 'keyword_generation_failure',
        inputMethod: validationResult.data.inputMethod,
        platform: validationResult.data.platform,
        inputTextLength: validationResult.data.inputText.length,
        errorMessage: errorMessage,
      }).catch(err => {
        console.error("Failed to log keyword_generation_failure (AI call error) event:", err);
      });
      return { 
        success: false, 
        error: errorMessage
      };
    }
  } catch (e: any) { // Catch any other unhandled errors in getKeywordsAction
    console.error("Outer unhandled error in getKeywordsAction:", e);
    // Log critical failure event
    logAnalyticsEvent({
      eventType: 'keyword_generation_failure',
      errorMessage: `Critical Action Error: ${e.message || 'Unknown error'}`,
      // Include as much context as possible if available
      inputMethod: data?.inputMethod,
      platform: data?.platform,
      inputTextLength: data?.inputText?.length,
    }).catch(err => {
        console.error("Failed to log critical_failure event:", err);
    });
    return { success: false, error: "An unexpected server error occurred." };
  }
}

// Define the types for the analytics event data
interface AnalyticsEventData {
  timestamp: string;
  eventType: 'keyword_generation_attempt' | 'keyword_generation_success' | 'keyword_generation_failure' | 'limit_hit_on_attempt' | 'already_limited_attempt' | 'referral_code_applied';
  inputMethod?: SuggestKeywordsInput['inputMethod'];
  platform?: SuggestKeywordsInput['platform'];
  inputTextLength?: number;
  numberOfKeywordsGenerated?: number;
  referralCode?: string | null;
  dailyLimitReachedThisAttempt?: boolean;
  wasAlreadyLimited?: boolean;
  isMobile?: boolean;
  errorMessage?: string;
}

/**
 * Server Action to log analytics events to Google Sheets.
 */
export async function logAnalyticsEvent(eventData: Omit<AnalyticsEventData, 'timestamp'>): Promise<void> {
  const completeEventData: AnalyticsEventData = {
    ...eventData,
    timestamp: new Date().toISOString(),
  };

  // Log to console for debugging, regardless of Sheets integration success/failure
  console.log('Attempting to log analytics event:', JSON.stringify(completeEventData, null, 2));

  if (typeof process.env.GOOGLE_SHEETS_CLIENT_EMAIL !== 'string' || process.env.GOOGLE_SHEETS_CLIENT_EMAIL.trim() === '' ||
      typeof process.env.GOOGLE_SHEETS_PRIVATE_KEY !== 'string' || process.env.GOOGLE_SHEETS_PRIVATE_KEY.trim() === '' ||
      typeof process.env.GOOGLE_SPREADSHEET_ID !== 'string' || process.env.GOOGLE_SPREADSHEET_ID.trim() === '') {
    console.warn('Google Sheets API credentials or Spreadsheet ID are not set or empty in environment variables. Skipping Google Sheets logging.');
    return;
  }
  // This specific placeholder check might be redundant if the ID is correctly set, but harmless
  if (process.env.GOOGLE_SPREADSHEET_ID === "YOUR_SPREADSHEET_ID_HERE") {
    console.warn('GOOGLE_SPREADSHEET_ID is still set to placeholder. Skipping Google Sheets logging.');
    return;
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
        // Ensure private key newlines are correctly interpreted
        private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    // Assumes your sheet is named "Sheet1" and you want to append to the first 11 columns (A to K)
    const range = 'Sheet1!A:K'; 

    const values = [[
      completeEventData.timestamp,
      completeEventData.eventType,
      completeEventData.inputMethod || '',
      completeEventData.platform || '',
      completeEventData.inputTextLength !== undefined ? completeEventData.inputTextLength : '',
      completeEventData.numberOfKeywordsGenerated !== undefined ? completeEventData.numberOfKeywordsGenerated : '',
      completeEventData.referralCode || '',
      completeEventData.dailyLimitReachedThisAttempt !== undefined ? completeEventData.dailyLimitReachedThisAttempt : '',
      completeEventData.wasAlreadyLimited !== undefined ? completeEventData.wasAlreadyLimited : '',
      completeEventData.isMobile !== undefined ? completeEventData.isMobile : '',
      completeEventData.errorMessage || '',
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED', // Or 'RAW' if you don't want Sheets to parse values like dates/numbers
      requestBody: {
        values,
      },
    });
    console.log('Successfully logged event to Google Sheet.');

  } catch (error) {
    console.error('Error during Google Sheets API interaction in logAnalyticsEvent:', error);
    // We will not re-throw here to ensure the calling action doesn't necessarily fail
    // if analytics logging fails. The error is logged for server-side debugging.
  }
}
