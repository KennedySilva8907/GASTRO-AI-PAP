const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.PRODUCTION_URL
].filter(Boolean);

const MAX_BODY_SIZE = 50000;

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
        const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

        if (!API_KEY) {
            console.error('[Config Error] GEMINI_API_KEY not found in environment');
            return res.status(500).json({
                error: 'Service temporarily unavailable',
                code: ERROR_CODES.API_KEY_MISSING
            });
        }

        const response = await fetch(`${API_URL}?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'GastroAI-Chat/1.0'
            },
            body: JSON.stringify(req.body)
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
        const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

        if (!API_KEY) {
            console.error('[Config Error] GEMINI_API_KEY not found in environment');
            return res.status(500).json({
                error: 'Service temporarily unavailable',
                code: ERROR_CODES.API_KEY_MISSING
            });
        }

        const response = await fetch(`${API_URL}?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'GastroAI-Recipes/1.0'
            },
            body: JSON.stringify(req.body)
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
