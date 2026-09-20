import { getSupabaseAdminClient } from './_supabase.js';

export const FREE_CONVERSATION_LIMIT = 3;
export const TITLE_MAX_LENGTH = 60;

export function sanitizeTitle(raw) {
  if (typeof raw !== 'string') return null;

  const cleaned = raw
    .replace(/\s+/g, ' ')
    .replace(/^[#>\s]+/, '')
    .replace(/[*_`]/g, '')
    .replace(/^["'«»“”]+|["'«»“”]+$/g, '')
    .trim();

  if (!cleaned) return null;
  return cleaned.slice(0, TITLE_MAX_LENGTH);
}

export function buildHistory(messages, maxEntries) {
  if (!Array.isArray(messages)) return [];

  const mapped = [];
  for (const message of messages) {
    const text = typeof message?.content === 'string' ? message.content.trim() : '';
    if (!text) continue;
    mapped.push({ role: message.role === 'model' ? 'model' : 'user', text });
  }

  return mapped.slice(-maxEntries);
}

export function isOverConversationLimit({ plan, count }) {
  if (plan === 'pro') return false;
  return count >= FREE_CONVERSATION_LIMIT;
}

export function createConversationStore(supabase = getSupabaseAdminClient()) {
  if (!supabase) return null;

  async function listForUser(userId) {
    const { data, error } = await supabase
      .from('conversations')
      .select('id,title,created_at,updated_at,conversation_messages(count)')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((row) => ({
      id: row.id,
      title: row.title,
      created_at: row.created_at,
      updated_at: row.updated_at,
      message_count: row.conversation_messages?.[0]?.count ?? 0,
    }));
  }

  return {
    listForUser,

    async create(userId) {
      const { data, error } = await supabase
        .from('conversations')
        .insert({ user_id: userId })
        .select('id,title,created_at,updated_at')
        .single();

      if (error) throw error;
      return { ...data, message_count: 0 };
    },

    async getOwned({ conversationId, userId }) {
      const { data, error } = await supabase
        .from('conversations')
        .select('id,title,created_at,updated_at')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    async listMessages(conversationId) {
      const { data, error } = await supabase
        .from('conversation_messages')
        .select('id,role,content,created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },

    async appendMessage({ conversationId, role, content }) {
      const { error } = await supabase
        .from('conversation_messages')
        .insert({ conversation_id: conversationId, role, content });

      if (error) throw error;

      const { error: touchError } = await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      if (touchError) throw touchError;
    },

    async setTitle({ conversationId, title }) {
      const { error } = await supabase
        .from('conversations')
        .update({ title })
        .eq('id', conversationId);

      if (error) throw error;
    },

    async remove({ conversationId, userId }) {
      const { error, count } = await supabase
        .from('conversations')
        .delete({ count: 'exact' })
        .eq('id', conversationId)
        .eq('user_id', userId);

      if (error) throw error;
      return count > 0;
    },
  };
}
