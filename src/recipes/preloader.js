/**
 * Image preloading utilities for recipes carousel.
 * Handles graceful loading and error recovery for background images.
 */

/**
 * Preload an array of image URLs.
 * @param {string[]} urls - Array of image URLs to preload
 * @returns {Promise<HTMLImageElement[]>} Array of loaded image elements
 */
export async function preloadImages(urls) {
  const results = await Promise.allSettled(
    urls.map(
      (url) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`Failed to load: ${url}`));
          img.src = url;
        })
    )
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(`[Preloader] ${failed.length}/${urls.length} images failed to load`);
  }

  return results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
}

/**
 * Extract background image URL from element.
 * @param {HTMLElement} element - Element with background-image style
 * @returns {string|null} Image URL or null if not found
 */
export function getBackgroundImageUrl(element) {
  // Check data-bg first (lazy-loaded images that haven't been observed yet)
  if (element.dataset.bg) {
    return element.dataset.bg;
  }
  // Fall back to computed style (for eager-loaded first image and already-observed images)
  const style = window.getComputedStyle(element);
  const bgImage = style.backgroundImage;
  if (bgImage && bgImage !== 'none') {
    return bgImage.replace(/url\(['"]?(.*?)['"]?\)/i, '$1');
  }
  return null;
}
