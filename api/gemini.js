import {
  callGroq,
  ERROR_CODES,
  geminiToGroqPayload,
  groqToGeminiResponse,
  runPreflight,
} from './_shared.js';
import { authenticateRequest } from './_auth.js';
import { checkAndIncrementUsage } from './_usage.js';

export default async function handler(req, res) {
  if (!runPreflight(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      code: ERROR_CODES.METHOD_NOT_ALLOWED,
    });
  }

  try {
    const auth = await authenticateRequest(req);
    if (!auth.ok) {
      return res.status(auth.status).json(auth.body);
    }

    const API_KEY = process.env.GROQ_API_KEY;

    if (!API_KEY) {
      console.error('[Config Error] GROQ_API_KEY not found in environment');
      return res.status(500).json({
        error: 'Service temporarily unavailable',
        code: ERROR_CODES.API_KEY_MISSING,
      });
    }

    const groqBody = geminiToGroqPayload(req.body);
    if (!groqBody.messages.length) {
      return res.status(400).json({
        error: 'Invalid request payload',
        code: ERROR_CODES.INVALID_INPUT,
      });
    }

    const usageGate = await checkAndIncrementUsage({
      user: auth.user,
      feature: 'challenge_recipe',
    });
    if (!usageGate.allowed) {
      return res.status(usageGate.status).json(usageGate.body);
    }

    const response = await callGroq({
      apiKey: API_KEY,
      body: groqBody,
    });

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch {
        // ignore body parse failure
      }
      console.error('Groq API Error (gemini):', response.status, errorBody);
      return res.status(response.status).json({
        error: 'An error occurred processing your request',
        code: ERROR_CODES.GROQ_API,
      });
    }

    const data = await response.json();
    return res.status(200).json(groqToGeminiResponse(data));
  } catch (error) {
    console.error('[Gemini Error]', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    return res.status(500).json({
      error: 'An error occurred processing your request',
      code: ERROR_CODES.INTERNAL,
    });
  }
}
