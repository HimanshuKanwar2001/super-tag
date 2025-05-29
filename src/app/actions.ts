
'use server';

import { suggestKeywords, type SuggestKeywordsInput, type SuggestKeywordsOutput } from '@/ai/flows/suggest-keywords';
import { z } from 'zod';
import { headers } from 'next/headers';
import { checkAndRecordGeneration, getRemainingGenerations as getRemainingFromServer } from '@/lib/rate-limiter';

const ActionInputSchema = z.object({
  inputMethod: z.enum(['caption', 'script', 'title']),
  inputText: z.string().min(10, { message: "Input text must be at least 10 characters long."}),
  platform: z.enum(['youtube shorts', 'instagram reels', 'tiktok', 'linkedin video']),
});

export async function getKeywordsAction(
  data: SuggestKeywordsInput
): Promise<
  { success: true; data: SuggestKeywordsOutput; remainingGenerations: number; resetTime?: number } | 
  { success: false; error: string; remainingGenerations: number; resetTime?: number }
> {
  const ip = headers().get('x-forwarded-for') ?? headers().get('x-real-ip') ?? headers().get('remote-addr');

  const rateLimitResult = checkAndRecordGeneration(ip);

  if (!rateLimitResult.allowed) {
    return { 
      success: false, 
      error: rateLimitResult.error || 'Rate limit exceeded.', 
      remainingGenerations: rateLimitResult.remaining,
      resetTime: rateLimitResult.resetTime 
    };
  }

  const validationResult = ActionInputSchema.safeParse(data);
  if (!validationResult.success) {
    // Note: A generation was consumed by checkAndRecordGeneration even if validation fails.
    // This is typical: rate limit is often checked first.
    return { 
      success: false, 
      error: validationResult.error.errors.map(e => e.message).join(', '), 
      remainingGenerations: rateLimitResult.remaining,
      resetTime: rateLimitResult.resetTime
    };
  }

  try {
    const result = await suggestKeywords(validationResult.data);
    if (result && result.keywords) {
      return { 
        success: true, 
        data: result, 
        remainingGenerations: rateLimitResult.remaining,
        resetTime: rateLimitResult.resetTime 
      };
    } else {
      return { 
        success: false, 
        error: 'Failed to generate keywords. The AI returned an unexpected result.', 
        remainingGenerations: rateLimitResult.remaining,
        resetTime: rateLimitResult.resetTime
      };
    }
  } catch (error) {
    console.error('Error in getKeywordsAction:', error);
    return { 
      success: false, 
      error: 'An unexpected error occurred while generating keywords.', 
      remainingGenerations: rateLimitResult.remaining,
      resetTime: rateLimitResult.resetTime
    };
  }
}

export async function getInitialUsage(): Promise<{ remainingGenerations: number; maxGenerations: number; resetTime?: number }> {
  const ip = headers().get('x-forwarded-for') ?? headers().get('x-real-ip') ?? headers().get('remote-addr');
  const { remaining, resetTime, maxGenerations } = getRemainingFromServer(ip);
  return { remainingGenerations: remaining, maxGenerations, resetTime };
}

