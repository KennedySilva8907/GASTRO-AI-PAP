import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserFacingError, handleAsyncError, showUserNotification } from '../../../src/shared/errors.js';

describe('UserFacingError', () => {
  it('is an instance of Error', () => {
    const err = new UserFacingError('tech msg', 'user msg');
    expect(err).toBeInstanceOf(Error);
  });

  it('has name set to UserFacingError', () => {
    const err = new UserFacingError('tech msg', 'user msg');
    expect(err.name).toBe('UserFacingError');
  });

  it('stores technical message in .message and user message in .userMessage', () => {
    const err = new UserFacingError('technical details', 'Something went wrong');
    expect(err.message).toBe('technical details');
    expect(err.userMessage).toBe('Something went wrong');
  });

  it('defaults userMessage to message when not provided', () => {
    const err = new UserFacingError('only message');
    expect(err.userMessage).toBe('only message');
  });
});

describe('handleAsyncError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns userMessage for UserFacingError', () => {
    const err = new UserFacingError('tech', 'User-friendly message');
    const result = handleAsyncError(err, 'fallback');
    expect(result).toBe('User-friendly message');
  });

  it('returns fallbackMessage for generic Error', () => {
    const err = new Error('generic error');
    const result = handleAsyncError(err, 'Custom fallback');
    expect(result).toBe('Custom fallback');
  });

  it('returns default Portuguese message when no fallback provided', () => {
    const err = new Error('generic error');
    const result = handleAsyncError(err);
    expect(result).toBe('Ocorreu um erro. Por favor, tente novamente.');
  });

  it('logs the error to console.error', () => {
    const err = new Error('logged error');
    handleAsyncError(err, 'fallback');
    expect(console.error).toHaveBeenCalledWith('[Error]', err);
  });
});

describe('showUserNotification', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('logs with formatted type in uppercase', () => {
    showUserNotification('hello', 'error');
    expect(console.log).toHaveBeenCalledWith('[ERROR]', 'hello');
  });

  it('defaults to INFO type', () => {
    showUserNotification('info message');
    expect(console.log).toHaveBeenCalledWith('[INFO]', 'info message');
  });
});
