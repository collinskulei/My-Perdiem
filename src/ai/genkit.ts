import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI({
    apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY,
  })],
  model: 'googleai/gemini-2.5-flash',
});
