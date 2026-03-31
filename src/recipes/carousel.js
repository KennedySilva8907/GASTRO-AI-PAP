/**
 * Vertical carousel for recipes page.
 * Manages navigation, animations, and modal interactions.
 *
 * NOTE: Background images remain as inline style="" in receitas.html.
 * These are dynamic URLs that cannot be CSS classes (per CODE-03 exception).
 */

import { getBackgroundImageUrl } from './preloader.js';
import { LazyBackgroundLoader } from './lazy-loader.js';
import { shareRecipe } from './share.js';
import { buildRecipeCatalog } from './catalog.js';
import { RecipesStageController } from './stage-controller.js';
import { RecipePanelController } from './panel-controller.js';

/**
 * Map receitas.html legacy panel markup when Task 4 `data-*` hooks are absent.
 * @param {RecipePanelController} panel
 */
function applyRecipePanelDomFallbacks(panel) {
  const shell = panel.panel;
  if (!shell) return;

  if (!panel.closeBtn) {
    panel.closeBtn =
      shell.querySelector('.recipes-panel__close') ?? shell.querySelector('.close-button');
  }
  if (!panel.videoFrame) {
    panel.videoFrame =
      shell.querySelector('[data-panel-video]') ?? shell.querySelector('.video-container iframe');
  }
  if (!panel.countryEl) {
    panel.countryEl = shell.querySelector('[data-panel-country]');
  }
  if (!panel.titleEl) {
    panel.titleEl =
      shell.querySelector('[data-panel-title]') ?? shell.querySelector('#recipeTitle');
  }
  if (!panel.summaryEl) {
    panel.summaryEl = shell.querySelector('[data-panel-summary]');
  }
  if (!panel.contentEl) {
    panel.contentEl =
      shell.querySelector('[data-panel-content]') ?? shell.querySelector('#recipeContent');
  }
  if (!panel.actionsEl) {
    panel.actionsEl = shell.querySelector('[data-panel-actions]');
  }
}

/**
 * Support both the legacy display:block panel and the Task 5 hidden/body-class panel.
 * @param {HTMLElement | null | undefined} panel
 * @returns {boolean}
 */
function isPanelOpen(panel) {
  if (!panel) return false;
  if (panel.style.display === 'block') return true;
  if (panel.hasAttribute('hidden')) return panel.hidden === false;
  return document.body.classList.contains('recipes-panel-open');
}

/**
 * @param {Element[] | NodeListOf<Element>} listItems
 * @returns {number}
 */
function getScrollSegmentCount(listItems) {
  return Math.max((listItems?.length ?? 0) - 1, 0);
}

/**
 * @param {HTMLElement} list
 * @returns {number}
 */
function getScrollableRange(list) {
  return Math.max((list?.scrollHeight ?? 0) - (list?.clientHeight ?? 0), 0);
}

/**
 * @param {number} index
 * @param {HTMLElement} list
 * @param {Element[] | NodeListOf<Element>} listItems
 * @returns {number}
 */
function getTargetScrollTop(index, list, listItems) {
  const segments = getScrollSegmentCount(listItems);
  if (segments <= 0) return 0;
  return (getScrollableRange(list) * index) / segments;
}

/**
 * @param {number} scrollTop
 * @param {HTMLElement} list
 * @param {Element[] | NodeListOf<Element>} listItems
 * @returns {number}
 */
function getIndexFromScrollTop(scrollTop, list, listItems) {
  const segments = getScrollSegmentCount(listItems);
  const scrollableRange = getScrollableRange(list);
  if (segments <= 0 || scrollableRange <= 0) return 0;
  return Math.round((scrollTop / scrollableRange) * segments);
}

/** @type {number} */
const SCROLL_EDGE_TOLERANCE_PX = 1;

/**
 * Thin page coordinator: catalog → stage (rail/hero) → floating panel + responsive modal helpers.
 */
export class RecipesExperience {
  /**
   * @param {ParentNode} [root]
   */
  constructor(root = document) {
    this.root = root;
    /** @type {RecipePanelController | null} */
    this.panel = null;
    /** @type {RecipesStageController | null} */
    this.stage = null;
    /** @type {ResponsiveModalHandler | null} */
    this._responsiveHandler = null;
  }

