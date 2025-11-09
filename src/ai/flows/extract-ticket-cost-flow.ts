
'use server';

import { ai } from '@/ai/genkit';
import { ExtractTicketCostInputSchema, ExtractTicketCostOutputSchema, type ExtractTicketCostInput } from '@/ai/schemas/ticket-cost-schemas';
import * as z from 'zod';
import { fileTypeFromBuffer } from 'file-type';

// Define the prompt for extracting the ticket cost
const extractCostPrompt = ai.definePrompt(
  {
    name: 'extractCostPrompt',
    input: { schema: z.object({ ticketImage: z.string() }) },
    output: { schema: ExtractTicketCostOutputSchema },
    prompt: `You are an OCR (Optical Character Recognition) expert. Your task is to analyze the provided image of a ticket or receipt and extract the total cost.

    - Look for keywords like "Total", "Amount Due", "Grand Total".
    - The cost might be prefixed with a currency symbol like "$", "€", "£", or a currency code like "USD", "KES".
    - Ignore any other numbers on the ticket like dates, flight numbers, or seat numbers.
    - If you cannot find a clear total cost, return 0.
    - Only return the numerical value of the cost.
    
    Image: {{media url=ticketImage}}`,
  }
);


export async function extractTicketCost(input: ExtractTicketCostInput) {
    const { ticketImage } = input;
    const base64Data = ticketImage.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    const type = await fileTypeFromBuffer(buffer);

    if (type?.mime === 'application/pdf') {
        // This is a server-side safeguard. The primary check is now on the client.
        throw new Error('PDF files are not supported for automatic cost extraction. Please upload an image (PNG, JPG).');
    } else if (type && !type.mime.startsWith('image/')) {
        throw new Error(`Unsupported file type: ${type.mime}. Please upload a PNG or JPG file.`);
    }

    const { output } = await extractCostPrompt({ ticketImage: ticketImage });

    if (!output) {
        throw new Error('The AI model could not process the ticket image.');
    }
    
    return output;
}
