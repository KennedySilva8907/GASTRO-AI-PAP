// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';

const { confirmDeleteConversation } = await import('../../../src/chat/confirm-dialog.js');

describe('delete confirmation dialog', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main id="chat-container"></main>';
  });

  it('uses the same card as the limit screen', () => {
    confirmDeleteConversation('Risoto de cogumelos');

    expect(document.querySelector('.dialog-backdrop')).not.toBeNull();
    expect(document.querySelector('.dialog')).not.toBeNull();
    expect(document.querySelector('.button-danger')).not.toBeNull();
  });

  it('names the conversation being deleted', () => {
    confirmDeleteConversation('Risoto de cogumelos');

    expect(document.querySelector('.dialog h2').textContent).toContain('Risoto de cogumelos');
  });

  it('says it cannot be undone', () => {
    confirmDeleteConversation('Risoto');

    expect(document.querySelector('.dialog-warning').textContent).toContain('não tem volta');
  });

  it('resolves true on confirm and clears itself off the page', async () => {
    const answer = confirmDeleteConversation('Risoto');

    document.querySelector('.button-danger').click();

    await expect(answer).resolves.toBe(true);
    expect(document.querySelector('.dialog-backdrop')).toBeNull();
  });

  it('resolves false on cancel', async () => {
    const answer = confirmDeleteConversation('Risoto');

    document.querySelector('.button-ghost').click();

    await expect(answer).resolves.toBe(false);
  });

  it('resolves false on Escape', async () => {
    const answer = confirmDeleteConversation('Risoto');

    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));

    await expect(answer).resolves.toBe(false);
  });

  it('resolves false when the backdrop is clicked', async () => {
    const answer = confirmDeleteConversation('Risoto');

    document.querySelector('.dialog-backdrop').click();

    await expect(answer).resolves.toBe(false);
  });

  it('stays open when the card itself is clicked', () => {
    confirmDeleteConversation('Risoto');

    document.querySelector('.dialog').click();

    expect(document.querySelector('.dialog-backdrop')).not.toBeNull();
  });
});
