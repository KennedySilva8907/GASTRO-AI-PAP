import { prefersReducedMotion } from './shared/transitions.js';

export function startHomeVideo(video, win = window) {
  if (!video?.dataset.src) return false;
  if (prefersReducedMotion(win)) return false;
  if (win.navigator?.connection?.saveData) return false;

  video.src = video.dataset.src;
  return true;
}
