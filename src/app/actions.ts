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
): Promise<{ success: true; data: SuggestKeywordsOutput } | { success: false; error: string }> {
  const validationResult = ActionInputSchema.safeParse(data);
  if (!validationResult.success) {
    return { success: false, error: validationResult.error.errors.map(e => e.message).join(', ') };
  }

  try {
    const result = await suggestKeywords(validationResult.data);
    if (result && result.keywords && result.keywordExplanations) {
      return { success: true, data: result };
    } else {
      return { success: false, error: 'Failed to generate keywords. The AI returned an unexpected result.' };
    }
  } catch (error) {
    console.error('Error in getKeywordsAction:', error);
    return { success: false, error: 'An unexpected error occurred while generating keywords.' };
  }
}
