// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';

const loadConversation = vi.fn();

vi.mock('../../../src/chat/conversations-api.js', () => ({
  loadConversation,
  createConversation: vi.fn(),
  deleteConversation: vi.fn(),
  requestTitle: vi.fn(),
  ConversationLimitError: class extends Error {},
}));

vi.mock('../../../src/chat/limit-dialog.js', () => ({ askWhichToDelete: vi.fn() }));
vi.mock('../../../src/shared/api-client.js', () => ({ fetchWithAuth: vi.fn() }));

const typedConstructor = vi.fn();
globalThis.Typed = class {
  constructor(...args) {
    typedConstructor(...args);
  }
  destroy() {}
};
globalThis.marked = { parse: (text) => `<p>${text}</p>` };

const { openConversation } = await import('../../../src/chat/handlers.js');

function elementsFixture() {
  document.body.innerHTML = `
    <div id="chat-messages"></div>
    <input id="user-input">
    <button id="submit-button"></button>
    <button id="stop-button"></button>
    <button id="export-button"></button>`;
  return {
    chatMessages: document.getElementById('chat-messages'),
    userInput: document.getElementById('user-input'),
    submitButton: document.getElementById('submit-button'),
    stopButton: document.getElementById('stop-button'),
    exportButton: document.getElementById('export-button'),
  };
}

describe('opening a saved conversation', () => {
  beforeEach(() => {
    typedConstructor.mockReset();
    loadConversation.mockReset().mockResolvedValue({
      conversation: { id: 'c1', title: 'Risoto' },
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'Como faco risoto?',
          created_at: '2026-09-20T14:32:00Z',
        },
        { id: 'm2', role: 'model', content: 'Com paciencia.', created_at: '2026-09-20T14:33:00Z' },
      ],
    });
  });

  it('never runs the typing animation on stored messages', async () => {
    const elements = elementsFixture();

    await openConversation('c1', elements, (html) => html);

    expect(typedConstructor).not.toHaveBeenCalled();
  });

  it('renders every stored message at once', async () => {
    const elements = elementsFixture();

    await openConversation('c1', elements, (html) => html);

    const rendered = elements.chatMessages.querySelectorAll('.message');
    expect(rendered).toHaveLength(3);
    expect(rendered[1].classList.contains('user')).toBe(true);
    expect(rendered[2].classList.contains('bot')).toBe(true);
  });

  it('shows the text of each message instead of an empty bubble', async () => {
    const elements = elementsFixture();

    await openConversation('c1', elements, (html) => html);

    const contents = [...elements.chatMessages.querySelectorAll('.message-content')].map(
      (node) => node.textContent
    );
    expect(contents.slice(1)).toEqual(['Como faco risoto?', 'Com paciencia.']);
  });

  it('keeps the original time of each message, not the time you opened it', async () => {
    const elements = elementsFixture();

    await openConversation('c1', elements, (html) => html);

    const stamps = [...elements.chatMessages.querySelectorAll('.timestamp')].map(
      (node) => node.textContent
    );
    expect(stamps[0]).not.toBe(stamps[1]);
  });

  it('replaces whatever was on screen instead of appending to it', async () => {
    const elements = elementsFixture();
    elements.chatMessages.innerHTML = '<div class="message bot">antiga</div>';

    await openConversation('c1', elements, (html) => html);

    expect(elements.chatMessages.textContent).not.toContain('antiga');
    expect(elements.chatMessages.querySelectorAll('.message')).toHaveLength(3);
  });

  it('opens with the greeting, the same as a new chat does', async () => {
    const elements = elementsFixture();

    await openConversation('c1', elements, (html) => html);

    const first = elements.chatMessages.querySelector('.message');
    expect(first.classList.contains('bot')).toBe(true);
    expect(first.textContent).toContain('Sou o GastroAI');
  });

  it('enables the PDF button once there are messages', async () => {
    const elements = elementsFixture();

    await openConversation('c1', elements, (html) => html);

    expect(elements.exportButton.disabled).toBe(false);
  });

  it('clears the previous conversation before the new one arrives', async () => {
    const elements = elementsFixture();
    elements.chatMessages.innerHTML = '<div class="message bot">conversa anterior</div>';

    let release;
    loadConversation.mockReturnValue(
      new Promise((resolve) => {
        release = () =>
          resolve({
            conversation: { id: 'c1' },
            messages: [{ id: 'm1', role: 'user', content: 'nova', created_at: 'x' }],
          });
      })
    );

    const pending = openConversation('c1', elements, (html) => html);

    expect(elements.chatMessages.textContent).not.toContain('conversa anterior');
    expect(elements.chatMessages.querySelector('.conversation-loading')).not.toBeNull();

    release();
    await pending;

    expect(elements.chatMessages.querySelector('.conversation-loading')).toBeNull();
    expect(elements.chatMessages.textContent).toContain('nova');
  });

  it('ignores a slow answer for a conversation you already moved away from', async () => {
    const elements = elementsFixture();

    const resolvers = {};
    loadConversation.mockImplementation(
      (id) =>
        new Promise((resolve) => {
          resolvers[id] = () =>
            resolve({
              conversation: { id },
              messages: [{ id: 'm', role: 'user', content: `mensagem de ${id}`, created_at: 'x' }],
            });
        })
    );

    const slow = openConversation('c1', elements, (html) => html);
    const fast = openConversation('c2', elements, (html) => html);

    resolvers.c2();
    await fast;
    resolvers.c1();
    await slow;

    expect(elements.chatMessages.textContent).toContain('mensagem de c2');
    expect(elements.chatMessages.textContent).not.toContain('mensagem de c1');
  });
});
