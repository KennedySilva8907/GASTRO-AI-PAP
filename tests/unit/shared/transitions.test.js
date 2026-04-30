// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TRANSITION_SESSION_KEY,
  clearTransitionState,
  getAnchorCenter,
  navigateTo,
  prefersReducedMotion,
  readTransitionState,
  revealPage,
  writeTransitionState,
} from '../../../src/shared/transitions.js';

describe('transition state helpers', () => {
  beforeEach(() => {
    sessionStorage.clear();
    document.body.innerHTML = '';
    document.body.style.cssText = '';
    document.documentElement.style.cssText = '';
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
  });

  it('uses the stable sessionStorage key for transition metadata', () => {
    expect(TRANSITION_SESSION_KEY).toBe('gastro-transition-meta');
  });

  it('persists and reads the destination anchor metadata', () => {
    writeTransitionState({
      entryAnchor: '#back-button',
      origin: { x: 465, y: 841 },
    });

    expect(readTransitionState()).toEqual({
      entryAnchor: '#back-button',
      origin: { x: 465, y: 841 },
    });
  });

  it('clears the stored state', () => {
    sessionStorage.setItem(TRANSITION_SESSION_KEY, JSON.stringify({ entryAnchor: '#back-button' }));

    clearTransitionState();

    expect(readTransitionState()).toBeNull();
  });

  it('returns null and clears the key when transition metadata is invalid JSON', () => {
    sessionStorage.setItem(TRANSITION_SESSION_KEY, '{invalid');

    expect(readTransitionState()).toBeNull();
    expect(sessionStorage.getItem(TRANSITION_SESSION_KEY)).toBeNull();
  });

  it('returns the anchor center when the selector exists', () => {
    const button = document.createElement('button');
    button.id = 'chat-button';
    button.getBoundingClientRect = () => ({
      left: 400,
      top: 820,
      width: 130,
      height: 42,
      right: 530,
      bottom: 862,
      x: 400,
      y: 820,
      toJSON() {},
    });
    document.body.appendChild(button);

    expect(getAnchorCenter('#chat-button')).toEqual({ x: 465, y: 841 });
  });

  it('falls back to the viewport center when the selector is missing', () => {
    expect(getAnchorCenter('#missing', document, { innerWidth: 930, innerHeight: 882 })).toEqual({
      x: 465,
      y: 441,
    });
  });

  it('reads prefers-reduced-motion lazily instead of caching it at import time', () => {
    window.matchMedia.mockReturnValueOnce({ matches: true });
    expect(prefersReducedMotion()).toBe(true);
  });
});

describe('navigateTo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    document.body.innerHTML = '<button id="chat-button">Chat</button>';
    document.body.style.cssText = '';
    document.documentElement.style.cssText = '';
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });

    const button = document.getElementById('chat-button');
    button.getBoundingClientRect = () => ({
      left: 400,
      top: 820,
      width: 130,
      height: 42,
      right: 530,
      bottom: 862,
      x: 400,
      y: 820,
      toJSON() {},
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores the destination anchor and zooms the page into a button portal', () => {
    const navigate = vi.fn();
    const button = document.getElementById('chat-button');

    navigateTo('/chat/chatbot.html', { currentTarget: button }, { entryAnchor: '#back-button', navigate });

    expect(readTransitionState()).toEqual({
      entryAnchor: '#back-button',
      origin: { x: 465, y: 841 },
    });
    expect(document.documentElement.style.background).toContain('rgb(11, 9, 7)');
    expect(document.body.style.pointerEvents).toBe('none');
    expect(document.body.style.willChange).toBe('transform, opacity');
    expect(document.body.style.transformOrigin).toBe('465px 841px');
    expect(document.body.style.transition).toContain('transform 560ms');
    expect(document.body.style.transition).toContain('opacity 560ms');
    expect(document.body.style.clipPath).toBe('');
    expect(document.body.style.transform).toBe('translate3d(16px, -155px, 0) scale(1.28)');
    expect(document.body.style.opacity).toBe('0.38');
    expect(document.body.style.filter).toBe('');
    const portal = document.querySelector('[data-gastro-transition-portal="true"]');
    expect(portal).not.toBeNull();
    expect(portal.style.left).toBe('465px');
    expect(portal.style.top).toBe('841px');
    expect(portal.style.transform).toContain('scale(');
    expect(portal.style.opacity).toBe('1');

    vi.advanceTimersByTime(560);
    expect(navigate).toHaveBeenCalledWith('/chat/chatbot.html');
  });

  it('cleans up stale exit styles if navigation does not unload the page', () => {
    const navigate = vi.fn();
    const button = document.getElementById('chat-button');

    navigateTo('/chat/chatbot.html', { currentTarget: button }, { entryAnchor: '#back-button', navigate });

    vi.advanceTimersByTime(2500);
    expect(document.body.style.pointerEvents).toBe('');
    expect(document.body.style.clipPath).toBe('');
    expect(document.body.style.transition).toBe('');
    expect(document.querySelector('[data-gastro-transition-portal="true"]')).toBeNull();
    expect(document.documentElement.style.background).toBe('');
  });

  it('navigates immediately without storing animation state when reduced motion is enabled', () => {
    const navigate = vi.fn();
    const button = document.getElementById('chat-button');

    window.matchMedia.mockReturnValueOnce({ matches: true });
    navigateTo('/chat/chatbot.html', { currentTarget: button }, { entryAnchor: '#back-button', navigate });

    expect(navigate).toHaveBeenCalledWith('/chat/chatbot.html');
    expect(readTransitionState()).toBeNull();
    expect(document.body.style.transition).toBe('');
    expect(document.body.style.clipPath).toBe('');
  });
});

