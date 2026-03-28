/**
 * XSS Protection - DOMPurify wrapper with security configuration.
 * Sanitizes HTML content before DOM insertion to prevent XSS attacks.
 */

// DOMPurify configuration for standard content (chat messages, AI responses)
export const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'p',
    'strong',
    'em',
    'ul',
    'ol',
    'li',
    'code',
    'pre',
    'br',
    'a',
    'h1',
    'h2',
    'h3',
    'h4',
    'blockquote',
    'span',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['target'],
  FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'object', 'embed'],
  FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'],
};

// Extended configuration for content requiring additional formatting tags
export const SANITIZE_CONFIG_EXTENDED = {
  ...SANITIZE_CONFIG,
  ALLOWED_TAGS: [...SANITIZE_CONFIG.ALLOWED_TAGS, 'i', 'div'],
};

/**
 * Sanitizes HTML content using DOMPurify.
 * @param {string} html - Raw HTML content to sanitize
 * @param {object} config - DOMPurify configuration (defaults to SANITIZE_CONFIG)
 * @returns {string} Sanitized HTML safe for DOM insertion
 */
export function sanitizeHtml(html, config = SANITIZE_CONFIG) {
  if (typeof DOMPurify === 'undefined') {
    // eslint-disable-next-line no-console
    console.warn('[Security] DOMPurify not loaded, stripping all HTML tags');
    return html.replace(/<[^>]*>/g, '');
  }
  return DOMPurify.sanitize(html, config);
}
