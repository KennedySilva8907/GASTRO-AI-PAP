# Rate Limiting Strategy

## Current State

GASTRO-AI currently has no application-level rate limiting. The following mitigations exist:

- **Request body size limit:** 50 KB (`MAX_BODY_SIZE` in `api/_shared.js`)
- **Chat response token limit:** 3072 tokens (`CHAT_MAX_OUTPUT_TOKENS` in `api/chat.js`)
- **Chat user message length limit:** 500 chars (`CHAT_MESSAGE_MAX_LENGTH` in `api/chat.js`)
- **Conversation history limit (server):** 10 entries (`CHAT_HISTORY_MAX_ENTRIES` in `api/chat.js`)
- **Conversation history limit (client):** 5 message pairs (`MAX_HISTORY_PAIRS` in `src/chat/chat-api.js`)

## Groq API Quota Considerations

The application proxies requests to Groq (`openai/gpt-oss-120b`). Key quota factors:

- **Free tier:** Groq enforces requests-per-minute (RPM) and tokens-per-minute (TPM) limits per account. The free tier is more generous than Gemini's was, which is part of why we [migrated](api.md#migration-from-gemini-april-2026), but it is still finite.
- **Cost exposure:** each user chat message = 1 Groq API call; each generated challenge recipe = up to 2 calls (initial + retry on parse failure in `src/challenges/recipe-api.js`).
- **Risk:** without app-level rate limiting, a single user (or a noisy script) can exhaust the account quota and degrade the experience for everyone.

## Recommended Implementation (v2.1)

### Library

Use `express-rate-limit` v8.3.1 (already in package.json dependencies).

### Proposed Limits

| Endpoint | Window | Max Requests | Rationale |
|----------|--------|-------------|-----------|
| POST /api/chat | 1 minute | 10 | Normal chat: ~3-5 messages/min |
| POST /api/gemini | 1 minute | 5 | Recipe generation is less frequent |
| All endpoints | 15 minutes | 100 | Global safety net |

### Implementation Notes

1. Vercel serverless functions are stateless — in-memory rate limiting resets on cold starts
2. For production, consider Vercel KV or Upstash Redis for persistent counters
3. Include `Retry-After` header in 429 responses
4. Return user-friendly error: "Too many requests. Please wait a moment."
5. When the upstream Groq quota is the bottleneck (not us), the handler already surfaces it as `ERR_GROQ_001` with the upstream HTTP status. App-level limiting should kick in *before* we get there to avoid burning user-facing failures on quota.

### Headers to Include

```
X-RateLimit-Limit: {max}
X-RateLimit-Remaining: {remaining}
X-RateLimit-Reset: {reset_timestamp}
```

## Why Not Implemented Now

Rate limiting is deferred to v2.1 because:

1. Current mitigations (body size, token limits, history caps) provide basic protection
2. Proper implementation requires persistent storage (Redis/KV) for serverless
3. Phase 2 focused on CORS, XSS, and error handling first
4. Testing infrastructure (Phase 4) should exist before adding middleware
