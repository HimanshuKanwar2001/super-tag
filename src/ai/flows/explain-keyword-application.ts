'use server';
/**
 * @fileOverview Explains the suggested keyword to the user.
 *
 * - explainKeyword - A function that takes a keyword and other context and returns an explanation of how to apply the keyword.
 * - ExplainKeywordInput - The input type for the explainKeyword function.
 * - ExplainKeywordOutput - The return type for the explainKeyword function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExplainKeywordInputSchema = z.object({
  keyword: z.string().describe('The keyword to explain.'),
  platform: z.string().describe('The platform for which the keyword is intended (e.g., YouTube Shorts, Instagram Reels, TikTok, LinkedIn Video).'),
  inputMethod: z.string().describe('The input method used (e.g., caption, script, title).'),
});
export type ExplainKeywordInput = z.infer<typeof ExplainKeywordInputSchema>;

const ExplainKeywordOutputSchema = z.object({
  explanation: z.string().describe('An explanation of how to apply the keyword effectively on the specified platform using the given input method.'),
});
export type ExplainKeywordOutput = z.infer<typeof ExplainKeywordOutputSchema>;

export async function explainKeyword(input: ExplainKeywordInput): Promise<ExplainKeywordOutput> {
  return explainKeywordFlow(input);
}

const prompt = ai.definePrompt({
  name: 'explainKeywordPrompt',
  input: {schema: ExplainKeywordInputSchema},
  output: {schema: ExplainKeywordOutputSchema},
  prompt: `You are an expert in SEO and social media marketing.

  Given the keyword: "{{keyword}}", the platform: "{{platform}}", and the input method: "{{inputMethod}}", explain how to apply the keyword effectively.  Consider providing specific examples of how to incorporate the keyword into the {{inputMethod}} for {{platform}} to maximize its SEO impact and audience engagement.
  What are the best practices and strategies for leveraging this keyword in the context of the provided platform and input method?
  How can the user optimize their content using this keyword to improve visibility and reach their target audience?
  Provide a detailed explanation.
  `,
});

const explainKeywordFlow = ai.defineFlow(
  {
    name: 'explainKeywordFlow',
    inputSchema: ExplainKeywordInputSchema,
    outputSchema: ExplainKeywordOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
