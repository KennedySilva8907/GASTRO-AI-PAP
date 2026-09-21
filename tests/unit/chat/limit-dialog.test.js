// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';

const { askWhichToDelete } = await import('../../../src/chat/limit-dialog.js');

const conversations = [
  {
    id: 'c1',
    title: 'Risoto',
    updated_at: '2026-09-20T10:00:00.000Z',
    message_count: 8,
  },
  {
    id: 'c2',
    title: 'Natal',
    updated_at: '2026-09-18T10:00:00.000Z',
    message_count: 12,
  },
  {
    id: 'c3',
    title: null,
    updated_at: '2026-09-13T10:00:00.000Z',
    message_count: 4,
  },
];

describe('limit dialog', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main id="chat-container"></main>';
  });

  it('pre-selects the oldest conversation', () => {
    askWhichToDelete({ conversations });

    expect(document.querySelector('.choice input:checked').value).toBe('c3');
  });

  it('marks the oldest one so the pre-selection is not a mystery', () => {
    askWhichToDelete({ conversations });

    expect(document.querySelector('.choice-flag').textContent).toBe('mais antiga');
  });

  it('names an untitled conversation instead of showing an empty row', () => {
    askWhichToDelete({ conversations });

    const titles = [...document.querySelectorAll('.choice-title')].map((node) =>
      node.firstChild.textContent.trim()
    );

    expect(titles).toContain('Conversa nova');
  });

  it('lists the conversations oldest first', () => {
    askWhichToDelete({ conversations });

    const values = [...document.querySelectorAll('.choice input')].map((input) => input.value);

    expect(values).toEqual(['c3', 'c2', 'c1']);
  });

  it('resolves with the chosen id', async () => {
    const promise = askWhichToDelete({ conversations });

    document.querySelector('input[value="c2"]').checked = true;
    document.querySelector('.button-danger').click();

    await expect(promise).resolves.toBe('c2');
  });

  it('resolves with null on cancel and takes itself off the page', async () => {
    const promise = askWhichToDelete({ conversations });

    document.querySelector('.button-ghost').click();

    await expect(promise).resolves.toBeNull();
    expect(document.querySelector('.dialog-backdrop')).toBeNull();
  });

  it('closes on Escape', async () => {
    const promise = askWhichToDelete({ conversations });

    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));

    await expect(promise).resolves.toBeNull();
  });

  it('closes when the backdrop itself is clicked', async () => {
    const promise = askWhichToDelete({ conversations });

    document.querySelector('.dialog-backdrop').click();

    await expect(promise).resolves.toBeNull();
  });

  it('stays open when the dialog body is clicked', () => {
    askWhichToDelete({ conversations });

    document.querySelector('.dialog').click();

    expect(document.querySelector('.dialog-backdrop')).not.toBeNull();
  });

  it('says how many the plan allows', () => {
    askWhichToDelete({ conversations, limit: 3 });

    expect(document.querySelector('.dialog h2').textContent).toContain('3');
  });
});
