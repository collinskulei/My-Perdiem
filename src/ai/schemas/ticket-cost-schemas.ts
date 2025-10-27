/**
 * @fileOverview Defines the Zod schemas and TypeScript types for the ticket cost extraction flow.
 *
 * - ExtractCostInputSchema - The Zod schema for the input to the cost extraction function.
 * - ExtractCostInput - The TypeScript type inferred from the input schema.
 * - ExtractCostOutputSchema - The Zod schema for the output of the cost extraction function.
 * - ExtractCostOutput - The TypeScript type inferred from the output schema.
 */

import { z } from 'genkit';

export const ExtractCostInputSchema = z.object({
  ticketImage: z
    .string()
    .describe(
      "A photo of a ticket or receipt, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractCostInput = z.infer<typeof ExtractCostInputSchema>;

export const ExtractCostOutputSchema = z.object({
  cost: z.number().describe('The total cost found on the ticket. Should be a number, not a string. Return 0 if no cost is found.'),
});
export type ExtractCostOutput = z.infer<typeof ExtractCostOutputSchema>;
