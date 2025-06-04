
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
        // console.log("[ACTION DEBUG] Logging validation_failure event from getKeywordsAction");
        await logAnalyticsEvent({
          eventType: 'keyword_generation_failure',
          inputMethod: data.inputMethod,
          platform: data.platform,
          inputTextLength: data.inputText?.length || 0,
          errorMessage: `Validation Error: ${errorMessage}`,
        });
      } catch (logErr: any) {
        console.error("[ACTION ERROR] Failed to log validation_failure event in getKeywordsAction:", logErr.message || String(logErr));
      }
      return {
        success: false,
        error: errorMessage
      };
    }

    // console.log("[ACTION DEBUG] Calling suggestKeywords with validated data:", validationResult.data);
    const result = await suggestKeywords(validationResult.data);
    // console.log("[ACTION DEBUG] Result from suggestKeywords:", result);

    if (result && result.keywords) {
      return {
        success: true,
        data: result
      };
    } else {
      try {
        // console.log("[ACTION DEBUG] Logging AI unexpected result event from getKeywordsAction");
        await logAnalyticsEvent({
          eventType: 'keyword_generation_failure',
          inputMethod: validationResult.data.inputMethod,
          platform: validationResult.data.platform,
          inputTextLength: validationResult.data.inputText.length,
          errorMessage: 'AI returned unexpected result (no keywords or falsy result)',
        });
      } catch (logErr: any) {
          console.error("[ACTION ERROR] Failed to log AI unexpected result event in getKeywordsAction:", logErr.message || String(logErr));
      }
      return {
        success: false,
        error: 'Failed to generate keywords. The AI returned an unexpected result.'
      };
    }
  } catch (e: any) {
    // console.error("[ACTION CRITICAL] Outer unhandled error in getKeywordsAction:", e);

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

    try {
      // console.log("[ACTION DEBUG] Logging critical_failure event from getKeywordsAction's outer catch");
      await logAnalyticsEvent({
        eventType: 'keyword_generation_failure',
        errorMessage: `Critical Action Error in getKeywordsAction: ${originalErrorMessage}`,
        inputMethod: data?.inputMethod,
        platform: data?.platform,
        inputTextLength: data?.inputText?.length,
      });
    } catch (loggingError: any) {
      console.error("[ACTION ERROR] Failed to log critical_failure event during getKeywordsAction error handling. Logging error: ", loggingError?.message || String(loggingError));
    }
    return { success: false, error: "An unexpected server error occurred while generating keywords. Please try again." };
  }
}

const SubscribeActionInputSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  phone: z.string().optional().or(z.literal('')),
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

    // console.log("[ACTION DEBUG] Logging contact_details_submitted event from saveContactDetailsAction");
    await logAnalyticsEvent({
      eventType: 'contact_details_submitted',
      email: email,
      phone: phone || '',
    });

    // console.log('[ACTION INFO] Contact Details Submitted & Logged by saveContactDetailsAction:');
    // console.log('[ACTION INFO] Email:', email);
    // if (phone) {
    //   console.log('[ACTION INFO] Phone:', phone);
    // }
    // console.log('[ACTION INFO] Reminder: PII (email, phone) is now being sent to your analytics Google Sheet.');
    // console.log('[ACTION INFO] For production, consider a separate, secure datastore for PII.');

    return { success: true };
  } catch (error: any) {
    // console.error('[ACTION CRITICAL] Error in saveContactDetailsAction:', error);
    const originalErrorMessage = error.message || 'Unknown error in saveContactDetailsAction';
    try {
        // console.log("[ACTION DEBUG] Logging contact_submission_failure event from saveContactDetailsAction's catch");
        await logAnalyticsEvent({
        eventType: 'keyword_generation_failure', // Should be 'contact_submission_failure' but kept for consistency with original
        errorMessage: `Critical Action Error in saveContactDetailsAction: ${originalErrorMessage}`,
        });
    } catch (logErr: any) {
        console.error("[ACTION ERROR] Failed to log contact_submission_failure event. Logging error:", logErr?.message || String(logErr));
    }
    return { success: false, error: 'An unexpected server error occurred while saving your details.' };
  }
}


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

