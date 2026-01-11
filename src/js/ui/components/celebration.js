/*
 * Copyright 2025 Julien Bombled
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Celebration Component
 * Confetti and celebration animations for positive user actions (BMAD Motivation)
 */

import { t } from '../../utils/i18n.js';
import { showToast } from '../../utils/toast.js';

/** Celebration types */
export const CELEBRATION_TYPES = {
  FIRST_ENTRY: 'firstEntry',
  SCORE_UP: 'scoreUp',
  ALL_STRONG: 'allStrong',
  MILESTONE: 'milestone'
};

/** Confetti colors */
const CONFETTI_COLORS = [
  '#6366f1', // Primary purple
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899'  // Pink
];

/** Check if user prefers reduced motion */
function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Celebration Component
 * Handles confetti animations and celebration messages
 */
export class Celebration {
  constructor() {
    this.container = null;
    this.particles = [];
    this.animationFrame = null;
  }

  /**
   * Trigger a celebration effect
   * @param {string} type - One of CELEBRATION_TYPES
   * @param {Object} options - Additional options
   */
  celebrate(type, options = {}) {
    // Respect reduced motion preference
    if (prefersReducedMotion()) {
      this.#showMessage(type, options);
      return;
    }

    // Show confetti
    this.#createConfetti(options);

    // Show celebration message
    this.#showMessage(type, options);
  }

  /**
   * Show celebration toast message
   * @param {string} type
   * @param {Object} options
   */
  #showMessage(type, options = {}) {
    const messages = {
      [CELEBRATION_TYPES.FIRST_ENTRY]: t('vault.celebration.firstEntry'),
      [CELEBRATION_TYPES.SCORE_UP]: t('vault.celebration.scoreUp'),
      [CELEBRATION_TYPES.ALL_STRONG]: t('vault.celebration.allStrong'),
      [CELEBRATION_TYPES.MILESTONE]: t('vault.celebration.milestone', { count: options.count || 10 })
    };

    const message = messages[type] || options.message;
    if (message) {
      showToast(message, 'success', 3000);
    }
  }

  /**
   * Create confetti animation
   * @param {Object} options
   */
  #createConfetti(options = {}) {
    const count = options.count || 50;
    const duration = options.duration || 2500;

    // Create container
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'celebration-container';
      this.container.setAttribute('aria-hidden', 'true');
      document.body.appendChild(this.container);
    }

    // Clear existing particles
    this.#cleanup();

    // Create particles
    for (let i = 0; i < count; i++) {
      const particle = this.#createParticle();
      this.particles.push(particle);
      this.container.appendChild(particle.element);
    }

    // Animate particles
    this.#animate(duration);
  }

  /**
   * Create a single confetti particle
   * @returns {Object}
   */
  #createParticle() {
    const element = document.createElement('div');
    element.className = 'confetti-particle';

    // Random properties
    const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    const size = Math.random() * 8 + 4;
    const x = Math.random() * window.innerWidth;
    const y = -20;

    // Random movement
    const velocityX = (Math.random() - 0.5) * 8;
    const velocityY = Math.random() * 3 + 2;
    const rotation = Math.random() * 360;
    const rotationSpeed = (Math.random() - 0.5) * 10;

    // Random shape (rectangle or circle)
    const isCircle = Math.random() > 0.5;

    element.style.cssText = `
      position: fixed;
      width: ${size}px;
      height: ${isCircle ? size : size * 0.6}px;
      background: ${color};
      border-radius: ${isCircle ? '50%' : '2px'};
      left: ${x}px;
      top: ${y}px;
      transform: rotate(${rotation}deg);
      pointer-events: none;
      z-index: 10000;
      opacity: 1;
    `;

    return {
      element,
      x,
      y,
      velocityX,
      velocityY,
      rotation,
      rotationSpeed,
      opacity: 1,
      gravity: 0.1
    };
  }

  /**
   * Animate particles
   * @param {number} duration
   */
  #animate(duration) {
    const startTime = performance.now();

    const frame = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = elapsed / duration;

      if (progress >= 1) {
        this.#cleanup();
        return;
      }

      // Update each particle
      this.particles.forEach(particle => {
        // Apply physics
        particle.velocityY += particle.gravity;
        particle.x += particle.velocityX;
        particle.y += particle.velocityY;
        particle.rotation += particle.rotationSpeed;

        // Fade out in last 30%
        if (progress > 0.7) {
          particle.opacity = 1 - ((progress - 0.7) / 0.3);
        }

        // Apply to element
        particle.element.style.left = `${particle.x}px`;
        particle.element.style.top = `${particle.y}px`;
        particle.element.style.transform = `rotate(${particle.rotation}deg)`;
        particle.element.style.opacity = particle.opacity;
      });

      this.animationFrame = requestAnimationFrame(frame);
    };

    this.animationFrame = requestAnimationFrame(frame);
  }

  /**
   * Cleanup particles and container
   */
  #cleanup() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    this.particles.forEach(particle => {
      particle.element.remove();
    });
    this.particles = [];
  }

  /**
   * Quick confetti burst at specific position
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} count - Number of particles
   */
  burst(x, y, count = 20) {
    if (prefersReducedMotion()) return;

    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'celebration-container';
      this.container.setAttribute('aria-hidden', 'true');
      document.body.appendChild(this.container);
    }

    // Create particles at specific position
    for (let i = 0; i < count; i++) {
      const particle = this.#createParticle();
      particle.x = x;
      particle.y = y;
      particle.velocityX = (Math.random() - 0.5) * 12;
      particle.velocityY = -(Math.random() * 6 + 4);

      this.particles.push(particle);
      this.container.appendChild(particle.element);

      particle.element.style.left = `${x}px`;
      particle.element.style.top = `${y}px`;
    }

    this.#animate(1500);
  }

  /**
   * Destroy the component
   */
  destroy() {
    this.#cleanup();
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}

// Singleton instance
let celebrationInstance = null;

/**
 * Get or create celebration instance
 * @returns {Celebration}
 */
export function getCelebration() {
  if (!celebrationInstance) {
    celebrationInstance = new Celebration();
  }
  return celebrationInstance;
}

/**
 * Trigger a celebration
 * @param {string} type - One of CELEBRATION_TYPES
 * @param {Object} options
 */
export function celebrate(type, options = {}) {
  getCelebration().celebrate(type, options);
}

/**
 * Trigger a confetti burst at position
 * @param {number} x
 * @param {number} y
 * @param {number} count
 */
export function celebrateBurst(x, y, count = 20) {
  getCelebration().burst(x, y, count);
}
