export const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.PRODUCTION_URL
].filter(Boolean);

export const MAX_BODY_SIZE = 50000;

export const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const GROQ_MODEL = 'openai/gpt-oss-120b';

export const ERROR_CODES = {
    GROQ_API: 'ERR_GROQ_001',
    INVALID_INPUT: 'ERR_INPUT_001',
    NOT_FOUND: 'ERR_NOTFOUND_001',
    METHOD_NOT_ALLOWED: 'ERR_METHOD_001',
    PAYLOAD_TOO_LARGE: 'ERR_PAYLOAD_001',
    API_KEY_MISSING: 'ERR_CONFIG_001',
    INTERNAL: 'ERR_INTERNAL_001',
    CORS: 'ERR_CORS_001'
};

export function setCorsHeaders(req, res) {
    const origin = req.headers.origin;

    if (!origin) {
        res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
        res.setHeader('Access-Control-Allow-Credentials', true);
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
        return true;
    }

    const serverOrigin = `https://${req.headers.host}`;
    if (origin === serverOrigin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', true);
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
        return true;
    }

    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', true);
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
        return true;
    }

    return false;
}

export async function callGroq({ apiKey, body }) {
    return fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
    });
}

// Converts a Gemini-shaped request body (used by the frontend recipe flow)
// into a Groq/OpenAI chat-completions payload.
export function geminiToGroqPayload(geminiBody) {
    const messages = [];

    const systemParts = geminiBody?.systemInstruction?.parts ?? [];
    const systemText = systemParts
        .map((p) => (typeof p?.text === 'string' ? p.text : ''))
        .join('')
        .trim();
    if (systemText) {
        messages.push({ role: 'system', content: systemText });
    }

    const contents = Array.isArray(geminiBody?.contents) ? geminiBody.contents : [];
    for (const turn of contents) {
        const role = turn?.role === 'model' ? 'assistant' : 'user';
        const content = (turn?.parts ?? [])
            .map((p) => (typeof p?.text === 'string' ? p.text : ''))
            .join('')
            .trim();
        if (content) {
            messages.push({ role, content });
        }
    }

    const cfg = geminiBody?.generationConfig ?? {};
    const payload = {
        model: GROQ_MODEL,
        messages
    };
    if (typeof cfg.temperature === 'number') payload.temperature = cfg.temperature;
    if (typeof cfg.maxOutputTokens === 'number') payload.max_tokens = cfg.maxOutputTokens;
    return payload;
}

// Wraps a Groq chat-completions response in the Gemini envelope shape that
// the frontend already knows how to parse (candidates[0].content.parts[0].text).
export function groqToGeminiResponse(groqData) {
    const choice = groqData?.choices?.[0];
    const text = typeof choice?.message?.content === 'string' ? choice.message.content : '';
    const finishReason = choice?.finish_reason;

    let geminiFinish = 'STOP';
    if (finishReason === 'content_filter') geminiFinish = 'SAFETY';
    else if (finishReason === 'length') geminiFinish = 'MAX_TOKENS';

    return {
        candidates: [
            {
                content: {
                    role: 'model',
                    parts: [{ text }]
                },
                finishReason: geminiFinish
            }
        ]
    };
}

export function runPreflight(req, res) {
    const allowed = setCorsHeaders(req, res);
    if (!allowed) {
        res.status(403).json({
            error: 'Origin not allowed',
            code: ERROR_CODES.CORS
        });
        return false;
    }

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return false;
    }

    const bodySize = JSON.stringify(req.body || {}).length;
    if (bodySize > MAX_BODY_SIZE) {
        res.status(413).json({
            error: 'Request payload too large',
            code: ERROR_CODES.PAYLOAD_TOO_LARGE
        });
        return false;
    }

    return true;
}
