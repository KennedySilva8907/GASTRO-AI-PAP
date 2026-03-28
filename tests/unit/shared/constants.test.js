import { describe, it, expect } from 'vitest';
import { foodImages, API_ENDPOINTS } from '../../../src/shared/constants.js';

describe('foodImages', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(foodImages)).toBe(true);
    expect(foodImages.length).toBeGreaterThan(0);
  });

  it('contains exactly 10 image URLs', () => {
    expect(foodImages).toHaveLength(10);
  });

  it('every entry is a string starting with https://', () => {
    for (const url of foodImages) {
      expect(typeof url).toBe('string');
      expect(url).toMatch(/^https:\/\//);
    }
  });
});

describe('API_ENDPOINTS', () => {
  it('has chat endpoint pointing to /api/chat', () => {
    expect(API_ENDPOINTS.chat).toBe('/api/chat');
  });

  it('has gemini endpoint pointing to /api/gemini', () => {
    expect(API_ENDPOINTS.gemini).toBe('/api/gemini');
  });

  it('has exactly 2 endpoint keys', () => {
    expect(Object.keys(API_ENDPOINTS)).toHaveLength(2);
  });
});
