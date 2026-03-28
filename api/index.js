const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const MAX_BODY_SIZE = 50000;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'Accept, Content-Type, Content-Length'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const bodySize = JSON.stringify(req.body || {}).length;
    if (bodySize > MAX_BODY_SIZE) {
        return res.status(413).json({ error: 'Pedido demasiado grande' });
    }

    const { url } = req;
    const path = url.split('/api/')[1] || '';

    try {
        // Roteamento para diferentes endpoints
        if (path === 'chat' || path.startsWith('chat/')) {
            return await handleChat(req, res);
        } else if (path === 'gemini' || path.startsWith('gemini/')) {
            return await handleGemini(req, res);
        } else {
            return res.status(404).json({ error: 'Endpoint não encontrado' });
        }
    } catch (error) {
        console.error('Erro no roteador da API:', error);
        return res.status(500).json({ 
            error: 'Erro interno do servidor',
            details: error.message 
        });
    }
}

// Função para lidar com o endpoint /api/chat
async function handleChat(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
        const API_KEY = process.env.GEMINI_API_KEY;
        const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

        if (!API_KEY) {
            console.error('GEMINI_API_KEY não encontrada');
            return res.status(500).json({ error: 'API key não configurada' });
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
            const errorText = await response.text();
            console.error('Gemini API Error (chat):', response.status);
            return res.status(response.status).json({ error: 'Erro na API Gemini' });
        }

        const data = await response.json();
        return res.status(200).json(data);

    } catch (error) {
        console.error('Erro no chat:', error);
        return res.status(500).json({ 
            error: 'Erro interno do servidor',
            details: error.message 
        });
    }
}

// Função para lidar com o endpoint /api/gemini
async function handleGemini(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
        const API_KEY = process.env.GEMINI_API_KEY;
        const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

        if (!API_KEY) {
            console.error('GEMINI_API_KEY não encontrada');
            return res.status(500).json({ error: 'API key não configurada' });
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
            const errorText = await response.text();
            console.error('Gemini API Error (gemini):', response.status);
            return res.status(response.status).json({ error: 'Erro na API Gemini' });
        }

        const data = await response.json();
        return res.status(200).json(data);

    } catch (error) {
        console.error('Erro no gemini:', error);
        return res.status(500).json({ 
            error: 'Erro interno do servidor',
            details: error.message 
        });
    }
}
