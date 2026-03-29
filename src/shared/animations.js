/**
 * Shared food animation utilities used by home page and potentially other pages.
 * Extracted from main.js to eliminate duplication and enable reuse.
 */
import { foodImages } from './constants.js';

/**
 * Returns a random food image URL from the shared foodImages array.
 * @returns {string} URL of a random food image
 */
export function getRandomFoodImage() {
  const randomIndex = Math.floor(Math.random() * foodImages.length);
  return foodImages[randomIndex];
}

/**
 * Creates an animated food element that floats across the screen.
 * Appends to the provided container, auto-recycles on animation end.
 * @param {HTMLElement} container - The DOM element to append the food element to
 */
export function createFoodElement(container) {
  const foodElement = document.createElement('div');
  foodElement.classList.add('food-element');
  foodElement.style.backgroundImage = `url('${getRandomFoodImage()}')`;

  const startX = Math.random() * 100;
  const startY = Math.random() * 100;
  const endX = Math.random() * 100;
  const endY = Math.random() * 100;

  foodElement.style.setProperty('--start-x', startX);
  foodElement.style.setProperty('--start-y', startY);
  foodElement.style.setProperty('--end-x', endX);
  foodElement.style.setProperty('--end-y', endY);

  container.appendChild(foodElement);

  foodElement.addEventListener('animationend', () => {
    foodElement.remove();
    createFoodElement(container);
  });
}

/**
 * Creates particle explosion effect from a click point using anime.js.
 * @param {MouseEvent} e - The mouse event with click coordinates
 */
export function createFoodParticles(e) {
  const foodEmojis = ['🍕', '🍔', '🍟', '🌭', '🍿', '🥗', '🍱', '🍣', '🍜', '🍝'];
  for (let i = 0; i < 20; i++) {
    const particle = document.createElement('div');
    particle.classList.add('food-particle');
    particle.style.backgroundImage = `url("https://twemoji.maxcdn.com/v/latest/svg/${foodEmojis[Math.floor(Math.random() * foodEmojis.length)].codePointAt(0).toString(16)}.svg")`;
    particle.style.left = `${e.clientX}px`;
    particle.style.top = `${e.clientY}px`;
    document.body.appendChild(particle);

    const angle = Math.random() * Math.PI * 2;
    const velocity = 2;
    const tx = Math.cos(angle) * 100 * velocity;
    const ty = Math.sin(angle) * 100 * velocity;

    anime({
      targets: particle,
      translateX: tx,
      translateY: ty,
      scale: [1, 0],
      opacity: [2, 0],
      easing: 'easeOutExpo',
      duration: 1000,
      complete: function () {
        particle.remove();
      },
    });
  }
}