  init() {
    new LazyBackgroundLoader().init();

    const catalog = buildRecipeCatalog(this.root);
    if (catalog.length === 0) {
      return;
    }

    this.panel = new RecipePanelController(this.root, catalog);
    applyRecipePanelDomFallbacks(this.panel);

    const panelEl = this.panel.panel;
    const rawOpen = RecipePanelController.prototype.open;
    const rawClose = RecipePanelController.prototype.close;

    this.panel.open = (recipe, trigger) => {
      rawOpen.call(this.panel, recipe, trigger);
      panelEl?.dispatchEvent(new window.Event('show', { bubbles: true }));
    };
    this.panel.close = () => {
      rawClose.call(this.panel);
      panelEl?.dispatchEvent(new window.Event('hide', { bubbles: true }));
    };
    this.panel._onCloseClick = this.panel.close.bind(this.panel);

    this.panel.init();

    this.stage = new RecipesStageController(this.root, catalog, {
      onOpen: (recipe, item) => {
        const anchor = item.querySelector?.('a');
        this.panel.open(
          {
            ...recipe,
            summary: `${recipe.country} em destaque nas receitas do mundo.`,
          },
          anchor ?? item,
        );
      },
    });
    this.stage.init();

    this._responsiveHandler = new ResponsiveModalHandler();
  }

  destroy() {
    this.stage?.destroy?.();
    if (this.panel && isPanelOpen(this.panel.panel)) {
      this.panel.close();
    }
    this.panel?.destroy?.();
    this._responsiveHandler?.destroy?.();
    this.panel = null;
    this.stage = null;
    this._responsiveHandler = null;
  }
}

/**
 * Vertical scroll carousel with GSAP animations.
 * Handles recipe navigation, image transitions, and modal display.
 */
export class VerticalCarousel {
  /**
   * Initialize carousel with custom options.
   * @param {Object} options - Configuration options
   * @param {Object} recipes - Recipe data object
   */
  constructor(options = {}, recipes = {}) {
    // Configurações padrão
    const _defaults = {
      carousel: '.js-carousel',
      bgImg: '.js-carousel-bg-img',
      list: '.js-carousel-list',
      listItem: '.js-carousel-list-item',
    };

    this.defaults = Object.assign({}, _defaults, options);
    this.recipes = recipes;
    this.currentIndex = 0;
    this.preloadedImages = new Set();
    this.isScrolling = false;
    this.scrollTimeout = null;
    this._onFullscreenChange = () => this.handleFullscreenChange();
    this._onDocumentKeydown = null;
    this.init();
  }

  /**
   * Inicializa todos os componentes do carrossel
   */
  init() {
    this.setupElements();
    new LazyBackgroundLoader().init();
    this.preloadImages();
    this.createProgressDots();
    this.initScrollEvent();
    this.setupInitialState();
    this.setupModalEventListeners();

    // Ajusta o carrossel quando o modo de tela cheia muda
    document.addEventListener('fullscreenchange', this._onFullscreenChange);
  }

  destroy() {
    clearTimeout(this.scrollTimeout);
    this.scrollTimeout = null;

    document.removeEventListener('fullscreenchange', this._onFullscreenChange);
    if (this._onDocumentKeydown) {
      document.removeEventListener('keydown', this._onDocumentKeydown);
      this._onDocumentKeydown = null;
    }
  }

  /**
   * Configura os elementos do carrossel com estilos iniciais
   */
  setupElements() {
    const carousel = this.getCarousel();
    const list = this.getList();
    const listItems = this.getListItems();
    const bgImages = this.getBgImgs();
    if (!carousel || !list) return;

    // Configurações de estilo para o carrossel
    carousel.style.display = 'block';
    carousel.style.top = '0';

    // Configurações de estilo para a lista
    list.style.top = '5vh';
    list.style.height = 'auto';
    list.style.maxHeight = '90vh';
    list.style.overflowY = 'auto';

    // Adiciona padding extra para garantir que o último item seja visível
    const viewportHeight = window.innerHeight;
    const lastItemHeight = listItems.length > 0 ? listItems[listItems.length - 1].offsetHeight : 0;
    const extraPadding = Math.max(viewportHeight * 0.2, lastItemHeight);
    list.style.paddingBottom = `${extraPadding}px`;
    list.style.paddingTop = '60px';

    // Configura as imagens de fundo com GSAP
    gsap.set(bgImages, {
      autoAlpha: 0,
      scale: 1.05,
    });

    // Exibe apenas a primeira imagem inicialmente
    if (bgImages[0]) {
      gsap.set(bgImages[0], {
        autoAlpha: 1,
        scale: 1,
      });
    }
  }

