/**
 * Recipe API communication for timed cooking challenges.
 * Handles Gemini API calls, response processing, and recipe parsing.
 */

import { API_ENDPOINTS } from '../shared/constants.js';
import { UserFacingError, handleAsyncError } from '../shared/errors.js';

// Preparation times per difficulty level (minutes)
const PREPARATION_TIMES = {
  principiante: 20,
  intermedio: 45,
  avancado: 60,
  extremo: 90,
};

/**
 * Gets a recipe from Gemini API for the specified difficulty level.
 * @param {string} level - Difficulty level (principiante, intermedio, avancado, extremo)
 * @returns {Promise<Object>} Recipe object with name, description, ingredients, instructions, tips
 */
export async function getRecipe(level) {
  try {
    const requestBody = buildRequestBody(level);
    const response = await fetch(API_ENDPOINTS.gemini, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new UserFacingError(
        `API Error: ${response.status}`,
        'Não foi possível carregar a receita. Tente novamente.'
      );
    }

    const data = await response.json();
    const text = extractResponseText(data);
    return processRecipeText(text, level);
  } catch (error) {
    handleAsyncError(error, 'Erro ao carregar receita.');
    return retryGetRecipe(level);
  }
}

/**
 * Builds the Gemini API request body for recipe generation.
 * @param {string} level - Difficulty level
 * @returns {Object} API request body
 */
function buildRequestBody(level) {
  const prepTime = PREPARATION_TIMES[level] || 30;

  const cuisineTypes = [
    'portuguesa',
    'italiana',
    'francesa',
    'japonesa',
    'mexicana',
    'indiana',
    'tailandesa',
    'grega',
    'espanhola',
    'marroquina',
    'brasileira',
    'chinesa',
    'alemã',
    'russa',
    'libanesa',
  ];

  const mealTypes = [
    'entrada',
    'prato principal',
    'sobremesa',
    'lanche',
    'bebida',
    'sopa',
    'salada',
    'pequeno-almoço',
    'brunch',
    'jantar',
  ];

  const dietaryOptions = [
    '',
    'vegetariana',
    'vegana',
    'sem glúten',
    'baixa em carboidratos',
    'sem lactose',
    'paleo',
    'mediterrânea',
  ];

  const randomCuisine = cuisineTypes[Math.floor(Math.random() * cuisineTypes.length)];
  const randomMeal = mealTypes[Math.floor(Math.random() * mealTypes.length)];
  const randomDietary = dietaryOptions[Math.floor(Math.random() * dietaryOptions.length)];

  const prompt = buildPrompt(level, prepTime, randomCuisine, randomMeal, randomDietary);
  const maxTokens = getMaxTokensForLevel(level);

  return {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: 'Use sempre português de Portugal nas suas respostas. Você é um assistente especializado em gastronomia e gestão de tempo na cozinha.',
          },
        ],
      },
      {
        role: 'model',
        parts: [
          {
            text: 'Entendido. Sou um assistente especializado em gastronomia e gestão de tempo na cozinha. Vou responder em português de Portugal.',
          },
        ],
      },
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: maxTokens,
    },
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
    ],
  };
}

/**
 * Builds the prompt for recipe generation.
 */
