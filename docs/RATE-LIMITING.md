# Rate Limiting Strategy

## Current State

V3 adds authenticated, plan-aware daily usage limits before Groq calls. The following mitigations exist:

- **Request body size limit:** 50 KB (`MAX_BODY_SIZE` in `api/_shared.js`)
- **Chat response token limit:** 3072 tokens (`CHAT_MAX_OUTPUT_TOKENS` in `api/chat.js`)
- **Chat user message length limit:** 500 chars (`CHAT_MESSAGE_MAX_LENGTH` in `api/chat.js`)
- **Conversation history limit (server):** 10 entries (`CHAT_HISTORY_MAX_ENTRIES` in `api/chat.js`)
- **Conversation history limit (client):** 5 message pairs (`MAX_HISTORY_PAIRS` in `src/chat/chat-api.js`)
- **Authenticated usage gate:** Supabase user ID required before `/api/chat` and `/api/gemini`
- **Daily quotas:** Free and Pro limits in `PLAN_LIMITS` (`api/_usage.js`)

## Groq API Quota Considerations

The application proxies requests to Groq (`openai/gpt-oss-120b`). Key quota factors:

- **Free tier:** Groq enforces requests-per-minute (RPM) and tokens-per-minute (TPM) limits per account. The free tier is more generous than Gemini's was, which is part of why we [migrated](api.md#migration-from-gemini-april-2026), but it is still finite.
- **Cost exposure:** each user chat message = 1 Groq API call; each generated challenge recipe = up to 2 calls (initial + retry on parse failure in `src/challenges/recipe-api.js`).
- **Risk:** without app-level rate limiting, a single user (or a noisy script) can exhaust the account quota and degrade the experience for everyone.

## Implemented V3 Limits

| Endpoint         | Window | Max Requests      | Rationale                                             |
| ---------------- | ------ | ----------------- | ----------------------------------------------------- |
| POST /api/chat   | 1 day  | 10 Free / 100 Pro | Chat is the main AI feature                           |
| POST /api/gemini | 1 day  | 3 Free / 30 Pro   | Recipe generation is less frequent but more expensive |

### Implementation Notes

1. Vercel serverless functions are stateless, so counters are persisted in Supabase Postgres.
2. Quotas are keyed by `user_id`, feature, and UTC date in `daily_usage`.
3. Every allowed request inserts a `usage_events` row for audit/history.
4. Exhausted limits return `429` with `ERR_RATE_LIMIT_001`.
5. When the upstream Groq quota is the bottleneck, the handler still surfaces it as `ERR_GROQ_001`.

### Headers to Include

```text
X-RateLimit-Limit: {max}
X-RateLimit-Remaining: {remaining}
X-RateLimit-Reset: {reset_timestamp}
```

## Remaining Improvements

1. Add short-window abuse limits, for example requests per minute, to complement daily quotas.
2. Add `Retry-After` and `X-RateLimit-*` headers to 429 responses.
3. Consider Upstash Redis or Vercel KV for high-volume counters if Supabase write pressure becomes a bottleneck.
