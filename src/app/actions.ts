
'use server';

import { suggestKeywords, type SuggestKeywordsInput, type SuggestKeywordsOutput } from '@/ai/flows/suggest-keywords';
import { z } from 'zod';
import { google } from 'googleapis';

const KeywordActionInputSchema = z.object({
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
  try {
    const validationResult = KeywordActionInputSchema.safeParse(data);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => e.message).join(', ');
      try {
        await logAnalyticsEvent({
          eventType: 'keyword_generation_failure',
          inputMethod: data.inputMethod,
          platform: data.platform,
          inputTextLength: data.inputText?.length || 0,
          errorMessage: `Validation Error: ${errorMessage}`,
        });
      } catch (logErr) {
        console.error("Failed to log validation_failure event:", logErr);
      }
      return {
        success: false,
        error: errorMessage
      };
    }

    const result = await suggestKeywords(validationResult.data);
    if (result && result.keywords) {
      return {
        success: true,
        data: result
      };
    } else {
      // It's good practice to log if the AI returned an unexpected (but not erroring) result
      try {
        await logAnalyticsEvent({
          eventType: 'keyword_generation_failure',
          inputMethod: validationResult.data.inputMethod,
          platform: validationResult.data.platform,
          inputTextLength: validationResult.data.inputText.length,
          errorMessage: 'AI returned unexpected result (no keywords or falsy result)',
        });
      } catch (logErr) {
          console.error("Failed to log AI unexpected result event:", logErr);
      }
      return {
        success: false,
        error: 'Failed to generate keywords. The AI returned an unexpected result.'
      };
    }
  } catch (e: any) {
    console.error("Outer unhandled error in getKeywordsAction:", e);

    let originalErrorMessage = "Unknown error from action";
    if (e instanceof Error) {
      originalErrorMessage = e.message;
    } else if (typeof e === 'string') {
      originalErrorMessage = e;
    } else {
      try {
        originalErrorMessage = JSON.stringify(e);
      } catch {
        originalErrorMessage = String(e);
      }
    }

    // Attempt to log the failure, but don't let this logging crash the action
    try {
      await logAnalyticsEvent({
        eventType: 'keyword_generation_failure',
        errorMessage: `Critical Action Error: ${originalErrorMessage}`,
        inputMethod: data?.inputMethod, // data might be null if error happened before validation
        platform: data?.platform,
        inputTextLength: data?.inputText?.length,
      });
    } catch (loggingError: any) {
      console.error("Failed to log critical_failure event during getKeywordsAction error handling. Logging error: ", loggingError?.message || String(loggingError));
    }
    // ALWAYS return a JSON response
    return { success: false, error: "An unexpected server error occurred while generating keywords. Please try again." };
  }
}

const SubscribeActionInputSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  phone: z.string().optional().or(z.literal('')), // Optional, can be empty string
  consent: z.boolean().refine(val => val === true, { message: "You must agree to the terms to subscribe." }),
});

export async function saveContactDetailsAction(
  data: z.infer<typeof SubscribeActionInputSchema>
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const validationResult = SubscribeActionInputSchema.safeParse(data);
    if (!validationResult.success) {
      return { success: false, error: validationResult.error.errors.map(e => e.message).join(', ') };
    }

    const { email, phone } = validationResult.data;

    // Log to Google Sheets
    await logAnalyticsEvent({
      eventType: 'contact_details_submitted',
      email: email,
      phone: phone || '', 
    });

    console.log('Contact Details Submitted & Logged:');
    console.log('Email:', email);
    if (phone) {
      console.log('Phone:', phone);
    }
    console.log('Reminder: PII (email, phone) is now being sent to your analytics Google Sheet.');
    console.log('For production, consider a separate, secure datastore for PII.');


    return { success: true };
  } catch (error: any) {
    console.error('Error in saveContactDetailsAction:', error);
    const originalErrorMessage = error.message || 'Unknown error in saveContactDetailsAction';
    try {
        await logAnalyticsEvent({
        eventType: 'keyword_generation_failure', 
        errorMessage: `Error in saveContactDetailsAction: ${originalErrorMessage}`,
        });
    } catch (logErr: any) {
        console.error("Failed to log contact_submission_failure event. Logging error:", logErr?.message || String(logErr));
    }
    return { success: false, error: 'An unexpected server error occurred while saving your details.' };
  }
}


// Define the types for the analytics event data
interface AnalyticsEventData {
  timestamp: string;
  eventType: 'keyword_generation_attempt' | 'keyword_generation_success' | 'keyword_generation_failure' | 'limit_hit_on_attempt' | 'already_limited_attempt' | 'referral_code_applied' | 'contact_details_submitted';
  inputMethod?: SuggestKeywordsInput['inputMethod'];
  platform?: SuggestKeywordsInput['platform'];
  inputTextLength?: number;
  numberOfKeywordsGenerated?: number;
  referralCode?: string | null;
  dailyLimitReachedThisAttempt?: boolean;
  wasAlreadyLimited?: boolean;
  isMobile?: boolean;
  errorMessage?: string;
  email?: string; 
  phone?: string; 
}

/**
 * Server Action to log analytics events to Google Sheets.
 */
export async function logAnalyticsEvent(eventData: Omit<AnalyticsEventData, 'timestamp'>): Promise<void> {
  const completeEventData: AnalyticsEventData = {
    ...eventData,
    timestamp: new Date().toISOString(),
  };

  console.log('Attempting to log analytics event:', JSON.stringify(completeEventData, null, 2));

  if (typeof process.env.GOOGLE_SHEETS_CLIENT_EMAIL !== 'string' || process.env.GOOGLE_SHEETS_CLIENT_EMAIL.trim() === '' ||
      typeof process.env.GOOGLE_SHEETS_PRIVATE_KEY !== 'string' || process.env.GOOGLE_SHEETS_PRIVATE_KEY.trim() === '' ||
      typeof process.env.GOOGLE_SPREADSHEET_ID !== 'string' || process.env.GOOGLE_SPREADSHEET_ID.trim() === '') {
    console.warn('Google Sheets API credentials or Spreadsheet ID are not set or empty in environment variables. Skipping Google Sheets logging.');
    return;
  }
  if (process.env.GOOGLE_SPREADSHEET_ID === "YOUR_SPREADSHEET_ID_HERE") {
    console.warn('GOOGLE_SPREADSHEET_ID is still set to placeholder. Skipping Google Sheets logging.');
    return;
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    const range = 'Sheet1!A:M'; // Adjusted for 13 columns (A to M)

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
      completeEventData.email || '', 
      completeEventData.phone || '', 
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });
    console.log('Successfully logged event to Google Sheet.');

  } catch (error: any) {
    console.error('Error during Google Sheets API interaction in logAnalyticsEvent:', error);
    if (error.response && error.response.data && error.response.data.error) {
      console.error('Google API Error Details:', JSON.stringify(error.response.data.error, null, 2));
    }
    // Do not re-throw here, let the calling function decide how to handle failed logging
  }
}

