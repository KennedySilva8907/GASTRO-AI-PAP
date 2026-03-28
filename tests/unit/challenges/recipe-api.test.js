import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getRecipe } from '../../../src/challenges/recipe-api.js';

// Helper: create a mock Gemini API response with given recipe text
function mockGeminiResponse(text) {
  return {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
  };
}

// A well-formatted recipe text that matches the expected parsing format
const VALID_RECIPE_TEXT = `Nome da Receita: Massa Carbonara

Descrição: Um clássico italiano preparado em poucos minutos.

Tempo Total: 20 minutos

Ingredientes:
200g de esparguete
2 ovos grandes
100g de bacon
50g de queijo parmesão

Instruções (com tempos estimados):
1. Coza a massa em água salgada. (10 minutos)
2. Frite o bacon até ficar crocante. (5 minutos)
3. Misture os ovos com o queijo. (2 minutos)
4. Combine tudo e sirva. (3 minutos)

Dicas do Chef:
Use ovos frescos para melhor resultado.
Não deixe a massa passar do ponto.`;

describe('getRecipe', () => {
  let originalConsoleError;

  beforeEach(() => {
    // Suppress console.error from handleAsyncError during tests
    originalConsoleError = console.error;
    console.error = vi.fn();
    console.warn = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
    vi.restoreAllMocks();
  });

  describe('with valid API response', () => {
    beforeEach(() => {
      globalThis.fetch = vi.fn().mockResolvedValue(mockGeminiResponse(VALID_RECIPE_TEXT));
    });

    it('parses recipe name from response text', async () => {
      const recipe = await getRecipe('principiante');
      expect(recipe.name).toBe('Massa Carbonara');
    });

    it('extracts ingredients as an array', async () => {
      const recipe = await getRecipe('principiante');
      expect(Array.isArray(recipe.ingredients)).toBe(true);
      expect(recipe.ingredients.length).toBeGreaterThan(0);
      expect(recipe.ingredients).toContain('200g de esparguete');
    });

    it('extracts totalTime from Tempo Total line', async () => {
      const recipe = await getRecipe('principiante');
      expect(recipe.totalTime).toBe(20);
    });

    it('extracts instructions as an array', async () => {
      const recipe = await getRecipe('principiante');
      expect(Array.isArray(recipe.instructions)).toBe(true);
      expect(recipe.instructions.length).toBeGreaterThan(0);
      // Instructions should contain time annotations
      expect(recipe.instructions[0]).toMatch(/\(\d+\s*minutos?\)/i);
    });

    it('extracts chef tips as an array', async () => {
      const recipe = await getRecipe('principiante');
      expect(Array.isArray(recipe.tips)).toBe(true);
      expect(recipe.tips.length).toBeGreaterThan(0);
      expect(recipe.tips[0]).toContain('ovos frescos');
    });

    it('sends POST request to the gemini API endpoint', async () => {
      await getRecipe('principiante');
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = globalThis.fetch.mock.calls[0];
      expect(url).toBe('/api/gemini');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
    });

    it('sends request body with contents array and generationConfig', async () => {
      await getRecipe('principiante');
      const requestBody = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
      expect(requestBody).toHaveProperty('contents');
      expect(Array.isArray(requestBody.contents)).toBe(true);
      expect(requestBody).toHaveProperty('generationConfig');
      expect(requestBody.generationConfig).toHaveProperty('temperature');
      expect(requestBody.generationConfig).toHaveProperty('maxOutputTokens');
    });
  });

  describe('fallback behavior on API failure', () => {
    it('returns a fallback recipe when both fetch attempts fail', async () => {
      // Both the initial call and the retry will reject
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const recipe = await getRecipe('principiante');

      // Fallback recipe should have all required fields
      expect(recipe).toHaveProperty('name');
      expect(recipe).toHaveProperty('description');
      expect(recipe).toHaveProperty('totalTime');
      expect(recipe).toHaveProperty('ingredients');
      expect(recipe).toHaveProperty('instructions');
      expect(recipe).toHaveProperty('tips');
    });

    it('fallback recipe totalTime matches level (20 for principiante)', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const recipe = await getRecipe('principiante');
      expect(recipe.totalTime).toBe(20);
    });

    it('fallback recipe totalTime matches level (45 for intermedio)', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const recipe = await getRecipe('intermedio');
      expect(recipe.totalTime).toBe(45);
    });

    it('fallback recipe has non-empty ingredients and instructions', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const recipe = await getRecipe('principiante');
      expect(recipe.ingredients.length).toBeGreaterThan(0);
      expect(recipe.instructions.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases in text parsing', () => {
    it('handles recipe text with asterisks (stripped by processRecipeText)', async () => {
      const textWithAsterisks = VALID_RECIPE_TEXT.replace('Massa Carbonara', '**Massa Carbonara**');
      globalThis.fetch = vi.fn().mockResolvedValue(mockGeminiResponse(textWithAsterisks));
      const recipe = await getRecipe('principiante');
      // Asterisks should be stripped
      expect(recipe.name).not.toContain('*');
    });

    it('handles missing description gracefully', async () => {
      const textNoDesc = `Nome da Receita: Bolo Simples

Tempo Total: 30 minutos

Ingredientes:
200g de farinha
2 ovos

Instruções (com tempos estimados):
1. Misture tudo. (5 minutos)

Dicas do Chef:
Sirva quente.`;
      globalThis.fetch = vi.fn().mockResolvedValue(mockGeminiResponse(textNoDesc));
      const recipe = await getRecipe('principiante');
      expect(recipe.name).toBe('Bolo Simples');
      expect(recipe.description).toBeDefined();
    });

    it('handles non-ok HTTP response by falling back to retry then fallback recipe', async () => {
      globalThis.fetch = vi.fn()
        // First call: non-ok response
        .mockResolvedValueOnce({ ok: false, status: 500 })
        // Retry call: also fails
        .mockRejectedValueOnce(new Error('retry also fails'));

      const recipe = await getRecipe('avancado');
      expect(recipe).toHaveProperty('name');
      expect(recipe.totalTime).toBe(60);
    });
  });
});
