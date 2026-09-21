import { describe, it, expect } from 'vitest';
import { createConversationStore } from '../../../api/_conversations.js';

function fakeSupabase() {
  const calls = [];

  function builder(table, operation) {
    const filters = [];
    const chain = {
      table,
      operation,
      filters,
      select() {
        return chain;
      },
      insert() {
        return chain;
      },
      update() {
        return chain;
      },
      delete() {
        return chain;
      },
      eq(column, value) {
        filters.push({ column, value });
        return chain;
      },
      order() {
        return chain;
      },
      limit() {
        return chain;
      },
      maybeSingle() {
        return Promise.resolve({ data: null, error: null });
      },
      single() {
        return Promise.resolve({ data: { id: 'x' }, error: null });
      },
      then(resolve) {
        return Promise.resolve({ data: [], error: null, count: 0 }).then(resolve);
      },
    };
    calls.push(chain);
    return chain;
  }

  return {
    calls,
    from(table) {
      const chain = builder(table);
      const wrap =
        (name) =>
        (...args) => {
          chain.operation = name;
          chain[`${name}Args`] = args;
          return chain;
        };
      return {
        ...chain,
        select: wrap('select'),
        insert: wrap('insert'),
        update: wrap('update'),
        delete: wrap('delete'),
      };
    },
  };
}

function filtersOf(db, table, operation) {
  const call = db.calls.find((c) => c.table === table && c.operation === operation);
  return call ? call.filters : null;
}

describe('the store filters by user at the database, not just in the handler', () => {
  it('reading one conversation filters by id and by user', async () => {
    const db = fakeSupabase();
    await createConversationStore(db).getOwned({ conversationId: 'c1', userId: 'u1' });

    const filters = filtersOf(db, 'conversations', 'select');

    expect(filters).toContainEqual({ column: 'id', value: 'c1' });
    expect(filters).toContainEqual({ column: 'user_id', value: 'u1' });
  });

  it('deleting filters by id and by user', async () => {
    const db = fakeSupabase();
    await createConversationStore(db).remove({ conversationId: 'c1', userId: 'u1' });

    const filters = filtersOf(db, 'conversations', 'delete');

    expect(filters).toContainEqual({ column: 'id', value: 'c1' });
    expect(filters).toContainEqual({ column: 'user_id', value: 'u1' });
  });

  it('listing filters by user', async () => {
    const db = fakeSupabase();
    await createConversationStore(db).listForUser('u1');

    expect(filtersOf(db, 'conversations', 'select')).toContainEqual({
      column: 'user_id',
      value: 'u1',
    });
  });

  it('returns nothing when there is no service role client', () => {
    expect(createConversationStore(null)).toBeNull();
  });
});
