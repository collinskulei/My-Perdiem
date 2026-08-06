
import * as z from 'zod';

// Zod schema for the input of the ticket cost extraction flow
export const ExtractTicketCostInputSchema = z.object({
  ticketImage: z.string().describe("A base64 encoded string of the ticket image (PNG, JPEG, or PDF)."),
});

// Zod schema for the output of the ticket cost extraction flow
export const ExtractTicketCostOutputSchema = z.object({
  cost: z.number().describe("The extracted total cost from the ticket. Returns 0 if no cost is found."),
});

// TypeScript type inferred from the Zod input schema
export type ExtractTicketCostInput = z.infer<typeof ExtractTicketCostInputSchema>;

// TypeScript type inferred from the Zod output schema
export type ExtractTicketCostOutput = z.infer<typeof ExtractTicketCostOutputSchema>;
