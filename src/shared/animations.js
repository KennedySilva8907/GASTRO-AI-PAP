/**
 * Shared food animation utilities used by home page and potentially other pages.
 * Extracted from main.js to eliminate duplication and enable reuse.
 */
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
