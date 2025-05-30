
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
      logAnalyticsEvent({
        eventType: 'keyword_generation_failure',
        inputMethod: data.inputMethod,
        platform: data.platform,
        inputTextLength: data.inputText?.length || 0,
        errorMessage: `Validation Error: ${errorMessage}`,
      }).catch(err => {
        console.error("Failed to log validation_failure event:", err);
      });
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
      return {
        success: false,
        error: 'Failed to generate keywords. The AI returned an unexpected result.'
      };
    }
  } catch (e: any) {
    console.error("Outer unhandled error in getKeywordsAction:", e);
    let errorMessage = 'An unexpected error occurred while generating keywords.';
    if (e instanceof Error) {
        errorMessage = e.message;
    }
    // Log critical failure event, but try to get data from the input if possible
     logAnalyticsEvent({
        eventType: 'keyword_generation_failure',
        errorMessage: `Critical Action Error: ${errorMessage}`,
        inputMethod: data?.inputMethod,
        platform: data?.platform,
        inputTextLength: data?.inputText?.length,
      }).catch(err => {
          console.error("Failed to log critical_failure event:", err);
      });
    return { success: false, error: "An unexpected server error occurred." };
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
      phone: phone || '', // Ensure phone is a string, even if empty
      // Add any other relevant analytics data here, e.g., referralCode if available client-side
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
    // Optionally, log this failure to analytics as well, but without PII
    logAnalyticsEvent({
      eventType: 'keyword_generation_failure', // Re-using this, or create a new 'contact_submission_failure'
      errorMessage: `Error in saveContactDetailsAction: ${error.message || 'Unknown error'}`,
    }).catch(err => {
      console.error("Failed to log contact_submission_failure event:", err);
    });
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
  email?: string; // New field for email
  phone?: string; // New field for phone
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
    // Updated range to include new columns for email and phone (A to M for 13 columns)
    const range = 'Sheet1!A:M';

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
      completeEventData.email || '', // New: Email
      completeEventData.phone || '', // New: Phone
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
  }
}
