import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

let _ai: ReturnType<typeof genkit> | null = null;

export function getAI() {
  if (_ai) return _ai;

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GOOGLE_API_KEY environment variable');
  }
  if (!apiKey.startsWith('AIza')) {
    throw new Error('Invalid GOOGLE_API_KEY format');
  }
  _ai = genkit({
    plugins: [googleAI({ apiKey })],
    model: 'googleai/gemini-1.5-flash',
  });
  return _ai;
}
