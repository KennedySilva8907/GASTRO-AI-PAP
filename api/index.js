const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.PRODUCTION_URL
].filter(Boolean);

const MAX_BODY_SIZE = 50000;
const GEMINI_API_URL =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const CHAT_MAX_OUTPUT_TOKENS = 900;
const CHAT_MESSAGE_MAX_LENGTH = 500;
const CHAT_HISTORY_MAX_ENTRIES = 10;
const CHAT_HISTORY_ENTRY_MAX_LENGTH = 4000;
const CHAT_SYSTEM_INSTRUCTION =
    'Use sempre português de Portugal. És o assistente culinário do GastroAI e deves ajudar apenas com gastronomia, receitas, ingredientes, técnicas de cozinha, segurança alimentar, harmonizações e planeamento de refeições. Se o pedido fugir do tema gastronómico, recusa com educação e convida o utilizador a voltar a perguntas de culinária.';
const CHAT_SAFETY_SETTINGS = [
    {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
    }
];

const ERROR_CODES = {
    GEMINI_API: 'ERR_GEMINI_001',
    INVALID_INPUT: 'ERR_INPUT_001',
    NOT_FOUND: 'ERR_NOTFOUND_001',
    METHOD_NOT_ALLOWED: 'ERR_METHOD_001',
    PAYLOAD_TOO_LARGE: 'ERR_PAYLOAD_001',
    API_KEY_MISSING: 'ERR_CONFIG_001',
    INTERNAL: 'ERR_INTERNAL_001',
    CORS: 'ERR_CORS_001'
};

function setCorsHeaders(req, res) {
    const origin = req.headers.origin;

    // No origin header (server-to-server, Postman, same-origin)
    if (!origin) {
        res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
        res.setHeader('Access-Control-Allow-Credentials', true);
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
        return true;
    }

    // Allow same-origin requests (origin matches the server's own host)
    const serverOrigin = `https://${req.headers.host}`;
    if (origin === serverOrigin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', true);
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
        return true;
    }

    // Check if origin is in explicit whitelist
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', true);
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
        return true;
    }

    // Origin not allowed
    return false;
}

function normalizeChatRequestBody(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return null;
    }

    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message || message.length > CHAT_MESSAGE_MAX_LENGTH) {
        return null;
    }

    const rawHistory = body.history ?? [];
    if (!Array.isArray(rawHistory) || rawHistory.length > CHAT_HISTORY_MAX_ENTRIES) {
        return null;
    }

    const history = [];
    for (const entry of rawHistory) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            return null;
        }

        const role = entry.role;
        const text = typeof entry.text === 'string' ? entry.text.trim() : '';
        if (!['user', 'model'].includes(role) || !text || text.length > CHAT_HISTORY_ENTRY_MAX_LENGTH) {
            return null;
        }

        history.push({ role, text });
    }

    return { message, history };
}

function buildChatGeminiPayload({ message, history }) {
    return {
        systemInstruction: {
            parts: [{ text: CHAT_SYSTEM_INSTRUCTION }]
        },
        contents: [
            ...history.map((entry) => ({
                role: entry.role,
                parts: [{ text: entry.text }]
            })),
            {
                role: 'user',
                parts: [{ text: message }]
            }
        ],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS
        },
        safetySettings: CHAT_SAFETY_SETTINGS
    };
}

async function callGemini({ apiKey, userAgent, body }) {
    return fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': userAgent,
            'x-goog-api-key': apiKey
        },
        body: JSON.stringify(body)
    });
}

export default async function handler(req, res) {
    // Set CORS headers and check if origin is allowed
    const allowed = setCorsHeaders(req, res);
    if (!allowed) {
        return res.status(403).json({
            error: 'Origin not allowed',
            code: ERROR_CODES.CORS
        });
    }

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const bodySize = JSON.stringify(req.body || {}).length;
    if (bodySize > MAX_BODY_SIZE) {
        return res.status(413).json({
            error: 'Request payload too large',
            code: ERROR_CODES.PAYLOAD_TOO_LARGE
        });
    }

    const { url } = req;
    const path = url.split('/api/')[1] || '';

    try {
        // Route incoming requests to the correct handler
        if (path === 'chat' || path.startsWith('chat/')) {
            return await handleChat(req, res);
        } else if (path === 'gemini' || path.startsWith('gemini/')) {
            return await handleGemini(req, res);
        } else {
            return res.status(404).json({
                error: 'Endpoint not found',
                code: ERROR_CODES.NOT_FOUND
            });
        }
    } catch (error) {
        console.error('[API Router Error]', {
            message: error.message,
            stack: error.stack,
            url: req.url,
            timestamp: new Date().toISOString()
        });
        return res.status(500).json({
            error: 'An error occurred processing your request',
            code: ERROR_CODES.INTERNAL
        });
    }
}

// Handler for the /api/chat endpoint
async function handleChat(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed',
            code: ERROR_CODES.METHOD_NOT_ALLOWED
        });
    }

    try {
        const API_KEY = process.env.GEMINI_API_KEY;

        if (!API_KEY) {
            console.error('[Config Error] GEMINI_API_KEY not found in environment');
            return res.status(500).json({
                error: 'Service temporarily unavailable',
                code: ERROR_CODES.API_KEY_MISSING
            });
        }

        const normalizedRequest = normalizeChatRequestBody(req.body);
        if (!normalizedRequest) {
            return res.status(400).json({
                error: 'Invalid chat request payload',
                code: ERROR_CODES.INVALID_INPUT
            });
        }

        const response = await callGemini({
            apiKey: API_KEY,
            userAgent: 'GastroAI-Chat/1.0',
            body: buildChatGeminiPayload(normalizedRequest)
        });

        if (!response.ok) {
            console.error('Gemini API Error (chat):', response.status);
            return res.status(response.status).json({
                error: 'An error occurred processing your request',
                code: ERROR_CODES.GEMINI_API
            });
        }

        const data = await response.json();
        return res.status(200).json(data);

    } catch (error) {
        console.error('[Chat Error]', {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
        return res.status(500).json({
            error: 'An error occurred processing your request',
            code: ERROR_CODES.INTERNAL
        });
    }
}

// Handler for the /api/gemini endpoint
async function handleGemini(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed',
            code: ERROR_CODES.METHOD_NOT_ALLOWED
        });
    }

    try {
        const API_KEY = process.env.GEMINI_API_KEY;

        if (!API_KEY) {
            console.error('[Config Error] GEMINI_API_KEY not found in environment');
            return res.status(500).json({
                error: 'Service temporarily unavailable',
                code: ERROR_CODES.API_KEY_MISSING
            });
        }

        const response = await callGemini({
            apiKey: API_KEY,
            userAgent: 'GastroAI-Recipes/1.0',
            body: req.body
        });

        if (!response.ok) {
            console.error('Gemini API Error (gemini):', response.status);
            return res.status(response.status).json({
                error: 'An error occurred processing your request',
                code: ERROR_CODES.GEMINI_API
            });
        }

        const data = await response.json();
        return res.status(200).json(data);

    } catch (error) {
        console.error('[Gemini Error]', {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
        return res.status(500).json({
            error: 'An error occurred processing your request',
            code: ERROR_CODES.INTERNAL
        });
    }
}
