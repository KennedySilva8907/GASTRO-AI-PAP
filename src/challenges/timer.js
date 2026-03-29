/**
 * Timer management for timed cooking challenges.
 * Handles countdown, pause, resume, progress bar updates.
 */

/**
 * Create a timer instance for a challenge.
 * @param {number} totalMinutes - Total challenge time in minutes
 * @param {object} callbacks - { onTick, onComplete, onPause, onResume }
 * @returns {object} Timer control interface { start, pause, resume, stop, getRemaining }
 */
export function createTimer(totalMinutes, callbacks) {
  const totalSeconds = totalMinutes * 60;
  let remainingSeconds = totalSeconds;
  let intervalId = null;
  let isPaused = false;

  function tick() {
    remainingSeconds--;
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const progress = ((totalSeconds - remainingSeconds) / totalSeconds) * 100;

    callbacks.onTick({ minutes, seconds, progress, remainingSeconds });

    if (remainingSeconds <= 0) {
      stop();
      callbacks.onComplete();
    }
  }

  function start() {
    if (intervalId) return;
    intervalId = setInterval(tick, 1000);
  }

  function pause() {
    if (!intervalId || isPaused) return;
    clearInterval(intervalId);
    intervalId = null;
    isPaused = true;
    if (callbacks.onPause) callbacks.onPause(remainingSeconds);
  }

  function resume() {
    if (!isPaused) return;
    isPaused = false;
    intervalId = setInterval(tick, 1000);
    if (callbacks.onResume) callbacks.onResume(remainingSeconds);
  }

  function stop() {
    if (intervalId) {
      clearInterval(intervalId);
    }
    intervalId = null;
    isPaused = false;
  }

  function getRemaining() {
    return remainingSeconds;
  }

  return { start, pause, resume, stop, getRemaining };
}

/**
 * Formats time in hh:mm:ss or mm:ss format.
 * @param {number} totalSeconds - Total seconds to format
 * @returns {string} Formatted time string
 */
export function formatTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}
