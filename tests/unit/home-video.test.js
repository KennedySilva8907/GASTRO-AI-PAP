// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { startHomeVideo } from '../../src/home-video.js';

function fakeWindow({ reducedMotion = false, saveData = false } = {}) {
  return {
    matchMedia: () => ({ matches: reducedMotion }),
    navigator: { connection: { saveData } },
  };
}

describe('the home background video', () => {
  let video;

  beforeEach(() => {
    document.body.innerHTML =
      '<video class="home-video" muted loop playsinline autoplay data-src="media/home-loop.mp4" poster="media/home-loop.jpg"></video>';
    video = document.querySelector('.home-video');
  });

  it('starts loading the loop once it is asked to', () => {
    expect(startHomeVideo(video, fakeWindow())).toBe(true);
    expect(video.getAttribute('src')).toBe('media/home-loop.mp4');
  });

  it('stays on the still frame for anyone who asked for reduced motion', () => {
    expect(startHomeVideo(video, fakeWindow({ reducedMotion: true }))).toBe(false);
    expect(video.hasAttribute('src')).toBe(false);
  });

  it('stays on the still frame when the browser is saving data', () => {
    expect(startHomeVideo(video, fakeWindow({ saveData: true }))).toBe(false);
    expect(video.hasAttribute('src')).toBe(false);
  });

  it('does nothing when the page has no video', () => {
    expect(startHomeVideo(null, fakeWindow())).toBe(false);
  });

  it('works in a browser that knows nothing about data saving', () => {
    const win = { matchMedia: () => ({ matches: false }), navigator: {} };

    expect(startHomeVideo(video, win)).toBe(true);
  });
});
