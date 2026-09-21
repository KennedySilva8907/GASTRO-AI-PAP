const cache = new Map();

export const PREFETCH_LIMIT = 5;

export function getCached(id) {
  return cache.get(id) || null;
}

export function setCached(id, payload) {
  cache.set(id, payload);
}

export function dropCached(id) {
  cache.delete(id);
}

export function clearCache() {
  cache.clear();
}

export function sameConversation(a, b) {
  if (!a || !b) return false;
  if (a.messages.length !== b.messages.length) return false;
  if (a.conversation?.title !== b.conversation?.title) return false;
  return a.messages.every((message, index) => message.id === b.messages[index]?.id);
}

export function prefetchConversations(conversations, loader, limit = PREFETCH_LIMIT) {
  const pending = conversations
    .filter((conversation) => conversation.message_count > 0 && !cache.has(conversation.id))
    .slice(0, limit);

  return Promise.all(
    pending.map((conversation) =>
      loader(conversation.id)
        .then((payload) => setCached(conversation.id, payload))
        .catch(() => {})
    )
  );
}
