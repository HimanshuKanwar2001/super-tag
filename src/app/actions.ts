
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
  console.log("[ACTION DEBUG] getKeywordsAction called with data:", JSON.stringify(data));
  try {
    const validationResult = KeywordActionInputSchema.safeParse(data);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => e.message).join(', ');
      console.warn("[ACTION WARN] Validation failed in getKeywordsAction:", errorMessage);
      try {
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

    console.log("[ACTION DEBUG] Validation successful in getKeywordsAction. Calling suggestKeywords with:", JSON.stringify(validationResult.data));
    const result = await suggestKeywords(validationResult.data);
    console.log("[ACTION DEBUG] Result from suggestKeywords in getKeywordsAction:", JSON.stringify(result));

    if (result && result.keywords) {
      console.log("[ACTION DEBUG] suggestKeywords returned valid result. Keywords count:", result.keywords.length);
      // Analytics for success is typically logged by the client-side upon receiving a success response.
      return {
        success: true,
        data: result
      };
    } else {
      const errorMessage = 'Failed to generate keywords. The AI returned an unexpected result (null, undefined, or no keywords array).';
      console.warn("[ACTION WARN] suggestKeywords returned unexpected result in getKeywordsAction. Raw result:", JSON.stringify(result));
      try {
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
        error: errorMessage
      };
    }
  } catch (e: any) {
    console.error("[ACTION CRITICAL] Error caught in getKeywordsAction's main catch block. Raw error object:", e);

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
    console.error("[ACTION CRITICAL] Parsed error message in getKeywordsAction:", originalErrorMessage);

    try {
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
  phone: z.string().optional().or(z.literal('')), // Make phone truly optional
  consent: z.boolean().refine(val => val === true, { message: "You must agree to the terms to subscribe." }),
});
 
