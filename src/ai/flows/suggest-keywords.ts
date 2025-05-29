'use server';
/**
 * @fileOverview Suggests trending keywords for reels and shorts based on input and platform.
 *
 * - suggestKeywords - A function that suggests SEO-relevant keywords.
 * - SuggestKeywordsInput - The input type for the suggestKeywords function.
 * - SuggestKeywordsOutput - The return type for the suggestKeywords function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestKeywordsInputSchema = z.object({
  inputMethod: z.enum(['caption', 'script', 'title']).describe('The type of input provided.'),
  inputText: z.string().describe('The actual caption, script, or title text.'),
  platform: z
    .enum(['youtube shorts', 'instagram reels', 'tiktok', 'linkedin video'])
    .describe('The target platform for the video.'),
});
export type SuggestKeywordsInput = z.infer<typeof SuggestKeywordsInputSchema>;

const SuggestKeywordsOutputSchema = z.object({
  keywords: z
    .array(z.string())
    .describe('An array of SEO-relevant keywords for the video.'),
});
export type SuggestKeywordsOutput = z.infer<typeof SuggestKeywordsOutputSchema>;

export async function suggestKeywords(input: SuggestKeywordsInput): Promise<SuggestKeywordsOutput> {
  return suggestKeywordsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestKeywordsPrompt',
  input: {schema: SuggestKeywordsInputSchema},
  output: {schema: SuggestKeywordsOutputSchema},
  prompt: `You are an expert in generating SEO-relevant keywords for short-form videos.

  Based on the following input and platform, suggest a list of keywords that will help the video rank higher and get more views and likes.

  Input Method: {{{inputMethod}}}
  Input Text: {{{inputText}}}
  Platform: {{{platform}}}

  Make sure that the keywords are relevant for the specified platform.

  Your output should be a JSON object with a "keywords" field containing an array of keywords.
  `,
});

const suggestKeywordsFlow = ai.defineFlow(
  {
    name: 'suggestKeywordsFlow',
    inputSchema: SuggestKeywordsInputSchema,
    outputSchema: SuggestKeywordsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
