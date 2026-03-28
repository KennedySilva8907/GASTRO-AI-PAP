/**
 * Error handling utilities for async operations.
 * Provides user-facing error patterns and consistent error handling across the app.
 */

/**
 * Custom error class for user-facing error messages.
 * Separates technical error details from user-friendly messages.
 */
export class UserFacingError extends Error {
  constructor(message, userMessage) {
    super(message);
    this.name = 'UserFacingError';
    this.userMessage = userMessage || message;
  }
}

/**
 * Handles async operation errors with consistent logging and user notification.
 * @param {Error} error - The error object
 * @param {string} fallbackMessage - User-friendly message to display
 * @returns {string} The user-facing error message
 */
export function handleAsyncError(error, fallbackMessage) {
  // Log technical details for debugging
  // eslint-disable-next-line no-console
  console.error('[Error]', error);

  // Return user-facing message
  if (error instanceof UserFacingError) {
    return error.userMessage;
  }

  return fallbackMessage || 'Ocorreu um erro. Por favor, tente novamente.';
}

/**
 * Shows a user notification (placeholder for future toast/notification system).
 * @param {string} message - Message to display
 * @param {string} type - Notification type ('error', 'success', 'info')
 */
export function showUserNotification(message, type = 'info') {
  // Future: integrate with toast notification library
  // eslint-disable-next-line no-console
  console.log(`[${type.toUpperCase()}]`, message);
}