export async function saveContactDetailsAction(
  data: z.infer<typeof SubscribeActionInputSchema>
): Promise<{ success: true } | { success: false; error: string }> {
  console.log("[ACTION DEBUG] saveContactDetailsAction called with data:", JSON.stringify({email: data.email, phone: data.phone ? 'present' : 'not-present', consent: data.consent }));
  try {
    const validationResult = SubscribeActionInputSchema.safeParse(data);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => e.message).join(', ');
      console.warn("[ACTION WARN] Validation failed in saveContactDetailsAction:", errorMessage);
      return { success: false, error: errorMessage };
    }

    const { email, phone } = validationResult.data;

    console.log("[ACTION DEBUG] Validation successful in saveContactDetailsAction. Logging contact_details_submitted event.");
    await logAnalyticsEvent({
      eventType: 'contact_details_submitted',
      email: email, // PII
      phone: phone || '', // PII
    });

    console.log('[ACTION INFO] Contact Details Submitted & Logged by saveContactDetailsAction. Email:', email, 'Phone:', phone || 'N/A');
    return { success: true };

  } catch (error: any) {
    console.error('[ACTION CRITICAL] Error caught in saveContactDetailsAction. Raw error:', error);
    let originalErrorMessage = "Unknown error in saveContactDetailsAction";
    if (error instanceof Error) {
        originalErrorMessage = error.message;
    } else if (typeof error === 'string') {
        originalErrorMessage = error;
    } else {
        try {
            originalErrorMessage = JSON.stringify(error);
        } catch {
            originalErrorMessage = String(error);
        }
    }
    console.error('[ACTION CRITICAL] Parsed error message in saveContactDetailsAction:', originalErrorMessage);

    try {
        await logAnalyticsEvent({
        eventType: 'keyword_generation_failure', // Should be 'contact_submission_failure'
        errorMessage: `Critical Action Error in saveContactDetailsAction: ${originalErrorMessage}`,
        email: data?.email, // PII
        phone: data?.phone || '', // PII
        });
    } catch (logErr: any) {
        console.error("[ACTION ERROR] Failed to log contact_submission_failure event in saveContactDetailsAction. Logging error:", logErr?.message || String(logErr));
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
  email?: string; // PII
  phone?: string; // PII
}

export async function logAnalyticsEvent(eventData: Omit<AnalyticsEventData, 'timestamp'>): Promise<void> {
  const completeEventData: AnalyticsEventData = {
    ...eventData,
    timestamp: new Date().toISOString(),
  };

  // Mask PII for general logging, but use it for Sheets
  const loggedEventDataForConsole = { ...completeEventData };
  if (loggedEventDataForConsole.email) loggedEventDataForConsole.email = "[REDACTED_EMAIL]";
  if (loggedEventDataForConsole.phone) loggedEventDataForConsole.phone = "[REDACTED_PHONE]";
  console.log('[LOG ANALYTICS] Attempting to log event. Data (PII redacted for console):', JSON.stringify(loggedEventDataForConsole, null, 2));


  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  console.log(`[LOG ANALYTICS ENV] GOOGLE_SHEETS_CLIENT_EMAIL is set: ${!!clientEmail}`);
  console.log(`[LOG ANALYTICS ENV] GOOGLE_SHEETS_PRIVATE_KEY is set: ${!!privateKeyRaw}`);
  if (privateKeyRaw && privateKeyRaw.length > 60) { // Check if key seems substantial
    console.log(`[LOG ANALYTICS ENV DEBUG] Raw Private Key Start: "${privateKeyRaw.substring(0, 30)}..."`);
    console.log(`[LOG ANALYTICS ENV DEBUG] Raw Private Key End: "...${privateKeyRaw.substring(privateKeyRaw.length - 30)}"`);
  } else if (privateKeyRaw) {
    console.warn(`[LOG ANALYTICS ENV DEBUG] Raw Private Key seems very short or unusual. Length: ${privateKeyRaw.length}`);
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
  // console.log('[LOG ANALYTICS ENV DEBUG] Formatted Private Key for Auth (first 30):', privateKeyFormatted.substring(0, 30) + "...");


  try {
    // console.log('[LOG ANALYTICS DEBUG] Using Client Email for Auth:', clientEmail); // Already logged

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKeyFormatted, 
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const range = 'Sheet1!A:M'; 

    // Use the original completeEventData with PII for Google Sheets
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
      completeEventData.email || '', // PII sent to sheet
      completeEventData.phone || '', // PII sent to sheet
    ]];

    // console.log('[LOG ANALYTICS DEBUG] Appending values to Google Sheet (PII included):', JSON.stringify(values));
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });
    console.log('[LOG ANALYTICS INFO] Successfully logged event to Google Sheet.');

  } catch (error: any) {
    console.error('[LOG ANALYTICS ERROR] Error during Google Sheets API interaction in logAnalyticsEvent:', error.message || error);
    if (error.code === 'ERR_OSSL_UNSUPPORTED' || (error.message && error.message.includes('DECODER routines::unsupported'))) {
      console.error(`[LOG ANALYTICS CRITICAL] Encountered ERR_OSSL_UNSUPPORTED or similar DECODER error. 
      This STRONGLY indicates an issue with the GOOGLE_SHEETS_PRIVATE_KEY format in your Vercel (or other hosting) environment variables.
      PLEASE DOUBLE-CHECK:
      1. The GOOGLE_SHEETS_PRIVATE_KEY in Vercel must be the *exact* string from your service account JSON file.
      2. It must start with '-----BEGIN PRIVATE KEY-----' and end with '-----END PRIVATE KEY-----\\n'. (The final '\\n' is critical and should be a literal newline).
      3. Ensure all newline characters (\\n) within the key are correctly preserved as literal newlines. Vercel's UI should preserve these if pasted directly from a plain text source.
      4. The key should not be malformed, truncated, or have extra characters like surrounding quotes from the JSON.
      5. Your code's 'privateKeyRaw.replace(/\\n/g, \'\\n\')' attempts to correct common escaping issues, but the original environment variable in Vercel must be as intact as possible.
      Current raw private key presence: ${!!privateKeyRaw}. 
      Raw Private Key Start (first 30 chars if present): "${privateKeyRaw?.substring(0, 30)}..."
      Raw Private Key End (last 30 chars if present): "...${privateKeyRaw?.substring(privateKeyRaw.length - 30)}"`);
    }
    if (error.response && error.response.data && error.response.data.error) {
      console.error('[LOG ANALYTICS ERROR] Google API Error Details:', JSON.stringify(error.response.data.error, null, 2));
    } else if (error.errors) { 
        console.error('[LOG ANALYTICS ERROR] Google API Error Array:', JSON.stringify(error.errors, null, 2));
    }
  }
}
    
