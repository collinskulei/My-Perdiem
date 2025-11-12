/**
 * @file This file defines the Cloud Function for extracting ticket costs.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/googleai";
import * as fileType from "file-type";
import * as admin from "firebase-admin";

import { defineSecret } from "firebase-functions/params";

// Initialize Firebase Admin SDK
admin.initializeApp();

// Define the secret for the Gemini API Key. This must be set in Google Cloud Secret Manager.
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// Initialize Genkit with the Google AI plugin, configured to use the secret.
const ai = genkit({
  plugins: [googleAI({ apiKey: geminiApiKey as string })],
});

// Define Zod schema for output validation
const ExtractTicketCostOutputSchema = z.object({
    cost: z.number().describe("The extracted total cost from the ticket. Returns 0 if no cost is found."),
});

// Define the Genkit prompt for cost extraction
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

// Define the callable Cloud Function
export const extractTicketCost = onCall({ secrets: [geminiApiKey] }, async (request) => {
  // Validate authentication context - This is a crucial security check for production.
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  
  const { ticketImage } = request.data;
  
  if (!ticketImage) {
    throw new HttpsError("invalid-argument", "No ticket image provided.");
  }

  try {
    const base64Data = ticketImage.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    const type = await fileType.fromBuffer(buffer);

    if (type?.mime === 'application/pdf') {
       throw new HttpsError('invalid-argument', 'PDF files are not supported for automatic cost extraction. Please upload an image (PNG, JPG).');
    } else if (type && !type.mime.startsWith('image/')) {
        throw new HttpsError('invalid-argument', `Unsupported file type: ${type.mime}. Please upload a PNG or JPG file.`);
    }

    const { output } = await extractCostPrompt({ ticketImage });
    
    if (!output) {
      throw new HttpsError("internal", "The AI model could not process the ticket image.");
    }
    
    return output;
  } catch (error: any) {
    console.error("Error in extractTicketCost function:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", error.message || "An unexpected error occurred while processing the ticket.");
  }
});
