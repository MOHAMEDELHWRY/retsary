import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

const apiKey = process.env.GOOGLE_API_KEY;

// Validate API key
if (!apiKey) {
  console.error('❌ GOOGLE_API_KEY is not set in environment variables');
  console.error('Please add GOOGLE_API_KEY to your .env.local file');
  throw new Error('Missing GOOGLE_API_KEY environment variable');
}

if (!apiKey.startsWith('AIza')) {
  console.error('❌ Invalid GOOGLE_API_KEY format');
  console.error('Google AI API keys should start with "AIza"');
  throw new Error('Invalid GOOGLE_API_KEY format');
}

console.log('✅ Google AI API key loaded successfully');

export const ai = genkit({
  plugins: [googleAI({ apiKey })],
  model: 'googleai/gemini-1.5-flash',
});
