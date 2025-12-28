/**
 * @fileoverview Tooltip Manager
 * JS-based tooltip system with positioning and viewport awareness
 */

/**
 * Tooltip Manager Class
 * Manages a single tooltip element that follows elements with data-tooltip attribute
 */
export class TooltipManager {
  /** @type {HTMLElement|null} */
  #tooltipElement = null;

  /** @type {number|null} */
  #tooltipTimeout = null;

  /** @type {HTMLElement|null} */
  #container = null;

  /** @type {Function[]} */
  #cleanupHandlers = [];

  /**
   * Initialize tooltip system on a container
   * @param {HTMLElement} container - Container to attach tooltip listeners to
   */
  init(container) {
    if (!container) return;
    this.#container = container;

    // Create tooltip element once
    if (!this.#tooltipElement) {
      this.#tooltipElement = document.createElement('div');
      this.#tooltipElement.className = 'vault-tooltip-js';
      this.#tooltipElement.setAttribute('role', 'tooltip');
      this.#tooltipElement.setAttribute('aria-hidden', 'true');
      document.body.appendChild(this.#tooltipElement);
    }

    // Event handlers
    const handleMouseEnter = (e) => {
      const target = e.target.closest('[data-tooltip]');
      if (target) {
        this.#show(target);
      }
    };

    const handleMouseLeave = (e) => {
      const target = e.target.closest('[data-tooltip]');
      if (target) {
        this.#hide();
      }
    };

    const handleScroll = () => this.#hide();

    // Use event delegation on the container
    container.addEventListener('mouseenter', handleMouseEnter, true);
    container.addEventListener('mouseleave', handleMouseLeave, true);
    container.addEventListener('scroll', handleScroll, true);

    // Store for cleanup
    this.#cleanupHandlers.push(
      () => container.removeEventListener('mouseenter', handleMouseEnter, true),
      () => container.removeEventListener('mouseleave', handleMouseLeave, true),
      () => container.removeEventListener('scroll', handleScroll, true)
    );
  }

  /**
   * Show tooltip for target element
   * @param {HTMLElement} target - Element with data-tooltip attribute
   */
  #show(target) {
    const text = target.getAttribute('data-tooltip');
    if (!text || !this.#tooltipElement) return;

    // Clear any pending hide
    if (this.#tooltipTimeout) {
      clearTimeout(this.#tooltipTimeout);
      this.#tooltipTimeout = null;
    }

    // Set content
    this.#tooltipElement.textContent = text;

    // Get target position
    const rect = target.getBoundingClientRect();
    const tooltipPos = target.getAttribute('data-tooltip-pos') || 'top';

    // Make visible to measure
    this.#tooltipElement.style.visibility = 'hidden';
    this.#tooltipElement.style.display = 'block';

    const tooltipRect = this.#tooltipElement.getBoundingClientRect();
    const padding = 8;
    const arrowSize = 6;

    let top, left;

    switch (tooltipPos) {
      case 'bottom':
        top = rect.bottom + arrowSize + 2;
        left = rect.left + (rect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = rect.top + (rect.height - tooltipRect.height) / 2;
        left = rect.left - tooltipRect.width - arrowSize - 2;
        break;
      case 'right':
        top = rect.top + (rect.height - tooltipRect.height) / 2;
        left = rect.right + arrowSize + 2;
        break;
      case 'top':
      default:
        top = rect.top - tooltipRect.height - arrowSize - 2;
        left = rect.left + (rect.width - tooltipRect.width) / 2;
        break;
    }

    // Viewport boundary checks
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Horizontal bounds
    if (left < padding) {
      left = padding;
    } else if (left + tooltipRect.width > viewportWidth - padding) {
      left = viewportWidth - tooltipRect.width - padding;
    }

    // Vertical bounds - flip if needed
    if (top < padding && tooltipPos === 'top') {
      // Flip to bottom
      top = rect.bottom + arrowSize + 2;
      this.#tooltipElement.setAttribute('data-pos', 'bottom');
    } else if (top + tooltipRect.height > viewportHeight - padding && tooltipPos === 'bottom') {
      // Flip to top
      top = rect.top - tooltipRect.height - arrowSize - 2;
      this.#tooltipElement.setAttribute('data-pos', 'top');
    } else {
      this.#tooltipElement.setAttribute('data-pos', tooltipPos);
    }

    // Apply position
    this.#tooltipElement.style.top = `${top}px`;
    this.#tooltipElement.style.left = `${left}px`;
    this.#tooltipElement.style.visibility = 'visible';
    this.#tooltipElement.classList.add('visible');
    this.#tooltipElement.setAttribute('aria-hidden', 'false');
  }

  /**
   * Hide the tooltip
   */
  #hide() {
    if (!this.#tooltipElement) return;

    // Small delay to prevent flicker when moving between elements
    this.#tooltipTimeout = setTimeout(() => {
      this.#tooltipElement.classList.remove('visible');
      this.#tooltipElement.setAttribute('aria-hidden', 'true');
      this.#tooltipTimeout = null;
    }, 50);
  }

  /**
   * Force hide tooltip immediately
   */
  hideNow() {
    if (this.#tooltipTimeout) {
      clearTimeout(this.#tooltipTimeout);
      this.#tooltipTimeout = null;
    }
    if (this.#tooltipElement) {
      this.#tooltipElement.classList.remove('visible');
      this.#tooltipElement.setAttribute('aria-hidden', 'true');
    }
  }

  /**
   * Destroy tooltip manager and clean up
   */
  destroy() {
    // Clear timeout
    if (this.#tooltipTimeout) {
      clearTimeout(this.#tooltipTimeout);
      this.#tooltipTimeout = null;
    }

    // Remove event listeners
    this.#cleanupHandlers.forEach(fn => fn());
    this.#cleanupHandlers = [];

    // Remove tooltip element
    if (this.#tooltipElement) {
      this.#tooltipElement.remove();
      this.#tooltipElement = null;
    }

    this.#container = null;
  }
}

// Singleton instance for convenience
let instance = null;

/**
 * Get or create the tooltip manager singleton
 * @returns {TooltipManager}
 */
export function getTooltipManager() {
  if (!instance) {
    instance = new TooltipManager();
  }
  return instance;
}

/**
 * Initialize tooltips on a container using the singleton
 * @param {HTMLElement} container - Container element
 */
export function initTooltips(container) {
  getTooltipManager().init(container);
}

/**
 * Destroy the tooltip manager singleton
 */
export function destroyTooltips() {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}