function buildPrompt(level, prepTime, cuisine, meal, dietary) {
  const basePrompt = `Crie uma receita culinária ${dietary} que possa ser completamente preparada em NO MÁXIMO ${prepTime} minutos totais. A receita deve ser adequada para o nível ${level} e pode ser uma ${meal} de inspiração ${cuisine}.`;

  let levelSpecific;
  switch (level) {
    case 'principiante':
      levelSpecific = `Esta deve ser uma receita simples e rápida, com poucos ingredientes e passos muito simples. O tempo total de preparação e cozimento NÃO PODE exceder ${prepTime} minutos.`;
      break;
    case 'intermedio':
      levelSpecific = `Esta deve ser uma receita de complexidade média, com técnicas moderadas. O tempo total de preparação e cozimento NÃO PODE exceder ${prepTime} minutos.`;
      break;
    case 'avancado':
      levelSpecific = `Esta deve ser uma receita sofisticada, que exija algumas técnicas específicas, mas ainda assim realizável dentro do limite de ${prepTime} minutos de tempo total.`;
      break;
    case 'extremo':
      levelSpecific = `Esta deve ser uma receita desafiadora com técnicas avançadas, própria de chefs profissionais, mas ainda assim completável dentro do limite de ${prepTime} minutos de tempo total.`;
      break;
    default:
      levelSpecific = '';
  }

  return `${basePrompt}. ${levelSpecific} Por favor, formate a resposta exatamente assim:\n\nNome da Receita: [Apenas o nome principal da receita, sem palavras como "rápido", "fácil", "simples" , "expresso", "Desconstruído" , "Desconstruída" , "relampago" .]\n\nDescrição: [breve descrição aqui]\n\nTempo Total: ${prepTime} minutos\n\nIngredientes:\n200g de farinha\n2 ovos\n1 litro de leite\n[etc...]\n\nInstruções (com tempos estimados):\n1. Misture a farinha e o açúcar. (2 minutos)\n2. Bata os ovos e adicione à mistura. (3 minutos)\n3. Leve ao forno por 15 minutos. (15 minutos)\n[etc...]\n\nDicas do Chef:\n[dica 1]\n[dica 2]\n[etc...]\n\nIMPORTANTE: CADA INGREDIENTE DEVE TER UMA QUANTIDADE NUMÉRICA CLARA (ex: 200g, 2 colheres, 3 unidades). CADA PASSO DEVE TER UMA ESTIMATIVA DE TEMPO ENTRE PARÊNTESES SEMPRE COLOCADA APÓS O PONTO FINAL DA INSTRUÇÃO. A receita DEVE ser completável dentro do tempo total de ${prepTime} minutos. NÃO use asteriscos ou outros caracteres especiais. Todo o conteúdo deve estar em português de Portugal. NÃO INCLUA QUALQUER ID ÚNICO NO TEXTO. NÃO INCLUA INSTRUÇÕES DE LIMPEZA OU LAVAGEM DE LOUÇA NAS ETAPAS.`;
}

/**
 * Returns appropriate token count based on difficulty level.
 */
function getMaxTokensForLevel(level) {
  const tokenMap = {
    principiante: 4096,
    intermedio: 4096,
    avancado: 8192,
    extremo: 8192,
  };
  return tokenMap[level] || 1024;
}

/**
 * Extracts response text from Gemini API response.
 */
function extractResponseText(data) {
  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new UserFacingError(
      'Invalid API response format',
      'Formato de resposta inválido da API Gemini'
    );
  }
  return data.candidates[0].content.parts[0].text.trim();
}

/**
 * Retries recipe fetch with simplified prompt.
 */
