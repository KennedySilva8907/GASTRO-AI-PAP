# Rate Limiting Strategy

## Current State

GASTRO-AI currently has no rate limiting implemented. The following mitigations exist:

- **Request body size limit:** 50KB (`MAX_BODY_SIZE` in `api/index.js`)
- **AI response token limit:** 900 tokens (`MAX_TOKENS` in chat script)
- **Conversation history limit:** 5 message pairs (`MAX_HISTORY` in chat script)

## Gemini API Quota Considerations

The application proxies requests to Google's Gemini API (gemini-2.5-flash). Key quota factors:

- **Free tier:** Limited requests per minute (RPM) and tokens per minute (TPM)
- **Cost exposure:** Each user chat message = 1 Gemini API call
- **Risk:** Without rate limiting, a single user could exhaust the API quota

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

1. Vercel serverless functions are stateless -- in-memory rate limiting resets on cold starts
2. For production, consider Vercel KV or Upstash Redis for persistent counters
3. Include `Retry-After` header in 429 responses
4. Return user-friendly error: "Too many requests. Please wait a moment."

### Headers to Include

```
X-RateLimit-Limit: {max}
X-RateLimit-Remaining: {remaining}
X-RateLimit-Reset: {reset_timestamp}
```

## Why Not Implemented Now

Rate limiting is deferred to v2.1 because:
1. Current mitigations (body size, token limits) provide basic protection
2. Proper implementation requires persistent storage (Redis/KV) for serverless
3. Phase 2 focuses on CORS, XSS, and error handling first
4. Testing infrastructure (Phase 4) should exist before adding middleware