describe('revealPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    document.documentElement.className = 'page-entering';
    document.documentElement.style.cssText = '';
    document.body.style.cssText = '';
    document.body.innerHTML = '<button id="back-button">Voltar</button>';
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });

    const backButton = document.getElementById('back-button');
    backButton.getBoundingClientRect = () => ({
      left: 50,
      top: 20,
      width: 72,
      height: 50,
      right: 122,
      bottom: 70,
      x: 50,
      y: 20,
      toJSON() {},
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reveals by shrinking the portal back into the destination anchor', () => {
    writeTransitionState({
      entryAnchor: '#back-button',
      origin: { x: 465, y: 841 },
    });

    revealPage();

    expect(readTransitionState()).toBeNull();
    expect(document.documentElement.classList.contains('page-entering')).toBe(false);
    expect(document.body.style.willChange).toBe('transform, opacity');
    expect(document.body.style.transformOrigin).toBe('86px 45px');
    expect(document.body.style.transition).toContain('transform 620ms');
    expect(document.body.style.transition).toContain('opacity 620ms');
    expect(document.body.style.clipPath).toBe('');
    expect(document.body.style.transform).toBe('scale(1)');
    expect(document.body.style.opacity).toBe('1');
    expect(document.body.style.filter).toBe('');
    const portal = document.querySelector('[data-gastro-transition-portal="true"]');
    expect(portal).not.toBeNull();
    expect(portal.style.left).toBe('86px');
    expect(portal.style.top).toBe('45px');
    expect(portal.style.transform).toBe('translate(-50%, -50%) scale(0.18)');
    expect(portal.style.opacity).toBe('0');
  });

  it('cleans up inline styles after the reveal finishes', () => {
    writeTransitionState({
      entryAnchor: '#back-button',
      origin: { x: 465, y: 841 },
    });

    revealPage();
    vi.advanceTimersByTime(670);

    expect(document.body.style.pointerEvents).toBe('');
    expect(document.body.style.clipPath).toBe('');
    expect(document.body.style.transition).toBe('');
    expect(document.body.style.transform).toBe('');
    expect(document.body.style.transformOrigin).toBe('');
    expect(document.body.style.willChange).toBe('');
    expect(document.body.style.opacity).toBe('');
    expect(document.querySelector('[data-gastro-transition-portal="true"]')).toBeNull();
    expect(document.documentElement.style.background).toBe('');
  });

  it('removes preload styling when stored metadata is invalid', () => {
    sessionStorage.setItem(TRANSITION_SESSION_KEY, '{invalid');

    revealPage();

    expect(document.documentElement.classList.contains('page-entering')).toBe(false);
    expect(document.body.style.opacity).toBe('');
    expect(sessionStorage.getItem(TRANSITION_SESSION_KEY)).toBeNull();
  });

  it('cleans up immediately when reduced motion is enabled', () => {
    writeTransitionState({
      entryAnchor: '#back-button',
      origin: { x: 465, y: 841 },
    });

    window.matchMedia.mockReturnValueOnce({ matches: true });
    revealPage();

    expect(document.documentElement.classList.contains('page-entering')).toBe(false);
    expect(document.body.style.clipPath).toBe('');
    expect(document.body.style.transition).toBe('');
    expect(document.documentElement.style.background).toBe('');
  });
});
