
'use server';

import { suggestKeywords, type SuggestKeywordsInput, type SuggestKeywordsOutput } from '@/ai/flows/suggest-keywords';
import { z } from 'zod';
import { google } from 'googleapis';

const ActionInputSchema = z.object({
  inputMethod: z.enum(['caption', 'script', 'title']),
  inputText: z.string().min(10, { message: "Input text must be at least 10 characters long."}),
  platform: z.enum(['youtube shorts', 'instagram reels', 'tiktok', 'linkedin video']),
});

export async function getKeywordsAction(
  data: SuggestKeywordsInput
): Promise<
  { success: true; data: SuggestKeywordsOutput } | 
  { success: false; error: string }
> {
  const validationResult = ActionInputSchema.safeParse(data);
  if (!validationResult.success) {
    return { 
      success: false, 
      error: validationResult.error.errors.map(e => e.message).join(', ')
    };
  }

  try {
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
  } catch (error) {
    console.error('Error in getKeywordsAction:', error);
    let errorMessage = 'An unexpected error occurred while generating keywords.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { 
      success: false, 
      error: errorMessage
    };
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
  console.log('Analytics Event to Log:', JSON.stringify(completeEventData, null, 2));

  if (!process.env.GOOGLE_SHEETS_CLIENT_EMAIL || !process.env.GOOGLE_SHEETS_PRIVATE_KEY || !process.env.GOOGLE_SPREADSHEET_ID) {
    console.warn('Google Sheets API credentials or Spreadsheet ID are not set in environment variables. Skipping Google Sheets logging.');
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
    console.error('Error logging event to Google Sheet:', error);
    // Decide if you want to re-throw the error or handle it silently for the client
    // For now, we just log it, the client operation shouldn't fail due to analytics logging failure.
  }
}