async function retryGetRecipe(level) {
  const prepTime = PREPARATION_TIMES[level] || 30;
  try {
    const response = await fetch(API_ENDPOINTS.gemini, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Crie uma receita simples de nível ${level} em ${prepTime} minutos. Formato: Nome da Receita, Descrição, Tempo Total: ${prepTime} minutos, Ingredientes, Instruções, Dicas do Chef.`,
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return processRecipeText(data.candidates[0].content.parts[0].text.trim(), level);
    }
  } catch (retryError) {
    handleAsyncError(retryError, 'Erro na segunda tentativa');
  }

  return createFallbackRecipe(level);
}

/**
 * Creates a basic fallback recipe for API failures.
 */
function createFallbackRecipe(level) {
  const prepTime = PREPARATION_TIMES[level] || 30;
  const levelNames = {
    principiante: 'Principiante',
    intermedio: 'Intermédio',
    avancado: 'Avançado',
    extremo: 'Extremo',
  };

  return {
    name: `Desafio de Culinária - Nível ${levelNames[level] || level}`,
    description: 'Uma receita simples para salvar o dia.',
    totalTime: prepTime,
    ingredients: [
      '200g de farinha',
      '2 ovos',
      '100ml de leite',
      '50g de manteiga',
      '1 colher de sopa de açúcar',
      '1 pitada de sal',
    ],
    instructions: [
      'Misture todos os ingredientes secos numa tigela. (3 minutos)',
      'Adicione os ingredientes líquidos e misture bem. (2 minutos)',
      `Cozinhe conforme desejado. (${Math.floor(prepTime / 2)} minutos)`,
      `Deixe arrefecer antes de servir. (${Math.floor(prepTime / 4)} minutos)`,
    ],
    tips: [
      'Adapte os ingredientes ao seu gosto pessoal.',
      'Organize todos os ingredientes antes de começar para poupar tempo.',
    ],
  };
}

/**
 * Processes raw recipe text from API into structured format.
 */
function processRecipeText(text, level) {
  const recipe = {
    name: 'Receita de ' + level.charAt(0).toUpperCase() + level.slice(1),
    description: 'Uma deliciosa receita para o seu nível.',
    totalTime: PREPARATION_TIMES[level] || 30,
    ingredients: [],
    instructions: [],
    tips: [],
  };

  text = text.replace(/\r\n/g, '\n').replace(/\*/g, '');
  text = text.replace(/ID [Úú]nico:?\s*\d+/gi, '');

  // Extract name
  const nameMatch = text.match(/Nome da Receita:[\s]*([\s\S]*?)(?=\n\s*\n|\n(?=Descrição:|$))/i);
  if (nameMatch?.[1]) {
    recipe.name = nameMatch[1].trim();
  }

  // Extract description
  const descMatch = text.match(
    /Descrição:[\s]*([\s\S]*?)(?=\n\s*\n|\n(?=Tempo Total:|Ingredientes:|$))/i
  );
  if (descMatch?.[1]) {
    recipe.description = descMatch[1].trim().replace(/\n/g, ' ');
  }

  // Extract total time
  const timeMatch = text.match(/Tempo Total:[\s]*(\d+)[\s]*minutos/i);
  if (timeMatch?.[1]) {
    recipe.totalTime = parseInt(timeMatch[1]);
  }

  // Extract ingredients
  recipe.ingredients = extractIngredients(text);
  if (recipe.ingredients.length === 0) {
    recipe.ingredients = createFallbackRecipe(level).ingredients;
  }

  // Extract instructions
  recipe.instructions = extractInstructions(text);
  if (recipe.instructions.length === 0) {
    recipe.instructions = [
      'Misture todos os ingredientes e siga conforme a sua preferência. (10 minutos)',
    ];
  }

  // Extract tips
  recipe.tips = extractTips(text);
  if (recipe.tips.length === 0) {
    recipe.tips = ['Adapte esta receita ao seu gosto pessoal.'];
  }

  return recipe;
}

/**
 * Extracts ingredients list from recipe text.
 */
function extractIngredients(text) {
  const match = text.match(
    /(?:##\s*)?Ingredientes\s*:?\s*([\s\S]*?)(?=\n\s*(?:##\s*)?(?:Instruções|Dicas)|$)/i
  );
  if (!match) return [];

  const lines = match[1]
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const ingredients = [];

  for (const line of lines) {
    if (/^para\s+[^:]+:/i.test(line)) {
      ingredients.push(`__CATEGORY__${line}`);
    } else if (/\d/.test(line) && !line.startsWith('__CATEGORY__')) {
      ingredients.push(line);
    }
  }

  return ingredients;
}

/**
 * Extracts and processes instructions from recipe text.
 */
function extractInstructions(text) {
  const instrMatch = text.match(
    /(?:##\s*)?Instruções(?:\s*\(com tempos estimados\))?\s*:?\s*([\s\S]*?)(?=\n\s*(?:##\s*)?Dicas|$)/i
  );
  if (!instrMatch?.[1]) return [];

  let instructions = instrMatch[1]
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^[-•*]\s*/, ''))
    .map((line) => line.replace(/^(\d+)[.)]\s+/, ''))
    .filter((line) => !/limp[ae]r?|lav[ae]r?/i.test(line));

  return instructions.map((instruction) => {
    const timeMatch = instruction.match(
      /\((\d+(\s*-\s*\d+)?)[\s]*(minutos?|mins?|m|segundos?|segs?|seg|horas?|hrs?|h)\)/i
    );

    if (timeMatch) {
      const parts = instruction.split(
        /\s*\(\d+(\s*-\s*\d+)?[\s]*(minutos?|mins?|m|segundos?|segs?|seg|horas?|hrs?|h)\)/i
      );
      if (!parts[0].trim().endsWith('.')) {
        const tempoTexto = instruction.match(
          /\((\d+(\s*-\s*\d+)?)[\s]*(minutos?|mins?|m|segundos?|segs?|seg|horas?|hrs?|h)\)/i
        )[0];
        return `${parts[0].trim()}. ${tempoTexto}`;
      }
      return instruction;
    }

    if (instruction.trim().endsWith('.')) {
      return `${instruction} (2 minutos)`;
    }
    return `${instruction}. (2 minutos)`;
  });
}

/**
 * Extracts chef tips from recipe text.
 */
function extractTips(text) {
  const tipsMatch = text.match(/(?:##\s*)?Dicas(?:\s+do\s+Chef)?\s*:?\s*([\s\S]*?)(?=$)/i);
  if (!tipsMatch?.[1]) return [];

  return tipsMatch[1]
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^[\d.)]+\s*/, ''))
    .map((line) => line.replace(/^[-•*]\s*/, ''))
    .map((line) => line.replace(/ID [Úú]nico:?\s*\d+/gi, '').trim())
    .filter((line) => line.length > 0);
}
