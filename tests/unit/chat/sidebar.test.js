// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';

const listConversations = vi.fn();
const deleteConversation = vi.fn();

vi.mock('../../../src/chat/conversations-api.js', () => ({
  listConversations,
  deleteConversation,
}));

const confirmDeleteConversation = vi.fn();
vi.mock('../../../src/chat/confirm-dialog.js', () => ({ confirmDeleteConversation }));

const store = new Map();
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  },
});

const { initSidebar } = await import('../../../src/chat/sidebar.js');

function mountRoot() {
  document.body.innerHTML = `
    <main id="chat-container">
      <aside class="chat-sidebar" id="chat-sidebar">
        <div class="chat-sidebar-head">
          <button class="sidebar-toggle" id="sidebar-toggle" aria-expanded="true"></button>
          <span class="sidebar-label"><span class="sidebar-kicker">Conversas</span></span>
          <button class="new-chat-button" id="new-chat-button"></button>
        </div>
        <div class="conversation-list" id="conversation-list"></div>
        <div class="sidebar-foot" id="sidebar-foot">
          <span class="sidebar-foot-text"></span>
        </div>
      </aside>
      <div class="scrim" id="sidebar-scrim" hidden></div>
    </main>`;
  return document.getElementById('chat-sidebar');
}

function build(overrides = {}) {
  return initSidebar({
    root: mountRoot(),
    scrim: document.getElementById('sidebar-scrim'),
    onSelect: vi.fn(),
    onNew: vi.fn(),
    ...overrides,
  });
}

describe('sidebar', () => {
  beforeEach(() => {
    listConversations.mockReset().mockResolvedValue([
      {
        id: 'c1',
        title: 'Risoto de cogumelos',
        updated_at: new Date().toISOString(),
        message_count: 8,
      },
      {
        id: 'c2',
        title: null,
        updated_at: new Date().toISOString(),
        message_count: 0,
      },
    ]);
    deleteConversation.mockReset().mockResolvedValue(true);
    confirmDeleteConversation.mockReset().mockResolvedValue(true);
    window.localStorage.clear();
  });

  it('renders one item per conversation with an initial badge', async () => {
    const sidebar = build();
    await sidebar.refresh();

    const items = document.querySelectorAll('.conversation-item');

    expect(items).toHaveLength(2);
    expect(items[0].querySelector('.conversation-badge').textContent).toBe('R');
  });

  it('names an untitled conversation instead of leaving it blank', async () => {
    const sidebar = build();
    await sidebar.refresh();

    const titles = document.querySelectorAll('.conversation-title');

    expect(titles[1].textContent).toBe('Conversa nova');
  });

  it('puts the title on every item so the rail stays readable when collapsed', async () => {
    const sidebar = build();
    await sidebar.refresh();

    const item = document.querySelector('.conversation-item');

    expect(item.getAttribute('title')).toBe('Risoto de cogumelos');
    expect(item.getAttribute('aria-label')).toBe('Risoto de cogumelos');
  });

  it('remembers the collapsed state across mounts', async () => {
    const first = build();
    first.collapse();

    expect(window.localStorage.getItem('gastro-sidebar-collapsed')).toBe('true');

    const second = build();

    expect(second.isCollapsed()).toBe(true);
    expect(document.getElementById('chat-sidebar').classList.contains('is-collapsed')).toBe(true);
  });

  it('takes hidden controls out of the tab order when collapsed', async () => {
    const sidebar = build();
    await sidebar.refresh();
    sidebar.collapse();

    const remove = document.querySelector('.conversation-delete');

    expect(remove.getAttribute('tabindex')).toBe('-1');
    expect(remove.getAttribute('aria-hidden')).toBe('true');
  });

  it('puts them back in the tab order when expanded again', async () => {
    const sidebar = build();
    await sidebar.refresh();
    sidebar.collapse();
    sidebar.expand();

    const remove = document.querySelector('.conversation-delete');

    expect(remove.getAttribute('tabindex')).toBe('0');
    expect(remove.getAttribute('aria-hidden')).toBe('false');
  });

  it('toggles from the button and keeps aria-expanded honest', async () => {
    const sidebar = build();
    const toggle = document.getElementById('sidebar-toggle');

    toggle.click();

    expect(sidebar.isCollapsed()).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.click();

    expect(sidebar.isCollapsed()).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('calls onSelect with the conversation id when an item is clicked', async () => {
    const onSelect = vi.fn();
    const sidebar = build({ onSelect });
    await sidebar.refresh();

    document.querySelector('.conversation-item').click();

    expect(onSelect).toHaveBeenCalledWith('c1');
  });

  it('calls onNew when the plus button is clicked', async () => {
    const onNew = vi.fn();
    build({ onNew });

    document.getElementById('new-chat-button').click();

    expect(onNew).toHaveBeenCalled();
  });

  it('marks the active conversation', async () => {
    const sidebar = build();
    await sidebar.refresh();
    sidebar.setActive('c2');

    const items = document.querySelectorAll('.conversation-item');

    expect(items[0].classList.contains('is-active')).toBe(false);
    expect(items[1].classList.contains('is-active')).toBe(true);
  });

  it('takes the row off the list straight away, without refetching', async () => {
    const sidebar = build();
    await sidebar.refresh();

    await document.querySelector('.conversation-delete').onclick(new window.Event('click'));

    expect(deleteConversation).toHaveBeenCalledWith('c1');
    expect(document.querySelectorAll('.conversation-item')).toHaveLength(1);
    expect(listConversations).toHaveBeenCalledTimes(1);
  });

  it('puts the row back where it was when the delete fails', async () => {
    deleteConversation.mockRejectedValue(new Error('rede em baixo'));
    const sidebar = build();
    await sidebar.refresh();

    await document
      .querySelector('.conversation-delete')
      .onclick(new window.Event('click'))
      .catch(() => {});

    const items = document.querySelectorAll('.conversation-item');
    expect(items).toHaveLength(2);
    expect(items[0].dataset.id).toBe('c1');
  });

  it('does not delete when the user says no', async () => {
    confirmDeleteConversation.mockResolvedValue(false);
    const sidebar = build();
    await sidebar.refresh();

    await document.querySelector('.conversation-delete').onclick(new window.Event('click'));

    expect(deleteConversation).not.toHaveBeenCalled();
  });

  it('asks with the in-app dialog rather than the browser one', async () => {
    const sidebar = build();
    await sidebar.refresh();

    await document.querySelector('.conversation-delete').onclick(new window.Event('click'));

    expect(confirmDeleteConversation).toHaveBeenCalledWith('Risoto de cogumelos');
  });

  it('shows how many slots a free account has left', async () => {
    const sidebar = build();
    await sidebar.refresh();
    sidebar.setPlan('free');

    expect(document.querySelector('.sidebar-foot-text').textContent).toContain('2 de 3');
  });

  it('hides the slot counter for a pro account', async () => {
    const sidebar = build();
    await sidebar.refresh();
    sidebar.setPlan('pro');

    expect(document.getElementById('sidebar-foot').hidden).toBe(true);
  });

  it('opens as a drawer and closes when the scrim is clicked', async () => {
    const sidebar = build();
    const scrim = document.getElementById('sidebar-scrim');

    sidebar.openDrawer();

    expect(document.getElementById('chat-sidebar').classList.contains('is-open')).toBe(true);
    expect(scrim.hidden).toBe(false);

    scrim.click();

    expect(document.getElementById('chat-sidebar').classList.contains('is-open')).toBe(false);
    expect(scrim.hidden).toBe(true);
  });
});
