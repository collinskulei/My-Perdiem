
'use server';

import { ai } from '@/ai/genkit';
import { ExtractTicketCostInputSchema, ExtractTicketCostOutputSchema, type ExtractTicketCostInput } from '@/ai/schemas/ticket-cost-schemas';
import * as z from 'zod';
import { fromPath } from 'pdf-poppler';
import fs from 'fs';
import os from 'os';
import path from 'path';
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

    let imageToProcess = ticketImage;

    if (type?.mime === 'application/pdf') {
        const tempFilePath = path.join(os.tmpdir(), `ticket-${Date.now()}.pdf`);
        const outputDir = os.tmpdir();
        
        fs.writeFileSync(tempFilePath, buffer);

        const options = {
            firstPageToConvert: 1,
            lastPageToConvert: 1,
            pngFile: true,
        };

        await fromPath(tempFilePath, options);
        
        const outputPngPath = path.join(outputDir, `ticket-${Date.now()}-1.png`);
        
        // Find the generated PNG. pdf-poppler doesn't give a predictable name.
        const files = fs.readdirSync(outputDir);
        const generatedPng = files.find(f => f.startsWith(`ticket-${Date.now()}-1`) && f.endsWith('.png'));

        if (!generatedPng) {
            throw new Error('PDF conversion failed: output PNG not found.');
        }

        const pngPath = path.join(outputDir, generatedPng);
        const pngBuffer = fs.readFileSync(pngPath);
        imageToProcess = `data:image/png;base64,${pngBuffer.toString('base64')}`;

        // Cleanup temp files
        fs.unlinkSync(tempFilePath);
        fs.unlinkSync(pngPath);

    } else if (type && !type.mime.startsWith('image/')) {
        throw new Error(`Unsupported file type: ${type.mime}`);
    }


    const { output } = await extractCostPrompt({ ticketImage: imageToProcess });

    if (!output) {
        throw new Error('The AI model could not process the ticket image.');
    }
    
    return output;
}
