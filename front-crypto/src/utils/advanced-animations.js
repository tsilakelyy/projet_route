/**
 * ADVANCED ANIMATION UTILITIES
 * High-performance DOM animations with GPU acceleration
 * Optimized for smooth 60fps interactions
 */

class AdvancedAnimations {
  constructor() {
    this.mouse = { x: 0, y: 0 };
    this.initialized = false;
    this.elements = new Map();
    this.animationFrameId = null;
  }

  /**
   * Initialize all animation systems
   */
  init() {
    if (this.initialized) return;
    
    this.setupCursorTracking();
    this.setupScrollReveal();
    this.setupMagneticElements();
    this.setupParallax();
    this.setupEntryAnimations();
    
    this.initialized = true;
  }

  /**
   * CURSOR TRACKING - Updates glow position based on mouse movement
   * Used for: Background glow effect, button highlights
   */
  setupCursorTracking() {
    const updateCursorPosition = (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;

      // Update CSS variables for elements with cursor tracking
      const elementsWithTracking = document.querySelectorAll(
        '.route-login, .dashboard-container, .glass-card'
      );

      elementsWithTracking.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        el.style.setProperty('--cursor-x', `${x}%`);
        el.style.setProperty('--cursor-y', `${y}%`);
      });
    };

    document.addEventListener('mousemove', updateCursorPosition, {
      passive: true,
    });
  }

  /**
   * SCROLL REVEAL - Show elements as they enter viewport
   * Uses Intersection Observer API for performance
   */
  setupScrollReveal() {
    const revealElements = document.querySelectorAll('.scroll-reveal');

    if (!('IntersectionObserver' in window)) {
      revealElements.forEach((el) => el.classList.add('visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Add a small delay for stagger effect
          const delay = entry.target.dataset.revealDelay || 0;
          setTimeout(() => {
            entry.target.classList.add('visible');
          }, delay);

          // Unobserve single-use animations
          if (entry.target.dataset.revealOnce !== 'false') {
            observer.unobserve(entry.target);
          }
        }
      });
    });

    revealElements.forEach((el) => observer.observe(el));
  }

  /**
   * MAGNETIC CURSOR - Elements move slightly toward cursor on hover
   * Smooth follow with elastic easing
   */
  setupMagneticElements() {
    const magneticElements = document.querySelectorAll('.btn-modern, .route-login__brand-icon');

    magneticElements.forEach((element) => {
      let x = 0,
        y = 0,
        targetX = 0,
        targetY = 0;

      const magneticHolder = document.createElement('div');
      magneticHolder.style.position = 'relative';
      element.parentNode.insertBefore(magneticHolder, element);
      magneticHolder.appendChild(element);

      element.addEventListener('mousemove', (e) => {
        const rect = element.getBoundingClientRect();
        const elementCenterX = rect.left + rect.width / 2;
        const elementCenterY = rect.top + rect.height / 2;

        targetX = (e.clientX - elementCenterX) * 0.3;
        targetY = (e.clientY - elementCenterY) * 0.3;
      });

      element.addEventListener('mouseleave', () => {
        targetX = 0;
        targetY = 0;
      });

      // Smooth animation using requestAnimationFrame
      const animate = () => {
        x += (targetX - x) * 0.15; // Easing factor
        y += (targetY - y) * 0.15;

        element.style.transform = `translate(${x}px, ${y}px)`;
        requestAnimationFrame(animate);
      };

      animate();
    });
  }

  /**
   * PARALLAX EFFECT - Subtle depth effect on scroll
   */
  setupParallax() {
    const parallaxElements = document.querySelectorAll('[data-parallax]');

    if (parallaxElements.length === 0) return;

    window.addEventListener(
      'scroll',
      () => {
        parallaxElements.forEach((el) => {
          const speed = parseFloat(el.dataset.parallax) || 0.5;
          const yPos = window.scrollY * speed;
          el.style.transform = `translateY(${yPos}px)`;
        });
      },
      { passive: true }
    );
  }

  /**
   * ENTRY ANIMATIONS - Staggered element reveal on page load
   */
  setupEntryAnimations() {
    const staggers = document.querySelectorAll('.stagger-item, .fx-item');

    staggers.forEach((el) => {
      // Ensure element is visible after animation delay
      el.classList.add('fx-item');
    });

    // Trigger animations after DOM is ready
    setTimeout(() => {
      staggers.forEach((el) => {
        el.classList.add('fx-ready');
      });
    }, 100);
  }

  /**
   * CREATE RIPPLE EFFECT - Click animation for buttons
   * Creates expanding circle on click
   */
  createRipple(event) {
    const button = event.currentTarget;
    const circle = document.createElement('div');

    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;

    circle.style.width = `${diameter}px`;
    circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - button.offsetLeft - radius}px`;
    circle.style.top = `${event.clientY - button.offsetTop - radius}px`;
    circle.classList.add('route-login__btn-ripple');

    button.appendChild(circle);

    // Remove ripple after animation completes
    setTimeout(() => circle.remove(), 700);
  }

  /**
   * ADD FLOATING ANIMATION to an element
   * @param {HTMLElement} element
   * @param {number} intensity - Float distance in pixels (default: 8)
   * @param {number} duration - Animation duration in ms (default: 3500)
   */
  makeFloat(element, intensity = 8, duration = 3500) {
    const id = `float-${Math.random()}`;
    element.classList.add('float-element');
    element.style.setProperty('--float-intensity', `${intensity}px`);
    element.style.setProperty('--float-duration', `${duration}ms`);
  }

  /**
   * ADD GLOW EFFECT to an element
   * @param {HTMLElement} element
   * @param {string} color - Glow color (default: rgba(122, 69, 221, 0.4))
   */
  makeGlow(element, color = 'rgba(122, 69, 221, 0.4)') {
    element.classList.add('glow-element');
    element.style.setProperty('--glow-color', color);
  }

  /**
   * ENABLE 3D TILT EFFECT for cards
   * @param {HTMLElement} element
   * @param {number} intensity - Tilt intensity (default: 1)
   */
  enable3DTilt(element, intensity = 1) {
    element.classList.add('card-3d-tilt');

    element.addEventListener('mousemove', (e) => {
      const rect = element.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * (5 * intensity);
      const rotateY = ((centerX - x) / centerX) * (5 * intensity);

      element.style.transform = `
        perspective(1000px)
        rotateX(${rotateX}deg)
        rotateY(${rotateY}deg)
        translateZ(20px)
      `;
    });

    element.addEventListener('mouseleave', () => {
      element.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateZ(0)';
    });
  }

  /**
   * GRADIENT ANIMATION - Animate gradient background
   * @param {HTMLElement} element
   * @param {string[]} colors - Array of colors for gradient
   * @param {number} duration - Animation duration in ms
   */
  animateGradient(element, colors = [], duration = 6000) {
    if (colors.length < 2) return;

    element.classList.add('gradient-animated-premium');
    element.style.animation = `gradient-shift-advanced ${duration}ms ease infinite`;

    const gradientString = colors.join(', ');
    element.style.background = `linear-gradient(45deg, ${gradientString})`;
    element.style.backgroundSize = '300% 300%';
  }

  /**
   * OBSERVE ELEMENT VISIBILITY
   * Useful for lazy loading, animations, analytics
   */
  observeElement(element, callback) {
    if (!('IntersectionObserver' in window)) {
      callback(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        callback(true);
        observer.unobserve(element);
      }
    });

    observer.observe(element);
  }

  /**
   * SMOOTH SCROLL to element
   */
  smoothScroll(element, behavior = 'smooth') {
    element.scrollIntoView({
      behavior,
      block: 'nearest',
      inline: 'center',
    });
  }

  /**
   * CLEANUP - Remove all event listeners and reset
   */
  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.initialized = false;
  }
}

// Export for use in React/Vue components
window.AdvancedAnimations = AdvancedAnimations;

/**
 * AUTO-INITIALIZE on DOM ready
 * Can be disabled by setting window.AUTO_INIT_ANIMATIONS = false
 */
if (window.AUTO_INIT_ANIMATIONS !== false) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const animations = new AdvancedAnimations();
      animations.init();
      window.animations = animations; // Expose globally
    });
  } else {
    const animations = new AdvancedAnimations();
    animations.init();
    window.animations = animations;
  }
}
