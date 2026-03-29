/**
 * Lazy loading for CSS background-image elements.
 * Uses IntersectionObserver with data-bg attribute pattern.
 * Native loading="lazy" does NOT work for background-image — this is the standard approach.
 */

export class LazyBackgroundLoader {
  constructor(selector = '.js-carousel-bg-img[data-bg]', options = {}) {
    this.selector = selector;
    this.options = {
      rootMargin: '200px 0px',
      threshold: 0,
      ...options,
    };
    this.observer = null;
  }

  init() {
    if (!('IntersectionObserver' in window)) {
      this.loadAll();
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => this.handleIntersection(entries),
      this.options
    );

    document.querySelectorAll(this.selector).forEach((el) => {
      this.observer.observe(el);
    });
  }

  handleIntersection(entries) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const url = el.dataset.bg;
        if (url) {
          el.style.backgroundImage = `url('${url}')`;
          delete el.dataset.bg;
        }
        this.observer.unobserve(el);
      }
    });
  }

  loadAll() {
    document.querySelectorAll(this.selector).forEach((el) => {
      if (el.dataset.bg) {
        el.style.backgroundImage = `url('${el.dataset.bg}')`;
      }
    });
  }
}
