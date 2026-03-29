/**
 * Recipe sharing via Web Share API with progressive fallback.
 * Three-tier chain: navigator.share -> clipboard -> URL display.
 *
 * MUST be called from within a user gesture (click event handler)
 * because navigator.share() requires a user activation.
 */

/**
 * Share a recipe using Web Share API with Clipboard API fallback.
 * @param {string} title - Recipe title for share data
 * @param {string} url - Shareable URL
 */
export async function shareRecipe(title, url) {
  const shareData = {
    title: 'GASTRO-AI: ' + title,
    text: 'Confira esta receita: ' + title,
    url,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch (err) {
      // AbortError = user cancelled native share sheet -- expected, silent
      if (err.name !== 'AbortError') {
        await _clipboardFallback(url);
      }
    }
  } else {
    await _clipboardFallback(url);
  }
}

/**
 * Clipboard API fallback -- copies URL to clipboard.
 * Falls through to URL display if clipboard is unavailable.
 * @param {string} url - URL to copy
 */
async function _clipboardFallback(url) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(url);
      _showFeedback('Link copiado para a area de transferencia!');
    } catch {
      _showUrlDisplay(url);
    }
  } else {
    _showUrlDisplay(url);
  }
}

/**
 * Show a brief toast confirming clipboard copy.
 * Auto-removes after 2500ms. No GSAP -- pure CSS animation.
 * @param {string} message - Feedback message text
 */
function _showFeedback(message) {
  const el = document.createElement('div');
  el.className = 'share-feedback';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

/**
 * Last resort: show the URL in an output element for manual copy.
 * Replaces any previous URL display to prevent duplicates.
 * @param {string} url - URL to display
 */
function _showUrlDisplay(url) {
  const recipeContainer = document.querySelector('.recipe-container');
  if (!recipeContainer) return;
  const existing = recipeContainer.querySelector('.share-url-display');
  if (existing) existing.remove();
  const el = document.createElement('output');
  el.className = 'share-url-display';
  el.value = url;
  el.textContent = url;
  recipeContainer.prepend(el);
}
