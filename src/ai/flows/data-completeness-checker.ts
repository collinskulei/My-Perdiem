'use server';
/**
 * @fileOverview Checks the data completeness of a perdiem request using AI.
 *
 * - checkDataCompleteness - A function that checks if the perdiem request form has all the required data fields completed.
 * - DataCompletenessInput - The input type for the checkDataCompleteness function.
 * - DataCompletenessOutput - The return type for the checkDataCompleteness function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DataCompletenessInputSchema = z.object({
  eventName: z.string().describe('The name of the event.'),
  location: z.string().describe('The location of the event.'),
  hotels: z.string().optional().describe('The available hotels at the event location.'),
  facilitator: z.string().describe('The name of the facilitator.'),
  date: z.string().describe('The date of the event.'),
  mileage: z.number().describe('The mileage covered.'),
  groundTransfers: z.string().optional().describe('Details of ground transfers.'),
  airTicketCosts: z.number().optional().describe('The cost of the air ticket.'),
});
export type DataCompletenessInput = z.infer<typeof DataCompletenessInputSchema>;

const DataCompletenessOutputSchema = z.object({
  completenessStatus: z.enum(['complete', 'incomplete']).describe('The completeness status of the perdiem request data.'),
});
export type DataCompletenessOutput = z.infer<typeof DataCompletenessOutputSchema>;

export async function checkDataCompleteness(input: DataCompletenessInput): Promise<DataCompletenessOutput> {
  return dataCompletenessCheckerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'dataCompletenessPrompt',
  input: {schema: DataCompletenessInputSchema},
  output: {schema: DataCompletenessOutputSchema},
  prompt: `You are an AI assistant that checks the completeness of a perdiem request form.

  Based on the information provided, determine if all the relevant fields have been completed.
  If a field is left incomplete but seems relevant given the other information, mark the request as "incomplete".
  If all relevant fields are completed, or if a missing field is not relevant, mark the request as "complete".

  Event Name: {{{eventName}}}
  Location: {{{location}}}
  Hotels: {{{hotels}}}
  Facilitator: {{{facilitator}}}
  Date: {{{date}}}
  Mileage: {{{mileage}}}
  Ground Transfers: {{{groundTransfers}}}
  Air Ticket Costs: {{{airTicketCosts}}}

  Return only 'complete' or 'incomplete'.`,
});

const dataCompletenessCheckerFlow = ai.defineFlow(
  {
    name: 'dataCompletenessCheckerFlow',
    inputSchema: DataCompletenessInputSchema,
    outputSchema: DataCompletenessOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