  /**
   * Pré-carrega todas as imagens de fundo para evitar atrasos
   */
  preloadImages() {
    const bgImages = this.getBgImgs();
    const totalImages = bgImages.length;
    if (totalImages === 0) return;

    const loadingOverlay = this.createLoadingOverlay();
    let loadedCount = 0;

    // Atualiza a barra de progresso à medida que as imagens são carregadas
    const updateProgress = () => {
      loadedCount++;
      const progress = (loadedCount / totalImages) * 100;
      loadingOverlay.querySelector('.loading-progress').style.width = `${progress}%`;

      // Remove o overlay quando todas as imagens estiverem carregadas
      if (loadedCount === totalImages) {
        setTimeout(() => {
          loadingOverlay.style.opacity = '0';
          setTimeout(() => {
            loadingOverlay.remove();
          }, 300);
        }, 500);
      }
    };

    // Carrega cada imagem de fundo
    bgImages.forEach((bgImg) => {
      const imgUrl = getBackgroundImageUrl(bgImg);
      if (imgUrl && !this.preloadedImages.has(imgUrl)) {
        const img = new Image();

        img.onload = () => {
          this.preloadedImages.add(imgUrl);
          updateProgress();
        };

        img.onerror = () => {
          // eslint-disable-next-line no-console
          console.error(`Failed to load image: ${imgUrl}`);
          updateProgress();
        };

        img.src = imgUrl;
      } else {
        updateProgress();
      }
    });

    // Inicia o pré-carregamento das próximas imagens
    this.preloadNextImages(this.currentIndex);
  }

