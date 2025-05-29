
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
      // This case might occur if the AI returns an empty or malformed response
      // that still passes schema validation somehow, or if the flow itself has an issue
      // not caught by a try-catch within the flow but before returning.
      return { 
        success: false, 
        error: 'Failed to generate keywords. The AI returned an unexpected result.'
      };
    }
  } catch (error) {
    console.error('Error in getKeywordsAction:', error);
    // This catches errors from the suggestKeywords flow itself (e.g., network issues, AI errors)
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