export async function logAnalyticsEvent(eventData: Omit<AnalyticsEventData, 'timestamp'>): Promise<void> {
  const completeEventData: AnalyticsEventData = {
    ...eventData,
    timestamp: new Date().toISOString(),
  };

  console.log('[LOG ANALYTICS] Attempting to log event. Data:', JSON.stringify(completeEventData, null, 2));

  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  console.log(`[LOG ANALYTICS ENV] GOOGLE_SHEETS_CLIENT_EMAIL is set: ${!!clientEmail}`);
  console.log(`[LOG ANALYTICS ENV] GOOGLE_SHEETS_PRIVATE_KEY is set: ${!!privateKeyRaw}`);
  if (privateKeyRaw) {
    console.log(`[LOG ANALYTICS ENV DEBUG] Raw Private Key Start: "${privateKeyRaw.substring(0, 30)}..."`);
    console.log(`[LOG ANALYTICS ENV DEBUG] Raw Private Key End: "...${privateKeyRaw.substring(privateKeyRaw.length - 30)}"`);
  }
  console.log(`[LOG ANALYTICS ENV] GOOGLE_SPREADSHEET_ID: ${spreadsheetId}`);


  if (!clientEmail || clientEmail.trim() === '' ||
      !privateKeyRaw || privateKeyRaw.trim() === '' ||
      !spreadsheetId || spreadsheetId.trim() === '') {
    console.warn('[LOG ANALYTICS WARN] Google Sheets API credentials or Spreadsheet ID are not set or empty in environment variables. Skipping Google Sheets logging.');
    return;
  }
  if (spreadsheetId === "YOUR_SPREADSHEET_ID_HERE") { 
    console.warn('[LOG ANALYTICS WARN] GOOGLE_SPREADSHEET_ID is still set to placeholder "YOUR_SPREADSHEET_ID_HERE". Skipping Google Sheets logging.');
    return;
  }

  const privateKeyFormatted = privateKeyRaw.replace(/\\n/g, '\n');

  try {
    console.log('[LOG ANALYTICS DEBUG] Using Client Email for Auth:', clientEmail);
    // console.log('[LOG ANALYTICS DEBUG] Using Formatted Private Key for Auth:', privateKeyFormatted); // Avoid logging full key

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKeyFormatted, 
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
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
      completeEventData.email || '',
      completeEventData.phone || '',
    ]];

    // console.log('[LOG ANALYTICS DEBUG] Appending values to Google Sheet:', JSON.stringify(values));
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });
    // console.log('[LOG ANALYTICS INFO] Successfully logged event to Google Sheet.');

  } catch (error: any) {
    console.error('[LOG ANALYTICS ERROR] Error during Google Sheets API interaction in logAnalyticsEvent:', error.message);
    if (error.code === 'ERR_OSSL_UNSUPPORTED' || (error.message && error.message.includes('DECODER routines::unsupported'))) {
      console.error(`[LOG ANALYTICS CRITICAL] Encountered ERR_OSSL_UNSUPPORTED or similar DECODER error. 
      This STRONGLY indicates an issue with the GOOGLE_SHEETS_PRIVATE_KEY format in your Vercel (or other hosting) environment variables.
      PLEASE DOUBLE-CHECK:
      1. The GOOGLE_SHEETS_PRIVATE_KEY in Vercel must be the *exact* string from your service account JSON file.
      2. It must start with '-----BEGIN PRIVATE KEY-----' and end with '-----END PRIVATE KEY-----\\n'. (The final '\\n' is critical).
      3. Ensure all newline characters (\\n) within the key are correctly preserved or represented as literal '\\n' if your env var system requires that (Vercel usually handles direct paste well).
      4. The key should not be malformed, truncated, or have extra characters like surrounding quotes from the JSON.
      5. Your code's 'privateKey.replace(/\\n/g, \'\\n\')' attempts to correct common escaping issues, but the original environment variable in Vercel must be as intact as possible.
      Current raw private key presence: ${!!privateKeyRaw}. 
      Raw Private Key Start (first 30 chars): "${privateKeyRaw?.substring(0, 30)}..."
      Raw Private Key End (last 30 chars): "...${privateKeyRaw?.substring(privateKeyRaw.length - 30)}"`);
    }
    if (error.response && error.response.data && error.response.data.error) {
      console.error('[LOG ANALYTICS ERROR] Google API Error Details:', JSON.stringify(error.response.data.error, null, 2));
    } else if (error.errors) { 
        console.error('[LOG ANALYTICS ERROR] Google API Error Array:', JSON.stringify(error.errors, null, 2));
    }
  }
}
    

  

    