  /**
   * Cria um overlay de carregamento com barra de progresso
   * @returns {HTMLElement} O elemento de overlay criado
   */
  createLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            transition: opacity 0.3s ease;
        `;

    const loadingText = document.createElement('div');
    loadingText.textContent = 'A carregar imagens...';
    loadingText.style.cssText = `
            color: white;
            margin-bottom: 10px;
            font-size: 16px;
        `;

    const progressContainer = document.createElement('div');
    progressContainer.style.cssText = `
            width: 200px;
            height: 4px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 2px;
            overflow: hidden;
        `;

    const progressBar = document.createElement('div');
    progressBar.className = 'loading-progress';
    progressBar.style.cssText = `
            width: 0%;
            height: 100%;
            background: white;
            transition: width 0.3s ease;
        `;

    progressContainer.appendChild(progressBar);
    overlay.appendChild(loadingText);
    overlay.appendChild(progressContainer);
    document.body.appendChild(overlay);

    return overlay;
  }

  /**
   * Pré-carrega as próximas imagens para melhorar a experiência do usuário
   * @param {number} currentIndex - Índice atual no carrossel
   */
  preloadNextImages(currentIndex) {
    const bgImages = this.getBgImgs();
    const totalImages = bgImages.length;
    if (totalImages === 0) return;

    // Carrega as próximas 2 imagens
    for (let i = 1; i <= 2; i++) {
      const nextIndex = (currentIndex + i) % totalImages;
      const imgUrl = getBackgroundImageUrl(bgImages[nextIndex]);

      if (imgUrl && !this.preloadedImages.has(imgUrl)) {
        const img = new Image();
        img.onload = () => this.preloadedImages.add(imgUrl);
        img.src = imgUrl;
      }
    }
  }

  /**
   * Cria indicadores de progresso (pontos) para navegação visual
   */
  createProgressDots() {
    const carousel = this.getCarousel();
    if (!carousel) return;
    const progressDots = document.createElement('div');
    progressDots.className = 'progress-dots';
    const items = this.getListItems();

    // Cria um ponto para cada item do carrossel
    items.forEach((_, index) => {
      const dot = document.createElement('div');
      dot.className = 'progress-dot';
      dot.setAttribute('data-index', index);
      if (index === 0) dot.classList.add('active');
      progressDots.appendChild(dot);
    });

    carousel.appendChild(progressDots);
  }

  /**
   * Ajusta o carrossel quando o modo de tela cheia muda
   */
  handleFullscreenChange() {
    setTimeout(() => {
      const list = this.getList();
      if (!list) return;
      const listItems = this.getListItems();

      const viewportHeight = window.innerHeight;
      const lastItemHeight = listItems.length > 0 ? listItems[listItems.length - 1].offsetHeight : 0;
      const extraPadding = Math.max(viewportHeight * 0.25, lastItemHeight);

      // Ajusta a altura máxima com base no modo de tela cheia
      list.style.maxHeight = document.fullscreenElement ? '95vh' : '90vh';
      list.style.paddingBottom = `${extraPadding}px`;
    }, 100);
  }

  /**
   * Configura o estado inicial do carrossel
   */
  setupInitialState() {
    const bgImages = this.getBgImgs();
    if (bgImages[0]) {
      bgImages[0].classList.add('is-visible');
    }

    if (this.getListItems().length > 0) {
      this.updateListItems(0);
    }
  }

  /**
   * Inicializa os eventos de rolagem e interação do carrossel
   */
  initScrollEvent() {
    const list = this.getList();
    const listItems = this.getListItems();
    if (!list) return;
    let lastScrollTime = Date.now();
    const scrollThrottle = 100;

    /**
     * Atualiza o carrossel com base na posição de rolagem
     */
    const updateScroll = () => {
      const now = Date.now();
      if (now - lastScrollTime < scrollThrottle) return;

      const scrollTop = list.scrollTop;
      const newIndex = getIndexFromScrollTop(scrollTop, list, listItems);
      const isMobile = window.innerWidth <= 768;

      // Atualiza apenas se o índice mudar e estiver dentro dos limites
      if (newIndex !== this.currentIndex && newIndex >= 0 && newIndex < listItems.length) {
        // Salva o índice antigo antes de atualizar
        const oldIndex = this.currentIndex;
        this.currentIndex = newIndex;

        // Atualiza os itens da lista primeiro
        this.updateListItems(this.currentIndex);

        // Em dispositivos móveis, limpa todas as animações de fundo anteriores
        if (isMobile) {
          const bgImages = this.getBgImgs();
          gsap.killTweensOf(bgImages);

          // Para a imagem anterior imediatamente
          if (bgImages[oldIndex]) {
            gsap.set(bgImages[oldIndex], {
              autoAlpha: 0,
              scale: 1.05,
            });
          }

          // Pequeno atraso antes de mostrar a nova imagem
          setTimeout(() => {
            this.animateBackgroundAndTitles(this.currentIndex);
          }, 50);
        } else {
          // Desktop - animação normal
          this.animateBackgroundAndTitles(this.currentIndex);
        }
      }
      lastScrollTime = now;
    };

    // Manipula eventos de roda do mouse para rolagem suave
    list.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (this.isScrolling) return;
        this.isScrolling = true;

        const direction = e.deltaY > 0 ? 1 : -1;
        const currentIndex = this.currentIndex;

        // Calcula o índice alvo com base na direção da rolagem
        const targetIndex = Math.max(0, Math.min(listItems.length - 1, currentIndex + direction));
        const targetScrollTop = getTargetScrollTop(targetIndex, list, listItems);

        // Rola suavemente para o item alvo
        list.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth',
        });

        // Limpa o timeout anterior, se existir
        if (this.scrollTimeout) {
          clearTimeout(this.scrollTimeout);
        }

        // Define um timeout para atualizar o carrossel após a rolagem
        // Aumenta o tempo para dispositivos móveis
        const timeoutDuration = window.innerWidth <= 768 ? 700 : 500;
        this.scrollTimeout = setTimeout(() => {
          updateScroll();
          this.isScrolling = false;
          this.scrollTimeout = null;
        }, timeoutDuration);
      },
      { passive: false }
    );

    // Manipula eventos de rolagem normal com debounce melhorado
    let scrollDebounce;
    let lastScrollHandled = 0;
    const isMobile = window.innerWidth <= 768;
    const scrollDebounceTime = isMobile ? 100 : 16; // Maior tempo para dispositivos móveis

    list.addEventListener('scroll', () => {
      const now = Date.now();

      // Ignora eventos de rolagem muito frequentes em dispositivos móveis
      if (isMobile && now - lastScrollHandled < 60) return;

      if (scrollDebounce) {
        if (isMobile) {
          clearTimeout(scrollDebounce);
        } else {
          cancelAnimationFrame(scrollDebounce);
        }
      }

      lastScrollHandled = now;

      // Em dispositivos móveis, usamos setTimeout em vez de requestAnimationFrame
      // para maior controle sobre o timing
      if (isMobile) {
        if (this.isScrolling) return;

        scrollDebounce = setTimeout(() => {
          if (!this.isScrolling) {
            updateScroll();
          }
          scrollDebounce = null;
        }, scrollDebounceTime);
      } else {
        // Comportamento original para desktop
        scrollDebounce = requestAnimationFrame(() => {
          if (!this.isScrolling) {
            updateScroll();
          }
        });
      }
    });

    // Configura eventos para cada item da lista
    listItems.forEach((item, index) => {
      // Evento de clique para navegação
      item.addEventListener('click', (e) => {
        if (!e.target.closest('a') && !e.target.closest('.js-carousel-list-item')) {
          return;
        }

        if (this.isScrolling || e.detail > 1) return;

        const currentScrollTop = list.scrollTop;
        const targetScrollTop = getTargetScrollTop(index, list, listItems);

        const scrollingUp = targetScrollTop < currentScrollTop;

        this.isScrolling = true;

        // Rola suavemente para o item clicado
        list.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth',
        });

        // Limpa o timeout anterior, se existir
        if (this.scrollTimeout) {
          clearTimeout(this.scrollTimeout);
        }

        // Define uma duração diferente com base na direção da rolagem
        const timeoutDuration = scrollingUp ? 800 : 600;

        // Atualiza o carrossel após a rolagem
        this.scrollTimeout = setTimeout(() => {
          this.currentIndex = index;
          this.updateListItems(index);
          this.animateBackgroundAndTitles(index);
          this.isScrolling = false;
          this.scrollTimeout = null;
        }, timeoutDuration);
      });

      // Suporte para dispositivos móveis
      if ('ontouchstart' in window) {
        let lastTap = 0;
        let tapTimeout;

        // Manipula eventos de toque para dispositivos móveis
        item.addEventListener(
          'touchstart',
          (e) => {
            if (!item.classList.contains('is-active')) return;

            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;

            clearTimeout(tapTimeout);

            // Detecta toque duplo
            if (tapLength < 500 && tapLength > 0) {
              e.preventDefault();
              const anchorTag = item.querySelector('a');
              if (anchorTag) {
                const videoId = anchorTag.getAttribute('data-video-id');
                const recipeKey = anchorTag.getAttribute('data-recipe');
                this.openModal(videoId, recipeKey);
              }
            } else {
              tapTimeout = setTimeout(() => {
                lastTap = 0;
              }, 500);
            }
            lastTap = currentTime;
          },
          { passive: false }
        );

        // Previne comportamento padrão no touchend para itens ativos
        item.addEventListener(
          'touchend',
          (e) => {
            if (item.classList.contains('is-active')) {
              e.preventDefault();
            }
          },
          { passive: false }
        );
      }

      // Suporte para clique duplo em desktop
      if (!('ontouchstart' in window)) {
        item.addEventListener('dblclick', (e) => {
          if (item.classList.contains('is-active')) {
            const anchorTag = item.querySelector('a');
            if (anchorTag) {
              e.preventDefault();
              const videoId = anchorTag.getAttribute('data-video-id');
              const recipeKey = anchorTag.getAttribute('data-recipe');
              this.openModal(videoId, recipeKey);
            }
          }
        });
      }
    });
  }

  /**
   * Atualiza os indicadores de progresso (pontos)
   * @param {number} index - Índice do item ativo
   */
  updateDots(index) {
    const dots = document.querySelectorAll('.progress-dot');
    dots.forEach((dot, i) => {
      if (i === index) {
        dot.classList.add('active');
        gsap.to(dot, {
          scale: 1.2,
          backgroundColor: '#ffffff',
          duration: 0.3,
        });
      } else {
        dot.classList.remove('active');
        gsap.to(dot, {
          scale: 1,
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          duration: 0.3,
        });
      }
    });
  }

  /**
   * Anima a transição das imagens de fundo
   * @param {number} index - Índice da imagem a ser exibida
   */
  animateBackgroundAndTitles(index) {
    const bgImages = this.getBgImgs();
    const currentBg = bgImages[index];
    const isMobile = window.innerWidth <= 768;

    if (!currentBg) return;

    // Pré-carrega as próximas imagens
    this.preloadNextImages(index);

    // IMPORTANTE: Interrompe todas as animações em andamento
    gsap.killTweensOf(bgImages);

    // Para dispositivos móveis, usar uma abordagem mais direta e simples
    if (isMobile) {
      // Oculta todas as imagens imediatamente sem animação
      bgImages.forEach((img) => {
        gsap.set(img, {
          autoAlpha: 0,
          scale: 1.05,
        });
      });

      // Pequeno atraso antes de exibir a imagem correta (ajuda na sincronização)
      setTimeout(() => {
        // Exibe a imagem atual sem animação
        gsap.set(currentBg, {
          autoAlpha: 1,
          scale: 1,
        });
      }, 50);
    } else {
      // Versão desktop com animações mais suaves
      // Oculta todas as imagens
      gsap.to(bgImages, {
        autoAlpha: 0,
        scale: 1.05,
        duration: 0.4,
        overwrite: 'auto', // Substitui quaisquer animações em andamento
      });

      // Exibe a imagem atual
      gsap.to(currentBg, {
        autoAlpha: 1,
        scale: 1,
        duration: 0.4,
        overwrite: 'auto',
      });
    }
  }

  /**
   * Atualiza a aparência dos itens da lista
   * @param {number} activeIndex - Índice do item ativo
   */
  updateListItems(activeIndex) {
    const listItems = this.getListItems();

    // Força parar todas as animações GSAP em andamento
    gsap.killTweensOf(listItems);

    // Força redefinição completa antes de nova animação
    listItems.forEach((item) => {
      // Remove a classe is-active de todos os itens primeiro
      item.classList.remove('is-active');

      // Reset imediato de propriedades visuais
      gsap.set(item, {
        opacity: 0.3,
        scale: 0.92,
      });
    });

    // Pequeno atraso antes de aplicar o novo estado ativo
    setTimeout(() => {
      // Adiciona a classe is-active apenas ao item que deve estar ativo
      if (listItems[activeIndex]) {
        listItems[activeIndex].classList.add('is-active');

        // Anima apenas o item ativo com nova configuração
        gsap.to(listItems[activeIndex], {
          opacity: 1,
          scale: 1.02,
          duration: 0.3,
          overwrite: 'auto', // Importante: substitui qualquer animação anterior
        });
      }

      // Atualiza os indicadores de progresso
      this.updateDots(activeIndex);
    }, 50); // Pequeno delay para garantir que o reset ocorra primeiro
  }

  /**
   * Configura os eventos do modal para exibição de receitas
   */
  setupModalEventListeners() {
    const modal = document.getElementById('recipe-panel');
    this.openModal = () => {};
    if (!modal) return;

    const closeButton = document.querySelector('.close-button, .recipes-panel__close');
    const modalContent = modal.querySelector('.recipe-panel__surface');
    const videoIframe = modal.querySelector('.video-container iframe');
    const recipeContainer = document.querySelector('.recipe-container');
    if (!closeButton || !modalContent || !videoIframe || !recipeContainer) return;

    // Impede propagação de eventos dentro do container de receitas
    recipeContainer.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Tratamento específico para dispositivos móveis
    recipeContainer.addEventListener(
      'touchstart',
      (e) => {
        e.stopPropagation();
      },
      { passive: true }
    );

    recipeContainer.addEventListener(
      'touchmove',
      (e) => {
        e.stopPropagation();
        // Permitir scrolling normal dentro do container
      },
      { passive: true }
    );

    recipeContainer.addEventListener('touchend', (e) => {
      e.stopPropagation();
    });

    // Melhorar a lógica de fechamento do modal
    if (modal) {
      modal.addEventListener('click', (e) => {
        // Apenas fecha se o clique for diretamente no fundo do modal
        if (e.target === modal) {
          this.closeModal();
        }
      });
    }

    /**
     * Anima a abertura do modal
     */
    const animateModalOpen = () => {
      modal.style.display = 'block';
      modal.dispatchEvent(new window.Event('show'));
      gsap.fromTo(
        modal,
        { backgroundColor: 'rgba(0, 0, 0, 0)' },
        { backgroundColor: 'rgba(0, 0, 0, 0.75)', duration: 0.3 }
      );

      gsap.fromTo(
        modalContent,
        {
          y: -50,
          opacity: 0,
          scale: 0.95,
        },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.4,
          ease: 'back.out(1.7)',
        }
      );
    };

    /**
     * Anima o fechamento do modal
     */
    const animateModalClose = () => {
      gsap.to(modal, {
        backgroundColor: 'rgba(0, 0, 0, 0)',
        duration: 0.3,
      });

      gsap.to(modalContent, {
        y: 50,
        opacity: 0,
        scale: 0.95,
        duration: 0.3,
        onComplete: () => {
          modal.style.display = 'none';
          videoIframe.src = '';
          modal.dispatchEvent(new window.Event('hide'));
        },
      });
    };

    // Efeito hover no botão de fechar
    closeButton.addEventListener('mouseenter', () => {
      gsap.to(closeButton, {
        scale: 1.1,
        duration: 0.2,
      });
    });

    closeButton.addEventListener('mouseleave', () => {
      gsap.to(closeButton, {
        scale: 1,
        duration: 0.2,
      });
    });

    // Evento de clique no botão fechar
    closeButton.addEventListener('click', () => {
      animateModalClose();
    });

    /**
     * Abre o modal com o vídeo e receita especificados
     * @param {string} videoId - ID do vídeo do YouTube
     * @param {string} recipeKey - Chave da receita no objeto recipes
     */
    this.openModal = (videoId, recipeKey) => {
      if (videoId) {
        videoIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
      } else {
        videoIframe.src = '';
      }

      if (this.recipes[recipeKey]) {
        const recipeTitle = document.getElementById('recipeTitle');
        const recipeContent = document.getElementById('recipeContent');

        recipeTitle.textContent = this.recipes[recipeKey].title;
        recipeContent.innerHTML = this.recipes[recipeKey].content;

        // Share button -- remove previous to prevent duplicates
        const existingShareBtn = recipeContainer.querySelector('.share-button');
        if (existingShareBtn) existingShareBtn.remove();

        const shareBtn = document.createElement('button');
        shareBtn.className = 'share-button';
        shareBtn.setAttribute('aria-label', 'Partilhar receita: ' + this.recipes[recipeKey].title);
        shareBtn.textContent = 'Partilhar';

        shareBtn.addEventListener('click', () => {
          const shareUrl = window.location.origin + '/recipes/receitas.html';
          shareRecipe(this.recipes[recipeKey].title, shareUrl);
        });

        recipeContainer.appendChild(shareBtn);

        // Anima o conteúdo da receita
        gsap.fromTo(
          [recipeTitle, recipeContent],
          {
            y: 20,
            opacity: 0,
          },
          {
            y: 0,
            opacity: 1,
            duration: 0.5,
            stagger: 0.1,
            delay: 0.5,
          }
        );
      }

      animateModalOpen();
    };

    // Adiciona tecla ESC para fechar o modal
    this._onDocumentKeydown = (e) => {
      if (e.key === 'Escape' && modal.style.display === 'block') {
        animateModalClose();
      }
    };
    document.addEventListener('keydown', this._onDocumentKeydown);

    // Previne que o clique dentro do conteúdo do modal propague
    modalContent.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  /**
   * Retorna todos os elementos de imagem de fundo
   * @returns {NodeList} Lista de elementos de imagem de fundo
   */
  getBgImgs() {
    return document.querySelectorAll(this.defaults.bgImg);
  }

  /**
   * Retorna todos os itens da lista do carrossel
   * @returns {NodeList} Lista de itens do carrossel
   */
  getListItems() {
    return document.querySelectorAll(this.defaults.listItem);
  }

  /**
   * Retorna o elemento da lista do carrossel
   * @returns {HTMLElement} Elemento da lista
   */
  getList() {
    return document.querySelector(this.defaults.list);
  }

  /**
   * Retorna o elemento do carrossel
   * @returns {HTMLElement} Elemento do carrossel
   */
  getCarousel() {
    return document.querySelector(this.defaults.carousel);
  }
}

/**
 * Responsive modal handler for mobile gestures and accessibility.
 * Handles touch gestures, resize events, and focus management.
 */
export class ResponsiveModalHandler {
  constructor() {
    this.touchStartY = 0;
    this.touchMoveY = 0;
    this.isScrolling = false;
    this.modal = document.getElementById('recipe-panel');
    this.modalContent = this.modal?.querySelector('.recipe-panel__surface');
    this.recipeContainer = this.modal?.querySelector('.recipe-container');
    this.videoContainer = this.modal?.querySelector('.video-container');
    this.scrollTimeout = null;
    this.resizeTimeout = null;
    this.orientationTimeout = null;

    this.preventBodyScroll = (e) => e.preventDefault();
    this._onModalTouchStart = this._onModalTouchStart.bind(this);
    this._onModalTouchMove = this._onModalTouchMove.bind(this);
    this._onModalTouchEnd = this._onModalTouchEnd.bind(this);
    this._onRecipeTouchMove = this._onRecipeTouchMove.bind(this);
    this._onResize = this._onResize.bind(this);
    this._onOrientationChange = this._onOrientationChange.bind(this);
    this._onShow = this._onShow.bind(this);
    this._onHide = this._onHide.bind(this);
    this._onModalContentKeydown = this._onModalContentKeydown.bind(this);

    if (this.modal && this.modalContent && this.recipeContainer && this.videoContainer) {
      this.init();
    }
  }

  /**
   * Inicializa todos os manipuladores de eventos
   */
  init() {
    this.setupTouchEvents();
    this.setupResizeHandler();
    this.setupOrientationChange();
    this.setupScrollLock();
    this.setupAccessibility();
  }

  /**
   * Configura eventos de toque para dispositivos móveis
   */
  setupTouchEvents() {
    // Gestos de deslizar para fechar em dispositivos móveis
    this.modal.addEventListener('touchstart', this._onModalTouchStart, { passive: true });
    this.modal.addEventListener('touchmove', this._onModalTouchMove, { passive: false });
    this.modal.addEventListener('touchend', this._onModalTouchEnd);

    // Detecta quando o usuário está realmente scrollando o conteúdo
    this.recipeContainer.addEventListener('touchmove', this._onRecipeTouchMove, { passive: true });
  }

  /**
   * Configura manipulador de redimensionamento da janela
   */
  setupResizeHandler() {
    window.addEventListener('resize', this._onResize);
  }

  /**
   * Configura manipulador de mudança de orientação do dispositivo
   */
  setupOrientationChange() {
    window.addEventListener('orientationchange', this._onOrientationChange);
  }

  /**
   * Ajusta o tamanho do modal com base nas dimensões da tela
   */
  adjustModalSize() {
    if (!isPanelOpen(this.modal)) return;

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const isLandscape = viewportWidth > viewportHeight;

    if (viewportWidth <= 768) {
      // Mobile
      this.modalContent.style.height = `${viewportHeight}px`;
      this.modalContent.style.width = '100%';
      this.modalContent.style.margin = '0';
      this.modalContent.style.borderRadius = '0';

      if (isLandscape) {
        // Landscape mode
        this.videoContainer.style.paddingBottom = '40%';
        this.recipeContainer.style.maxHeight = '40vh';
      } else {
        // Portrait mode
        this.videoContainer.style.paddingBottom = '56.25%';
        this.recipeContainer.style.maxHeight = '50vh';
      }
    } else {
      // Desktop
      this.modalContent.style.height = '';
      this.modalContent.style.width = '';
      this.modalContent.style.margin = '';
      this.modalContent.style.borderRadius = '';
      this.videoContainer.style.paddingBottom = '50%';
      this.recipeContainer.style.maxHeight = '60vh';
    }
  }

  /**
   * Configura o bloqueio de rolagem quando o modal está aberto
   */
  setupScrollLock() {
    this.modal.addEventListener('show', this._onShow);
    this.modal.addEventListener('hide', this._onHide);
  }

  /**
   * Configura melhorias de acessibilidade para o modal
   */
  setupAccessibility() {
    // Melhoria de acessibilidade
    this.modal.setAttribute('role', 'dialog');
    this.modal.setAttribute('aria-modal', 'true');
    this.modalContent.addEventListener('keydown', this._onModalContentKeydown);
  }

  /**
   * Fecha o modal usando o botão de fechar
   */
  closeModal() {
    const closeButton = this.modal?.querySelector('.recipes-panel__close, .close-button');
    if (closeButton) {
      closeButton.click();
    }
  }

  /**
   * Remove gesture/resize/scroll-lock listeners created by this helper.
   */
  destroy() {
    clearTimeout(this.scrollTimeout);
    clearTimeout(this.resizeTimeout);
    clearTimeout(this.orientationTimeout);

    this.modal?.removeEventListener('touchstart', this._onModalTouchStart);
    this.modal?.removeEventListener('touchmove', this._onModalTouchMove);
    this.modal?.removeEventListener('touchend', this._onModalTouchEnd);
    this.recipeContainer?.removeEventListener('touchmove', this._onRecipeTouchMove);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onOrientationChange);
    this.modal?.removeEventListener('show', this._onShow);
    this.modal?.removeEventListener('hide', this._onHide);
    this.modalContent?.removeEventListener('keydown', this._onModalContentKeydown);
    document.removeEventListener('touchmove', this.preventBodyScroll);
    document.body.style.overflow = '';
  }

  _onModalTouchStart(e) {
    this.touchStartY = e.touches[0].clientY;
    this.touchMoveY = this.touchStartY;
  }

  _onModalTouchMove(e) {
    if (this.isScrolling || !isPanelOpen(this.modal)) return;

    this.touchMoveY = e.touches[0].clientY;
    const deltaY = this.touchMoveY - this.touchStartY;

    // Verifica se o scroll está no topo ou no final
    const remainingScroll =
      this.recipeContainer.scrollHeight -
      this.recipeContainer.scrollTop -
      this.recipeContainer.clientHeight;
    const isAtTop = this.recipeContainer.scrollTop <= SCROLL_EDGE_TOLERANCE_PX;
    const isAtBottom = remainingScroll <= SCROLL_EDGE_TOLERANCE_PX;

    if ((isAtTop && deltaY > 0) || (isAtBottom && deltaY < 0)) {
      e.preventDefault();
      this.modalContent.style.transform = `translateY(${deltaY}px)`;
      this.modalContent.style.transition = 'none';
    }
  }

  _onModalTouchEnd() {
    if (!isPanelOpen(this.modal)) return;

    const deltaY = this.touchMoveY - this.touchStartY;

    if (Math.abs(deltaY) > 100) {
      // Fecha o modal se o deslize for suficiente
      this.closeModal();
    } else {
      // Retorna o modal à posição original
      this.modalContent.style.transform = '';
      this.modalContent.style.transition = 'transform 0.3s ease';
    }
  }

  _onRecipeTouchMove() {
    this.isScrolling = true;
    clearTimeout(this.scrollTimeout);
    this.scrollTimeout = setTimeout(() => {
      this.isScrolling = false;
    }, 100);
  }

  _onResize() {
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      this.adjustModalSize();
    }, 250);
  }

  _onOrientationChange() {
    clearTimeout(this.orientationTimeout);
    this.orientationTimeout = setTimeout(() => {
      this.adjustModalSize();
    }, 100);
  }

  _onShow() {
    document.body.style.overflow = 'hidden';
    document.addEventListener('touchmove', this.preventBodyScroll, { passive: false });
    this.adjustModalSize();
  }

  _onHide() {
    document.body.style.overflow = '';
    document.removeEventListener('touchmove', this.preventBodyScroll);
  }

  _onModalContentKeydown(e) {
    if (e.key !== 'Tab') return;

    const focusableElements = this.modalContent.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (!focusableElements.length) return;

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        lastFocusable.focus();
        e.preventDefault();
      }
    } else if (document.activeElement === lastFocusable) {
      firstFocusable.focus();
      e.preventDefault();
    }
  }
}
