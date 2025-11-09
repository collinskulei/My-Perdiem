
'use server';
/**
 * @fileOverview An AI flow to extract the cost from a ticket image.
 *
 * - extractTicketCost - A function that handles the cost extraction process.
 */

import { ai } from '@/ai/genkit';
import { ExtractCostInputSchema, ExtractCostOutputSchema, type ExtractCostInput, type ExtractCostOutput } from '@/ai/schemas/ticket-cost-schemas';


export async function extractTicketCost(input: ExtractCostInput): Promise<ExtractCostOutput> {
  return extractTicketCostFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractTicketCostPrompt',
  input: { schema: ExtractCostInputSchema },
  output: { schema: ExtractCostOutputSchema },
  prompt: `You are an OCR (Optical Character Recognition) expert. Your task is to analyze the provided image of a ticket or receipt and extract the total cost.

Look for keywords like "Total", "Amount", "Price", "KES", or "Ksh". The cost should be returned as a single number, without any currency symbols or commas.

If you cannot determine a clear total cost from the image, return 0.

Image to analyze: {{media url=ticketImage}}`,
});

const extractTicketCostFlow = ai.defineFlow(
  {
    name: 'extractTicketCostFlow',
    inputSchema: ExtractCostInputSchema,
    outputSchema: ExtractCostOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
