# API Reference

GastroAI uses a single Vercel serverless function (`api/index.js`) that proxies requests to the Google Gemini API. All endpoints require POST method and accept JSON bodies.

## Base URL

- **Local:** `http://localhost:3000/api`
- **Production:** `https://gastro-ai-pap.vercel.app/api`

## Authentication

No client-side authentication. The serverless function injects the `GEMINI_API_KEY` server-side. Clients never see the API key.

## CORS Policy

Origin validation uses a three-tier check:

1. **No Origin header** (server-to-server, curl, Postman) — allowed
2. **Same-origin** (Origin matches server host) — allowed
3. **Whitelist** (`localhost:5173`, `localhost:3000`, `PRODUCTION_URL` env var) — allowed
4. **Everything else** — rejected with `ERR_CORS_001`

## Endpoints

### POST /api/chat

Proxies chat messages to Google Gemini for the AI gastronomy assistant. Supports conversation history.

**Request:**

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [{ "text": "What spices go well with salmon?" }]
    }
  ]
}
```

**Response (200):**

```json
{
  "candidates": [
    {
      "content": {
        "parts": [{ "text": "Great pairings for salmon include dill, lemon pepper..." }],
        "role": "model"
      }
    }
  ]
}
```

**Headers sent upstream:** `User-Agent: GastroAI-Chat/1.0`

### POST /api/gemini

Proxies recipe generation requests to Google Gemini for the timed cooking challenges.

**Request:**

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [{ "text": "Generate an intermediate difficulty recipe..." }]
    }
  ]
}
```

**Response (200):** Same format as `/api/chat`.

**Headers sent upstream:** `User-Agent: GastroAI-Recipes/1.0`

## Error Codes

All error responses follow the format:

```json
{
  "error": "Human-readable message",
  "code": "ERR_CATEGORY_NNN"
}
```

| Code | HTTP Status | Meaning | Cause |
|------|-------------|---------|-------|
| `ERR_CORS_001` | 403 | Origin not allowed | Request origin not in CORS whitelist |
| `ERR_METHOD_001` | 405 | Method not allowed | Used GET, PUT, DELETE, etc. instead of POST |
| `ERR_PAYLOAD_001` | 413 | Payload too large | Request body exceeds 50KB limit |
| `ERR_CONFIG_001` | 500 | Service unavailable | `GEMINI_API_KEY` not set in environment |
| `ERR_GEMINI_001` | varies | Gemini API error | Upstream Gemini API returned non-200 status |
| `ERR_NOTFOUND_001` | 404 | Endpoint not found | Path is not `/api/chat` or `/api/gemini` |
| `ERR_INPUT_001` | 400 | Invalid input | Malformed request body |
| `ERR_INTERNAL_001` | 500 | Internal error | Unhandled exception in handler |

## Limits

| Limit | Value | Configurable |
|-------|-------|-------------|
| Max request body | 50KB | `MAX_BODY_SIZE` in api/index.js |
| Max AI response tokens | 900 | `MAX_TOKENS` in chat client |
| Conversation history | 5 message pairs | `MAX_HISTORY` in chat client |
| Rate limiting | Not implemented | See [RATE-LIMITING.md](RATE-LIMITING.md) |

## Gemini Model

Both endpoints use `gemini-2.5-flash` via the Google Generative Language API v1beta.

```
https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
```
