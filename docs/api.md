# API Reference

GastroAI exposes two Vercel serverless functions that proxy requests to the [Groq API](https://console.groq.com/docs). All endpoints require POST method and accept JSON bodies.

| File | Endpoint | Purpose |
|------|----------|---------|
| `api/chat.js` | `/api/chat` | Chat assistant — accepts `{ message, history }` and builds the prompt server-side |
| `api/gemini.js` | `/api/gemini` | Recipe generation — accepts the legacy Gemini-shaped body the challenge client already sends |
| `api/_shared.js` | _(internal, not an endpoint)_ | CORS, preflight, `callGroq`, and the Gemini ↔ Groq translation helpers |

## Migration from Gemini (April 2026)

The backend originally proxied Google's Gemini API (`gemini-2.5-flash`). It was replaced by Groq (`openai/gpt-oss-120b`) on **2026-04-29**.

### Why we moved

1. **Reliability under load.** During the V2 redesign work, `gemini-2.5-flash` repeatedly returned `503 — This model is currently experiencing high demand` mid-conversation. The model is popular and shares quota with everyone on the free tier.
2. **Free-tier rate limits.** Even with single-user testing, normal back-and-forth chat hit `429 Too Many Requests` because Gemini's free tier has a low requests-per-minute ceiling. That made dev work and grading the project risky.
3. **Latency.** Groq's inference is significantly faster than Gemini for comparable model sizes — relevant for a chat experience where response time is felt directly.
4. **Quota headroom.** Groq's free tier is more generous on RPM/TPM, which removes the "your assistant just stopped working mid-demo" risk for the academic presentation (PAP).

### What changed under the hood

- `GROQ_API_URL = https://api.groq.com/openai/v1/chat/completions`
- Authentication moved from `x-goog-api-key` header to `Authorization: Bearer <key>`
- Request payload moved from Gemini's `contents` / `parts` shape to OpenAI's `messages` array. History role `model` is mapped to `assistant`. `systemInstruction.parts[].text` is mapped to a `{ role: "system", content: ... }` message. `safetySettings` are dropped (Groq has no equivalent — moderation is delegated to the system prompt).
- Response is unwrapped from OpenAI's `choices[0].message.content` and **re-wrapped in the original Gemini envelope** before being returned to the client. This was a deliberate choice so that no frontend code (chat or recipe parsers) had to change.
- Error code `ERR_GEMINI_001` was renamed to `ERR_GROQ_001`.
- `api/index.js` (the old single-file router) was split into `api/chat.js` + `api/gemini.js` + `api/_shared.js` so each endpoint maps cleanly to a Vercel serverless function.

### Why the `/api/gemini` path was kept

The recipe client at `src/challenges/recipe-api.js` builds Gemini-shaped request bodies and posts to `/api/gemini`. Renaming the path would have meant touching the frontend on top of the provider switch. Keeping the path scoped the change to the backend only and let us verify the migration with the existing tests. The path is a stable URL — only the implementation moved.

## Base URL

- **Local:** `http://localhost:3000/api`
- **Production:** `https://gastro-ai-pap.vercel.app/api`

## Authentication

No client-side authentication. The serverless function injects `GROQ_API_KEY` server-side via the `Authorization: Bearer …` header. Clients never see the API key.

## CORS Policy

Origin validation uses a three-tier check:

1. **No Origin header** (server-to-server, curl, Postman) — allowed
2. **Same-origin** (Origin matches server host) — allowed
3. **Whitelist** (`localhost:5173`, `localhost:3000`, `PRODUCTION_URL` env var) — allowed
4. **Everything else** — rejected with `ERR_CORS_001`

## Endpoints

### POST /api/chat

Builds the chat request server-side from a chef-persona system prompt + sanitized history + the latest user message, then forwards to Groq. The response is re-wrapped in the legacy Gemini envelope before being returned.

**Request:**

```json
{
  "message": "What spices go well with salmon?",
  "history": [
    { "role": "user",  "text": "I have salmon for dinner." },
    { "role": "model", "text": "Great choice. Lighter or richer profile?" }
  ]
}
```

**Response (200):**

```json
{
  "candidates": [
    {
      "content": {
        "role": "model",
        "parts": [{ "text": "Great pairings for salmon include dill, lemon pepper..." }]
      },
      "finishReason": "STOP"
    }
  ]
}
```

**What the server actually sends to Groq (for reference):**

```json
{
  "model": "openai/gpt-oss-120b",
  "messages": [
    { "role": "system",    "content": "És o GastroAI, um chef português..." },
    { "role": "user",      "content": "I have salmon for dinner." },
    { "role": "assistant", "content": "Great choice. Lighter or richer profile?" },
    { "role": "user",      "content": "What spices go well with salmon?" }
  ],
  "temperature": 0.7,
  "max_tokens": 3072
}
```

### POST /api/gemini

Accepts the Gemini-shaped body the recipe client already builds, translates it to Groq's OpenAI-format request server-side, and re-wraps the response in the Gemini envelope.

**Request:** Whatever `src/challenges/recipe-api.js` already sends — `{ contents: [...], systemInstruction?, generationConfig?, safetySettings? }`. `safetySettings` are silently dropped (no Groq equivalent).

**Response (200):** Same Gemini-envelope shape as `/api/chat`.

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
| `ERR_PAYLOAD_001` | 413 | Payload too large | Request body exceeds 50 KB limit |
| `ERR_INPUT_001` | 400 | Invalid input | Malformed request body |
| `ERR_CONFIG_001` | 500 | Service unavailable | `GROQ_API_KEY` not set in environment |
| `ERR_GROQ_001` | varies | Upstream API error | Groq returned non-2xx status |
| `ERR_INTERNAL_001` | 500 | Internal error | Unhandled exception in the handler |

> `ERR_NOTFOUND_001` is no longer emitted by the application code. Unknown paths under `/api/*` are now handled by the Vercel platform itself (404), since each endpoint is its own file rather than a manual router.

## Limits

| Limit | Value | Configurable |
|-------|-------|-------------|
| Max request body | 50 KB | `MAX_BODY_SIZE` in `api/_shared.js` |
| Max chat response tokens | 3072 | `CHAT_MAX_OUTPUT_TOKENS` in `api/chat.js` |
| Max chat user message length | 500 chars | `CHAT_MESSAGE_MAX_LENGTH` in `api/chat.js` |
| Max chat history entries (server) | 10 | `CHAT_HISTORY_MAX_ENTRIES` in `api/chat.js` |
| Conversation history (client) | 5 message pairs | `MAX_HISTORY_PAIRS` in `src/chat/chat-api.js` |
| Rate limiting | Not implemented | See [RATE-LIMITING.md](RATE-LIMITING.md) |

## Model

Both endpoints use `openai/gpt-oss-120b` via Groq's OpenAI-compatible chat-completions endpoint:

```
https://api.groq.com/openai/v1/chat/completions
```
