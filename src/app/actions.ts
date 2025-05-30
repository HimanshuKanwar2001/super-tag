
'use server';

import { suggestKeywords, type SuggestKeywordsInput, type SuggestKeywordsOutput } from '@/ai/flows/suggest-keywords';
import { z } from 'zod';

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
  eventType: 'keyword_generation_attempt' | 'keyword_generation_success' | 'keyword_generation_failure' | 'limit_hit_on_attempt' | 'already_limited_attempt';
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
 * Server Action to log analytics events.
 * This is a placeholder for actual Google Sheets integration.
 * Once Google Sheets API is set up, replace the console.log
 * with the code to write data to your Google Sheet.
 */
export async function logAnalyticsEvent(eventData: Omit<AnalyticsEventData, 'timestamp'>): Promise<void> {
  const completeEventData: AnalyticsEventData = {
    ...eventData,
    timestamp: new Date().toISOString(),
  };

  console.log('Analytics Event to Log:', JSON.stringify(completeEventData, null, 2));

  // =================================================================
  // TODO: GOOGLE SHEETS INTEGRATION
  //
  // 1. Ensure you have set up a Google Cloud Project, enabled the
  //    Google Sheets API, and created service account credentials (JSON).
  // 2. Store these credentials securely (e.g., in environment variables).
  // 3. Install the `googleapis` package: `npm install googleapis`
  // 4. Uncomment and adapt the example code below:
  //
  // import { google } from 'googleapis';
  //
  // try {
  //   const auth = new google.auth.GoogleAuth({
  //     credentials: {
  //       client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
  //       private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  //     },
  //     scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  //   });
  //
  //   const sheets = google.sheets({ version: 'v4', auth });
  //   const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID; // Your Spreadsheet ID
  //   const range = 'Sheet1!A:Z'; // The range where you want to append data
  //
  //   // Map completeEventData to the order of columns in your sheet
  //   const values = [[
  //     completeEventData.timestamp,
  //     completeEventData.eventType,
  //     completeEventData.inputMethod || '',
  //     completeEventData.platform || '',
  //     completeEventData.inputTextLength !== undefined ? completeEventData.inputTextLength : '',
  //     completeEventData.numberOfKeywordsGenerated !== undefined ? completeEventData.numberOfKeywordsGenerated : '',
  //     completeEventData.referralCode || '',
  //     completeEventData.dailyLimitReachedThisAttempt !== undefined ? completeEventData.dailyLimitReachedThisAttempt : '',
  //     completeEventData.wasAlreadyLimited !== undefined ? completeEventData.wasAlreadyLimited : '',
  //     completeEventData.isMobile !== undefined ? completeEventData.isMobile : '',
  //     completeEventData.errorMessage || '',
  //     // Add other fields as needed
  //   ]];
  //
  //   await sheets.spreadsheets.values.append({
  //     spreadsheetId,
  //     range,
  //     valueInputOption: 'USER_ENTERED',
  //     requestBody: {
  //       values,
  //     },
  //   });
  //   console.log('Successfully logged event to Google Sheet.');
  //
  // } catch (error) {
  //   console.error('Error logging event to Google Sheet:', error);
  //   // Decide if you want to throw the error or handle it silently
  // }
  // =================================================================
}
