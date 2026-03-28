
    document.addEventListener('DOMContentLoaded', function() {
    // ===== CONFIGURAÇÕES INICIAIS =====
    // Configuração da API Gemini
const RECIPE_API_URL = '/api/gemini'; // Para as receitas

// ===============================================================
// SECURITY: DOMPurify Configuration for XSS Prevention
// ===============================================================
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ['p', 'strong', 'em', 'ul', 'ol', 'li', 'code', 'pre', 'br', 'a', 'h1', 'h2', 'h3', 'h4', 'span', 'i', 'div'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'id'],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'object', 'embed'],
  FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover']
};

function sanitizeHtml(html) {
  if (typeof DOMPurify === 'undefined') {
    console.warn('[Security] DOMPurify not loaded, stripping all HTML tags');
    return html.replace(/<[^>]*>/g, '');
  }
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

    // Referências aos elementos principais
    const mainContainer = document.getElementById('main-container');
    const backgroundAnimation = document.querySelector('.background-animation');
    const challengeButtons = document.querySelectorAll('.challenge-button');
    
    // Tempos de preparo conforme nível (em minutos)
    const preparationTimes = {
        'principiante': 20,
        'intermedio': 45,
        'avancado': 60,
        'extremo': 90,
    };
    
    // Variáveis globais para controle de timer e pausa
    let timerInterval = null;
    let isPaused = false;
    let remainingTimeAtPause = 0;
    let originalTotalTimeInSeconds; // Armazena o tempo total original em segundos
    
    // ===== ANIMAÇÃO DE FUNDO =====
    // Lista de imagens de alimentos para animação de fundo
    const foodImages = [
        // Alimentos básicos
        "https://cdn-icons-png.flaticon.com/512/1046/1046784.png", // Pizza
        "https://cdn-icons-png.flaticon.com/512/1046/1046771.png", // Hambúrguer
        "https://cdn-icons-png.flaticon.com/512/1046/1046755.png", // Salada
        "https://cdn-icons-png.flaticon.com/512/135/135728.png",   // Bolo
        "https://cdn-icons-png.flaticon.com/512/6301/6301302.png", // Café
        "https://cdn-icons-png.flaticon.com/512/5344/5344260.png", // Frango
        "https://cdn-icons-png.flaticon.com/512/1046/1046748.png", // Sorvete
        "https://cdn-icons-png.flaticon.com/512/6108/6108623.png", // Macarrão
        "https://cdn-icons-png.flaticon.com/512/2909/2909761.png", // Frutas
        "https://cdn-icons-png.flaticon.com/512/1102/1102780.png", // Pão
        
        // Adicionando mais variedade
        "https://cdn-icons-png.flaticon.com/512/2515/2515263.png", // Taco
        "https://cdn-icons-png.flaticon.com/512/1147/1147805.png", // Sushi
        "https://cdn-icons-png.flaticon.com/512/3075/3075977.png", // Croissant
        "https://cdn-icons-png.flaticon.com/512/3075/3075929.png", // Cupcake
        "https://cdn-icons-png.flaticon.com/512/2965/2965567.png", // Donut
        "https://cdn-icons-png.flaticon.com/512/1147/1147801.png", // Panqueca
        "https://cdn-icons-png.flaticon.com/512/1147/1147803.png", // Sanduíche
        "https://cdn-icons-png.flaticon.com/512/2515/2515183.png", // Queijo
        "https://cdn-icons-png.flaticon.com/512/3075/3075975.png", // Ovo frito
        "https://cdn-icons-png.flaticon.com/512/1147/1147802.png", // Batata frita
        
        // Mais opções
        "https://cdn-icons-png.flaticon.com/512/1046/1046751.png", // Carne
        "https://cdn-icons-png.flaticon.com/512/1046/1046767.png", // Peixe
        "https://cdn-icons-png.flaticon.com/512/1046/1046786.png", // Camarão
        "https://cdn-icons-png.flaticon.com/512/1046/1046781.png", // Legumes
        "https://cdn-icons-png.flaticon.com/512/1046/1046782.png", // Milho
        "https://cdn-icons-png.flaticon.com/512/1046/1046754.png", // Abacaxi
        "https://cdn-icons-png.flaticon.com/512/1046/1046761.png", // Morango
        "https://cdn-icons-png.flaticon.com/512/1046/1046766.png", // Uva
        "https://cdn-icons-png.flaticon.com/512/1046/1046772.png", // Maçã
        "https://cdn-icons-png.flaticon.com/512/1046/1046800.png", // Cereja
        
        // Bebidas e sobremesas
        "https://cdn-icons-png.flaticon.com/512/1046/1046757.png", // Milk-shake
        "https://cdn-icons-png.flaticon.com/512/1046/1046759.png", // Refrigerante
        "https://cdn-icons-png.flaticon.com/512/1046/1046785.png", // Vinho
        "https://cdn-icons-png.flaticon.com/512/1046/1046793.png", // Cerveja
        "https://cdn-icons-png.flaticon.com/512/1046/1046764.png", // Água
        "https://cdn-icons-png.flaticon.com/512/1046/1046778.png", // Chocolate
        "https://cdn-icons-png.flaticon.com/512/1046/1046776.png", // Biscoito
        "https://cdn-icons-png.flaticon.com/512/1046/1046789.png", // Pirulito
        "https://cdn-icons-png.flaticon.com/512/1046/1046790.png", // Waffle
        "https://cdn-icons-png.flaticon.com/512/1046/1046795.png"  // Torta
    ];
    
    // Configurações da animação de fundo
    const totalFoodItems = 25;  // Número de elementos de comida na tela
    const fixedSize = 40;       // Tamanho fixo para todos os alimentos
    let foodElements = [];      // Array para rastrear todos os elementos de comida
    
    /**
     * Cria um único elemento de comida para a animação de fundo
     * @returns {HTMLElement} O elemento de comida criado
     */
    function createFoodItem() {
        const foodItem = document.createElement('div');
        foodItem.classList.add('food-item');
        
        // Selecionar uma imagem aleatória
        const randomImage = foodImages[Math.floor(Math.random() * foodImages.length)];
        
        // Configurar propriedades do item
        const posX = Math.floor(Math.random() * 100);
        const duration = Math.random() * 10 + 10;
        const rotation = Math.random() * 360;
        
        // Aplicar estilos
        foodItem.style.width = `${fixedSize}px`;
        foodItem.style.height = `${fixedSize}px`;
        foodItem.style.left = `${posX}%`;
        foodItem.style.top = `-${fixedSize}px`;
        foodItem.style.backgroundImage = `url('${randomImage}')`;
        foodItem.style.backgroundSize = 'contain';
        foodItem.style.backgroundRepeat = 'no-repeat';
        foodItem.style.backgroundPosition = 'center';
        foodItem.style.animation = `fall ${duration}s linear`;
        foodItem.style.opacity = '0.5';
        foodItem.style.transform = `rotate(${rotation}deg)`;
        
        // Adicionar à animação de fundo
        backgroundAnimation.appendChild(foodItem);
        
        // Monitorar quando o elemento sai da tela e substituí-lo
        foodItem.addEventListener('animationend', function() {
            // Remover o elemento atual
            if (foodItem.parentNode === backgroundAnimation) {
                backgroundAnimation.removeChild(foodItem);
                
                // Remover do array de rastreamento
                const index = foodElements.indexOf(foodItem);
                if (index > -1) {
                    foodElements.splice(index, 1);
                }
                
                // Criar um novo elemento para substituí-lo
                const newItem = createFoodItem();
                foodElements.push(newItem);
            }
        });
        
        return foodItem;
    }
    
    /**
     * Inicializa a animação de fundo com elementos de comida
     */
    function initFoodAnimation() {
        // Limpar animações existentes
        backgroundAnimation.innerHTML = '';
        foodElements = [];
        
        // Criar elementos iniciais
        for (let i = 0; i < totalFoodItems; i++) {
            // Criar com posições Y distribuídas para não começarem todos juntos
            const foodItem = createFoodItem();
            
            // Distribuir os itens iniciais em diferentes posições Y
            if (i > 0) {
                const initialProgress = Math.random() * 100;
                const computedStyle = window.getComputedStyle(foodItem);
                const duration = parseFloat(computedStyle.animationDuration) || 15;
                
                // Definir delay negativo para começar em pontos diferentes da animação
                foodItem.style.animationDelay = `-${initialProgress * duration / 100}s`;
            }
            
            foodElements.push(foodItem);
        }
    }

    
        // ===== FUNÇÕES DE INTEGRAÇÃO COM API GEMINI =====
    /**
     * Obtém uma receita da API Gemini adaptada ao nível e tempo disponível
     * @param {string} level - Nível de dificuldade da receita
     * @returns {Promise<Object>} Objeto com os dados da receita
     */
    async function getRecipeFromGemini(level) {
        // Tempo de preparação para o nível (em minutos)
        const prepTime = preparationTimes[level] || 30;
        
        // Elementos para aleatoriedade nas receitas
        const cuisineTypes = [
            "portuguesa", "italiana", "francesa", "japonesa", "mexicana", 
            "indiana", "tailandesa", "grega", "espanhola", "marroquina", 
            "brasileira", "chinesa", "alemã", "russa", "libanesa"
        ];
        
        const mealTypes = [
            "entrada", "prato principal", "sobremesa", "lanche", "bebida",
            "sopa", "salada", "pequeno-almoço", "brunch", "jantar"
        ];
        
        const dietaryOptions = [
            "", "vegetariana", "vegana", "sem glúten", "baixa em carboidratos",
            "sem lactose", "paleo", "mediterrânea"
        ];
        
        // Selecionar aleatoriamente para criar variedade
        const randomCuisine = cuisineTypes[Math.floor(Math.random() * cuisineTypes.length)];
        const randomMeal = mealTypes[Math.floor(Math.random() * mealTypes.length)];
        const randomDietary = dietaryOptions[Math.floor(Math.random() * dietaryOptions.length)];
        
        // Incluir timestamp para garantir unicidade
        const timestamp = new Date().getTime();
        
        // Ajustar maxTokens com base no nível
        let maxTokens = 1024; // Padrão para outros níveis
        if (level === 'principiante') {
            maxTokens = 1024; // Manter para principiante
        } else if (level === 'intermedio') {
            maxTokens = 2048; // Aumentar para intermédio
        } else if (level === 'avancado') {
            maxTokens = 4096; // Aumentar para avançado
        } else if (level === 'extremo') {
            maxTokens = 8192; // Aumentar significativamente tokens para o nível extremo
        }
        
        // Base do prompt com instruções de tempo específicas
        const basePrompt = `Crie uma receita culinária ${randomDietary} que possa ser completamente preparada em NO MÁXIMO ${prepTime} minutos totais. A receita deve ser adequada para o nível ${level} e pode ser uma ${randomMeal} de inspiração ${randomCuisine}.`;
        
        // Ajustar prompt com base no nível
        let prompt;
        switch(level) {
            case 'principiante':
                prompt = `${basePrompt}. Esta deve ser uma receita simples e rápida, com poucos ingredientes e passos muito simples. O tempo total de preparação e cozimento NÃO PODE exceder ${prepTime} minutos.`;
                break;
            case 'intermedio':
                prompt = `${basePrompt}. Esta deve ser uma receita de complexidade média, com técnicas moderadas. O tempo total de preparação e cozimento NÃO PODE exceder ${prepTime} minutos.`;
                break;
            case 'avancado':
                prompt = `${basePrompt}. Esta deve ser uma receita sofisticada, que exija algumas técnicas específicas, mas ainda assim realizável dentro do limite de ${prepTime} minutos de tempo total.`;
                break;
            case 'extremo':
                prompt = `${basePrompt}. Esta deve ser uma receita desafiadora com técnicas avançadas, própria de chefs profissionais, mas ainda assim completável dentro do limite de ${prepTime} minutos de tempo total.`;
                break;
        }
        
       // Adicionar instruções detalhadas para formatação e tempos
prompt += ' Por favor, formate a resposta exatamente assim:\n\n' +
          'Nome da Receita: [Apenas o nome principal da receita, sem palavras como "rápido", "fácil", "simples" , "expresso", "Desconstruído" , "Desconstruída" , "relampago" .]\n\n' +
          'Descrição: [breve descrição aqui]\n\n' +
          `Tempo Total: ${prepTime} minutos\n\n` +
          'Ingredientes:\n' +
          '200g de farinha\n' +  // Exemplo explícito 
          '2 ovos\n' +           // Exemplo explícito 
          '1 litro de leite\n' +  // Exemplo explícito 
          '[etc...]\n\n' +
          'Instruções (com tempos estimados):\n' +
          '1. Misture a farinha e o açúcar. (2 minutos)\n' +
          '2. Bata os ovos e adicione à mistura. (3 minutos)\n' +
          '3. Leve ao forno por 15 minutos. (15 minutos)\n' +
          '[etc...]\n\n' +
          'Dicas do Chef:\n' +
          '[dica 1]\n' +
          '[dica 2]\n' +
          '[etc...]\n\n' +
          'IMPORTANTE: CADA INGREDIENTE DEVE TER UMA QUANTIDADE NUMÉRICA CLARA (ex: 200g, 2 colheres, 3 unidades). CADA PASSO DEVE TER UMA ESTIMATIVA DE TEMPO ENTRE PARÊNTESES SEMPRE COLOCADA APÓS O PONTO FINAL DA INSTRUÇÃO. A receita DEVE ser completável dentro do tempo total de ' + prepTime + ' minutos. NÃO use asteriscos ou outros caracteres especiais. Todo o conteúdo deve estar em português de Portugal. NÃO INCLUA QUALQUER ID ÚNICO NO TEXTO. NÃO INCLUA INSTRUÇÕES DE LIMPEZA OU LAVAGEM DE LOUÇA NAS ETAPAS.';

        
         try {
        const response = await fetch(RECIPE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: 'Use sempre português de Portugal nas suas respostas. Você é um assistente especializado em gastronomia e gestão de tempo na cozinha.' }]
                    },
                    {
                        role: 'model',
                        parts: [{ text: 'Entendido. Sou um assistente especializado em gastronomia e gestão de tempo na cozinha. Vou responder em português de Portugal.' }]
                    },
                    {
                        role: 'user',
                        parts: [{ text: prompt }]
                    }
                ],
                generationConfig: {
                    temperature: 0.9,
                    maxOutputTokens: maxTokens,
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ]
            })
        });
        
        if (!response.ok) {
            throw new Error(`Erro na API: ${response.status}`);
        }
        
        const data = await response.json();
            
            // Verificar se temos uma resposta válida
            if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
                throw new Error("Formato de resposta inválido da API Gemini");
            }
            
            // Extrair o texto da resposta
            const textContent = data.candidates[0].content.parts[0].text.trim();

            // Processar o texto para extrair as informações da receita
            return processRecipeText(textContent, level);
            
        } catch (error) {
            console.error("Erro ao obter receita:", error);
            return retryGetRecipe(level);
        }
    }

    async function retryGetRecipe(level) {
        const prepTime = preparationTimes[level] || 30;
        try {
            const response = await fetch(RECIPE_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        role: 'user',
                        parts: [{ text: `Crie uma receita simples de nível ${level} em ${prepTime} minutos. Formato: Nome da Receita, Descrição, Tempo Total: ${prepTime} minutos, Ingredientes, Instruções, Dicas do Chef.` }]
                    }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
                })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                return processRecipeText(data.candidates[0].content.parts[0].text.trim(), level);
            }
        } catch (retryError) {
            console.error("Erro na segunda tentativa:", retryError);
        }
        return createBasicRecipe(level);
    }

    /**
     * Cria uma receita básica em caso de falha total da API
     * @param {string} level - Nível de dificuldade da receita
     * @returns {Object} Objeto com os dados da receita básica
     */
    function createBasicRecipe(level) {
        const prepTime = preparationTimes[level] || 30;
        const levelNames = {
            'principiante': 'Principiante',
            'intermedio': 'Intermédio',
            'avancado': 'Avançado',
            'extremo': 'Extremo'
        };
        
        // Receita básica com quantidades numéricas claras e tempos de preparo
        return {
            name: `Desafio de Culinária - Nível ${levelNames[level] || level}`,
            description: "Uma receita simples para salvar o dia.",
            totalTime: prepTime,
            ingredients: [
                "200g de farinha",
                "2 ovos",
                "100ml de leite",
                "50g de manteiga",
                "1 colher de sopa de açúcar",
                "1 pitada de sal"
            ],
            instructions: [
                "Misture todos os ingredientes secos numa tigela. (3 minutos)",
                "Adicione os ingredientes líquidos e misture bem. (2 minutos)",
                `Cozinhe conforme desejado. (${Math.floor(prepTime/2)} minutos)`,
                `Deixe arrefecer antes de servir. (${Math.floor(prepTime/4)} minutos)`
            ],
            tips: ["Adapte os ingredientes ao seu gosto pessoal.", 
                  "Organize todos os ingredientes antes de começar para poupar tempo."]
        };
    }
    


function extractIngredients(text) {
    const match = text.match(/Ingredientes:\s*([\s\S]*?)(?=\n(?:Instruções|Instruções \(com tempos estimados\)|Dicas|$))/i);
    if (!match) return [];
    let block = match[1].trim();

    // Divide por linhas, remove vazias
    let lines = block.split('\n').map(l => l.trim()).filter(Boolean);

    // Array para armazenar ingredientes processados
    let ingredients = [];
    let currentCategory = null;

    // Processa cada linha
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Verifica se é uma categoria (começa com "Para" e termina com ":")
        if (/^para\s+[^:]+:/i.test(line)) {
            currentCategory = line;
            // Adiciona apenas uma vez com o marcador
            ingredients.push(`__CATEGORY__${line}`);
        } 
        // Se não é categoria e contém números (é um ingrediente)
        else if (/\d/.test(line) && !line.startsWith('__CATEGORY__')) {
            ingredients.push(line);
        }
    }

    return ingredients;
}




function displayIngredients(recipe) {
    const ingredientsList = document.createElement('ul');
    ingredientsList.className = 'ingredients-list';

    if (Array.isArray(recipe.ingredients)) {
        recipe.ingredients.forEach((ingredient) => {
            if (ingredient && ingredient.trim()) {
                if (ingredient.startsWith('__CATEGORY__')) {
                    // Remove o marcador e quaisquer espaços extras
                    const categoryName = ingredient.replace('__CATEGORY__', '').trim();
                    
                    // Cria o elemento da categoria com estilo específico
                    const categoryItem = document.createElement('li');
                    categoryItem.className = 'ingredient-category';
                    categoryItem.style.fontWeight = 'bold';
                    categoryItem.style.fontSize = '1.1em';
                    // Removido a cor laranja, apenas negrito
                    categoryItem.style.color = '#333';
                    categoryItem.style.listStyleType = 'none';
                    categoryItem.style.marginTop = '20px';
                    categoryItem.style.marginBottom = '10px';
                    categoryItem.textContent = categoryName;
                    
                    ingredientsList.appendChild(categoryItem);
                } else {
                    // Ingrediente normal
                    const item = document.createElement('li');
                    item.style.marginLeft = '20px';
                    item.style.marginBottom = '5px';
                    item.textContent = ingredient.trim();
                    ingredientsList.appendChild(item);
                }
            }
        });
    }

    return ingredientsList;
}





function processRecipeText(text, level) {

    // Objeto para armazenar a receita processada
    let recipe = {
        name: "Receita de " + level.charAt(0).toUpperCase() + level.slice(1),
        description: "Uma deliciosa receita para o seu nível.",
        totalTime: preparationTimes[level] || 30, // Valor padrão do tempo total
        ingredients: [],
        instructions: [],
        tips: []
    };

    // Normalizar quebras de linha para consistência
    text = text.replace(/\r\n/g, '\n');

    // Remover asteriscos ou outros caracteres de formatação
    text = text.replace(/\*/g, '');

    // Remover qualquer menção a "ID Único" ou "ID único"
    text = text.replace(/ID [Úú]nico:?\s*\d+/gi, '');

    // Nome da receita
    const nameMatch = text.match(/Nome da Receita:[\s]*([\s\S]*?)(?=\n\s*\n|\n(?=Descrição:|$))/i);
    if (nameMatch && nameMatch[1]) {
        recipe.name = nameMatch[1].trim();
    }

    // Descrição
    const descMatch = text.match(/Descrição:[\s]*([\s\S]*?)(?=\n\s*\n|\n(?=Tempo Total:|Ingredientes:|$))/i);
    if (descMatch && descMatch[1]) {
        recipe.description = descMatch[1].trim().replace(/\n/g, ' ');
    }

    // Tempo Total (nova extração)
    const timeMatch = text.match(/Tempo Total:[\s]*(\d+)[\s]*minutos/i);
    if (timeMatch && timeMatch[1]) {
        recipe.totalTime = parseInt(timeMatch[1]);
    }

    // ===== NOVA EXTRAÇÃO DE INGREDIENTES =====
    try {
        recipe.ingredients = extractIngredients(text);

        // Se não encontrou nada, usa ingredientes padrão
        if (!recipe.ingredients || recipe.ingredients.length === 0) {
            recipe.ingredients = [
                "200g de farinha",
                "2 ovos",
                "100ml de leite",
                "50g de manteiga",
                "1 colher de sopa de açúcar",
                "1 pitada de sal"
            ];
        }
    } catch (error) {
        console.error("Erro ao extrair ingredientes:", error);
        recipe.ingredients = [
            "200g de farinha",
            "2 ovos",
            "100ml de leite",
            "50g de manteiga",
            "1 colher de sopa de açúcar",
            "1 pitada de sal"
        ];
    }

    // ===== INSTRUÇÕES (regex melhorado) =====
    const instrMatch = text.match(/Instruções(?:\s*\(com tempos estimados\))?:[\s]*([\s\S]*?)(?=\n\s*\n|\n(?=Dicas|$))/i);
    if (instrMatch && instrMatch[1]) {
        let instructionsText = instrMatch[1].trim();
        recipe.instructions = instructionsText.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            // Remover apenas marcadores de lista claros, preservando tempos entre parênteses
            .map(line => line.replace(/^[-•*]\s*/, ''))    // Remove apenas marcadores de tipo bullet
            .map(line => line.replace(/^(\d+)[\.\)][\s]+/, '')) // Remove apenas números seguidos de ponto/parêntese E espaço
            // Filtrar instruções de limpeza
            .filter(line => !(/limp[ae]r?|lav[ae]r?/i.test(line)));

        // Corrigir instruções para garantir tempos consistentes após o ponto final
        recipe.instructions = recipe.instructions.map(instruction => {
            // Verificar se já tem tempo explícito entre parênteses (minutos, min, segundos, seg, horas, h)
            const timeMatch = instruction.match(/\((\d+(\s*-\s*\d+)?)[\s]*(minutos?|mins?|m|segundos?|segs?|seg|horas?|hrs?|h)\)/i);

            // Se já tem tempo explícito, NÃO mexer na instrução!
            if (timeMatch) {
                               // Opcional: garantir que termina com ponto antes do tempo
                const parts = instruction.split(/\s*\(\d+(\s*-\s*\d+)?[\s]*(minutos?|mins?|m|segundos?|segs?|seg|horas?|hrs?|h)\)/i);
                if (parts[0].trim().endsWith('.')) {
                    return instruction;
                } else {
                    // Adicionar o ponto antes do tempo
                    // Recuperar o texto do tempo original
                    const tempoTexto = instruction.match(/\(\d+(\s*-\s*\d+)?[\s]*(minutos?|mins?|m|segundos?|segs?|seg|horas?|hrs?|h)\)/i)[0];
                    return `${parts[0].trim()}. ${tempoTexto}`;
                }
            } else {
                // Se não tiver tempo, adicionar um tempo padrão
                if (instruction.trim().endsWith('.')) {
                    return `${instruction} (2 minutos)`;
                } else {
                    return `${instruction}. (2 minutos)`;
                }
            }
        });
    }

    // Dicas
    const tipsMatch = text.match(/Dicas do Chef:[\s]*([\s\S]*?)(?=$)/i);
    if (tipsMatch && tipsMatch[1]) {
        let tipsText = tipsMatch[1].trim();
        recipe.tips = tipsText.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            // Remover numeração ou marcadores no início
            .map(line => line.replace(/^[\d\.\)]+\s*/, ''))
            .map(line => line.replace(/^[-•*]\s*/, ''))
            // Remover qualquer menção a ID único
            .map(line => line.replace(/ID [Úú]nico:?\s*\d+/gi, '').trim())
            .filter(line => line.length > 0); // Remover linhas que ficaram vazias
    }

    // Verificações finais e valores padrão
    if (recipe.instructions.length === 0) {
        recipe.instructions = ["Misture todos os ingredientes e siga conforme a sua preferência. (10 minutos)"];
    }

    if (recipe.tips.length === 0) {
        recipe.tips = ["Adapte esta receita ao seu gosto pessoal."];
    }

    return recipe;
}

    // ===== FUNÇÕES DE INTERFACE DO UTILIZADOR =====
    /**
     * Inicia contagem regressiva e apresenta o desafio
     * @param {string} level - Nível de dificuldade do desafio
     */
    async function startChallenge(level) {
        // Limpar o conteúdo atual
        mainContainer.innerHTML = '';
        
        // Criar elementos para a contagem regressiva
        const countdownContainer = document.createElement('div');
        countdownContainer.className = 'countdown-container';
        
        const countdownText = document.createElement('h2');
        countdownText.className = 'countdown-text gradient-text';
        countdownText.textContent = 'O seu desafio começa em';
        
        const countdownNumber = document.createElement('div');
        countdownNumber.className = 'countdown-number';
        countdownNumber.textContent = '5';
        
        const preparingText = document.createElement('h3');
        preparingText.className = 'preparing-text';
        preparingText.textContent = 'Prepare-se...';
        
        // Adicionar elementos ao container
        countdownContainer.appendChild(countdownText);
        countdownContainer.appendChild(countdownNumber);
        countdownContainer.appendChild(preparingText);
        mainContainer.appendChild(countdownContainer);
        
        // Iniciar contagem regressiva e buscar a receita simultaneamente
        let count = 5;
        let recipe = null;
        
        // Adicionar indicador de carregamento
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.innerHTML = '<span>A carregar a sua receita</span><span class="dots">...</span>';
        countdownContainer.appendChild(loadingIndicator);
        
        // Animação para os pontos de carregamento
        let dotsCount = 0;
        const dotsInterval = setInterval(() => {
            dotsCount = (dotsCount + 1) % 4;
            const dots = '.'.repeat(dotsCount);
            document.querySelector('.dots').textContent = dots;
        }, 500);
        
        // Iniciar a busca da receita na API enquanto a contagem regressiva acontece
        const recipePromise = getRecipeFromGemini(level);
        
        const countdownInterval = setInterval(() => {
            count--;
            countdownNumber.textContent = count;
            
            if (count === 0) {
                clearInterval(countdownInterval);
                clearInterval(dotsInterval);
                
                // Adicionar classe para animação de fade-out
                countdownContainer.classList.add('fade-out');
                
                // Após a animação de fade-out, mostrar a receita
                setTimeout(async () => {
                    // Aguardar a receita se ainda não estiver pronta
                    if (!recipe) {
                        try {
                            recipe = await recipePromise;
                        } catch (error) {
                            console.error("Erro ao aguardar a receita:", error);
                            recipe = createBasicRecipe(level);
                        }
                    }
                    showRecipe(level, recipe);
                }, 1000);
            }
        }, 1000);
        
        // Esperar pela receita
        try {
            recipe = await recipePromise;
        } catch (error) {
            console.error("Erro ao buscar a receita:", error);
            recipe = createBasicRecipe(level);
        }
    }
    
    /**
     * Exibe a receita e adiciona barra de progresso
     * @param {string} level - Nível de dificuldade
     * @param {Object} recipe - Objeto com dados da receita
     */
    function showRecipe(level, recipe) {
        // Limpar o container e qualquer timer anterior
        mainContainer.innerHTML = '';
        if (timerInterval) {
            clearInterval(timerInterval);
        }
        
        // Resetar o estado de pausa
        isPaused = false;
        
        // Criar container da receita
        const recipeContainer = document.createElement('div');
        recipeContainer.className = 'recipe-container fade-in';
        
        // Título e descrição
        const recipeHeader = document.createElement('div');
        recipeHeader.className = 'recipe-header';
        
        const recipeTitle = document.createElement('h2');
        recipeTitle.className = 'recipe-title gradient-text';
        recipeTitle.textContent = recipe.name;
        
        const recipeLevel = document.createElement('div');
        recipeLevel.className = `recipe-level ${level}`;
        recipeLevel.textContent = level.charAt(0).toUpperCase() + level.slice(1);
        
        const recipeDescription = document.createElement('p');
        recipeDescription.className = 'recipe-description';
        recipeDescription.textContent = recipe.description;
        
        recipeHeader.appendChild(recipeTitle);
        recipeHeader.appendChild(recipeLevel);
        recipeHeader.appendChild(recipeDescription);
        
        // Barra de progresso de tempo com botão de pausa estilizado
        const progressSection = document.createElement('div');
        progressSection.className = 'recipe-progress-section';
        progressSection.style.position = 'relative'; // Para posicionamento absoluto do botão de pausa
        
        const progressLabel = document.createElement('div');
        progressLabel.className = 'progress-label';
        progressLabel.textContent = 'Tempo Restante';
        
        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-container';
        
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        progressBar.id = 'recipe-progress';
        
        const progressControls = document.createElement('div');
        progressControls.className = 'progress-controls';
        progressControls.style.display = 'flex';
        progressControls.style.alignItems = 'center';
        progressControls.style.justifyContent = 'center';
        
        const progressTime = document.createElement('div');
        progressTime.className = 'progress-time';
        progressTime.id = 'recipe-time';
        
        // Botão de pausa redesenhado e posicionado no canto superior direito
        const pauseButton = document.createElement('button');
        pauseButton.className = 'pause-button';
        pauseButton.id = 'pause-button';
        pauseButton.style.position = 'absolute';
        pauseButton.style.top = '0';
        pauseButton.style.right = '0';
        pauseButton.style.width = '36px';
        pauseButton.style.height = '36px';
        pauseButton.style.borderRadius = '50%';
        pauseButton.style.backgroundColor = '#f39c12';
        pauseButton.style.border = 'none';
        pauseButton.style.boxShadow = '0 3px 6px rgba(0,0,0,0.2)';
        pauseButton.style.cursor = 'pointer';
        pauseButton.style.transition = 'all 0.3s ease';
        pauseButton.style.display = 'flex';
        pauseButton.style.justifyContent = 'center';
        pauseButton.style.alignItems = 'center';
        pauseButton.style.zIndex = '10';
        
        // Adicionar estilos de hover
        pauseButton.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.1)';
            this.style.boxShadow = '0 5px 10px rgba(0,0,0,0.25)';
        });
        
        pauseButton.addEventListener('mouseleave', function() {
            this.style.transform = '';
            this.style.boxShadow = '0 3px 6px rgba(0,0,0,0.2)';
        });
        
        // Ícone do botão de pausa com posicionamento aprimorado
        const iconStyle = document.createElement('style');
        iconStyle.textContent = `
            #pause-button i {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 16px;
                color: white;
            }
            
            #pause-button .fa-play {
                transform: translate(-40%, -50%); /* Ajuste específico para o ícone de play */
            }
        `;
        document.head.appendChild(iconStyle);
        
        // Adicionar o ícone de pausa inicial
        pauseButton.innerHTML = '<i class="fas fa-pause"></i>';
        
        // Tempo em minutos conforme o nível ou a receita
        const prepTime = recipe.totalTime || preparationTimes[level] || 30;
        let remainingSeconds = prepTime * 60;
    
        // Armazenar o tempo total para uso consistente
        originalTotalTimeInSeconds = remainingSeconds;
        
        // Formatar o tempo inicial em formato hh:mm:ss
        const formattedTime = formatTime(remainingSeconds);
        progressTime.textContent = formattedTime;
        
        // Montar a seção de progresso com botão de pausa
        progressContainer.appendChild(progressBar);
        progressControls.appendChild(progressTime);
        progressSection.appendChild(progressLabel);
        progressSection.appendChild(progressContainer);
        progressSection.appendChild(progressControls);
        progressSection.appendChild(pauseButton); // Adicionar botão de pausa ao section
        
        // Adicionar o link para Font Awesome caso não exista
        if (!document.getElementById('font-awesome-link')) {
            const fontAwesomeLink = document.createElement('link');
            fontAwesomeLink.id = 'font-awesome-link';
            fontAwesomeLink.rel = 'stylesheet';
            fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
            document.head.appendChild(fontAwesomeLink);
        }
        
    // Seção de ingredientes
const ingredientsSection = document.createElement('div');
ingredientsSection.className = 'recipe-section';

const ingredientsTitle = document.createElement('h3');
ingredientsTitle.className = 'section-title shadow-pulse';
ingredientsTitle.textContent = 'Ingredientes';

// Obter a lista processada de ingredientes
const ingredientsList = displayIngredients(recipe);

ingredientsSection.appendChild(ingredientsTitle);
ingredientsSection.appendChild(ingredientsList);

        // Instruções com tempos destacados
        const instructionsSection = document.createElement('div');
        instructionsSection.className = 'recipe-section';
        
        const instructionsTitle = document.createElement('h3');
        instructionsTitle.className = 'section-title shadow-pulse';
        instructionsTitle.textContent = 'Instruções';
        
        const instructionsList = document.createElement('ol');
        instructionsList.className = 'instructions-list';
        
        // Renderização das instruções com tempos destacados
        if (Array.isArray(recipe.instructions)) {
            recipe.instructions.forEach(instruction => {
                if (instruction && instruction.trim()) {
                    const item = document.createElement('li');
                    
                    // Procurar por tempos entre parênteses: (X minutos) ou (X min)
                    const timeMatch = instruction.match(/\((\d+)[\s]*(minutos?|mins?|m)\)/i);
                    
                    if (timeMatch) {
                        // Separar a instrução do tempo
                        const textPart = instruction.replace(/\(\d+[\s]*(minutos?|mins?|m)\)/i, '').trim();
                        const timePart = timeMatch[0];
                        
                        // Criar span para texto principal
                        const textSpan = document.createElement('span');
                        textSpan.textContent = textPart + ' ';
                        
                        // Criar span para o tempo com estilo
                        const timeSpan = document.createElement('span');
                        timeSpan.className = 'instruction-time';
                        timeSpan.textContent = timePart;
                        timeSpan.style.fontSize = '0.9em';
                        timeSpan.style.color = '#ff6d00';
                        timeSpan.style.fontWeight = 'bold';
                        
                        // Adicionar ambos ao item
                        item.appendChild(textSpan);
                        item.appendChild(timeSpan);
                    } else {
                        // Se não houver tempo explícito, mostrar apenas a instrução
                        item.textContent = instruction.trim();
                    }
                    
                    instructionsList.appendChild(item);
                }
            });
        } else if (typeof recipe.instructions === 'string') {
            // Se for uma string, dividir por linhas
            const instructions = recipe.instructions.split('\n');
            instructions.forEach(instruction => {
                if (instruction && instruction.trim()) {
                    const item = document.createElement('li');
                    
                    // Mesmo processamento de tempo para cada linha
                    const timeMatch = instruction.match(/\((\d+)[\s]*(minutos?|mins?|m)\)/i);
                    
                    if (timeMatch) {
                        // Separar a instrução do tempo
                        const textPart = instruction.replace(/\(\d+[\s]*(minutos?|mins?|m)\)/i, '').trim();
                        const timePart = timeMatch[0];
                        
                        // Criar span para texto principal
                        const textSpan = document.createElement('span');
                        textSpan.textContent = textPart + ' ';
                        
                        // Criar span para o tempo com estilo
                        const timeSpan = document.createElement('span');
                        timeSpan.className = 'instruction-time';
                        timeSpan.textContent = timePart;
                        timeSpan.style.fontSize = '0.9em';
                        timeSpan.style.color = '#ff6d00';
                        timeSpan.style.fontWeight = 'bold';
                        
                        // Adicionar ambos ao item
                        item.appendChild(textSpan);
                        item.appendChild(timeSpan);
                    } else {
                        // Se não houver tempo explícito, mostrar apenas a instrução
                        item.textContent = instruction.trim();
                    }
                    
                    instructionsList.appendChild(item);
                }
            });
        }
        
        instructionsSection.appendChild(instructionsTitle);
        instructionsSection.appendChild(instructionsList);
        
        // Dicas do Chef
        const tipsSection = document.createElement('div');
        tipsSection.className = 'recipe-section tips-section';
        
        const tipsTitle = document.createElement('h3');
        tipsTitle.className = 'section-title shadow-pulse';
        tipsTitle.textContent = 'Dicas do Chef';
        
        const tipsList = document.createElement('ul');
        tipsList.className = 'tips-list';
        
        // Renderização das dicas
        if (Array.isArray(recipe.tips) && recipe.tips.length > 0) {
            recipe.tips.forEach(tip => {
                if (tip && tip.trim()) {
                    const item = document.createElement('li');
                    item.className = 'tip-item';
                    item.textContent = tip.trim();
                    tipsList.appendChild(item);
                }
            });
        } else if (typeof recipe.tips === 'string') {
            // Se for uma string, tentar dividir em tópicos
            const tips = recipe.tips.split('\n');
            if (tips.length > 1) {
                // Se tiver múltiplas linhas, tratar cada linha como um tópico
                tips.forEach(tip => {
                    if (tip && tip.trim()) {
                        const item = document.createElement('li');
                        item.className = 'tip-item';
                        item.textContent = tip.trim();
                        tipsList.appendChild(item);
                    }
                });
            } else {
                // Se for um texto único, adicionar como um único item
                const item = document.createElement('li');
                item.className = 'tip-item';
                item.textContent = recipe.tips;
                tipsList.appendChild(item);
            }
        }
        
        tipsSection.appendChild(tipsTitle);
        tipsSection.appendChild(tipsList);
        
        // Botão "Terminei Desafio" padronizado
        const finishButton = document.createElement('button');
        finishButton.className = 'finish-challenge-button standardized-button';
        finishButton.textContent = 'Terminei Desafio';
        finishButton.addEventListener('click', function() {
            // Adicionar efeito de clique
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
                
                // Mostrar diálogo de confirmação
                showConfirmDialog(
                    'Finalizar Desafio', 
                    'Tem certeza que finalizou o desafio culinário?', 
                    () => {
                        // Parar o timer
                        if (timerInterval) {
                            clearInterval(timerInterval);
                        }
                        // Mostrar tela de parabéns
                        showCongratulations(level, true);
                    }
                );
            }, 200);
        });
        
        // Botões de ação padronizados
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'recipe-buttons';
        
        const newRecipeButton = document.createElement('button');
        newRecipeButton.className = 'new-recipe-button standardized-button';
        newRecipeButton.textContent = 'Nova Receita';
        newRecipeButton.addEventListener('click', function() {
            // Adicionar efeito de clique
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
                
                // Mostrar diálogo de confirmação
                showConfirmDialog(
                    'Nova Receita', 
                    'Tem certeza que deseja gerar uma nova receita?', 
                    () => {
                        // Parar o timer atual
                        if (timerInterval) {
                            clearInterval(timerInterval);
                        }
                        startChallenge(level);
                    }
                );
            }, 200);
        });
        
        const backButton = document.createElement('button');
        backButton.className = 'back-button standardized-button';
        backButton.textContent = 'Voltar';
        backButton.addEventListener('click', function() {
            // Adicionar efeito de clique
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
                
                // Mostrar diálogo de confirmação
                showConfirmDialog(
                    'Voltar', 
                    'Tem certeza que deseja voltar à página inicial? Seu progresso será perdido.', 
                    () => {
                        // Parar o timer atual
                        if (timerInterval) {
                            clearInterval(timerInterval);
                        }
                        // Voltar para a tela inicial
                        location.reload();
                    }
                );
            }, 200);
        });
        
        // Adicionar todos os botões ao container
        buttonsContainer.appendChild(finishButton);
        buttonsContainer.appendChild(newRecipeButton);
        buttonsContainer.appendChild(backButton);
        
        // Montar a receita completa
        recipeContainer.appendChild(recipeHeader);
        recipeContainer.appendChild(progressSection);
        recipeContainer.appendChild(ingredientsSection);
        recipeContainer.appendChild(instructionsSection);
        recipeContainer.appendChild(tipsSection);
        recipeContainer.appendChild(buttonsContainer);
        
        // Adicionar ao container principal
        mainContainer.appendChild(recipeContainer);
        
        // Ativar animação de fade-in após um pequeno delay
        setTimeout(() => {
            recipeContainer.classList.add('active');
        }, 100);
        
        // Iniciar o timer para a barra de progresso com o tempo total explícito
        startRecipeTimer(remainingSeconds, originalTotalTimeInSeconds);
        
        // Adicionar evento ao botão de pausa
        pauseButton.addEventListener('click', function() {
            togglePauseTimer();
        });
    }

    
    /**
     * Formata o tempo em hh:mm:ss ou mm:ss
     * @param {number} totalSeconds - Total de segundos a formatar
     * @returns {string} Tempo formatado
     */
    function formatTime(totalSeconds) {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        // Formatar com zeros à esquerda quando necessário
        if (hours > 0) {
            return `${hours}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        } else {
            return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        }
    }
    
    /**
     * Alterna entre pausar e continuar o timer
     */
    function togglePauseTimer() {
        const pauseButton = document.getElementById('pause-button');
        const progressContainer = document.querySelector('.progress-container');
        const progressBar = document.getElementById('recipe-progress');
        
        if (isPaused) {
            // Retomar o timer
            isPaused = false;
            pauseButton.innerHTML = '<i class="fas fa-pause"></i>';
            pauseButton.style.backgroundColor = '#f39c12';
            
            // Remover efeito de pausa do container
            progressContainer.classList.remove('paused-progress');
            progressBar.classList.remove('paused-bar');
            
            // Importante: Usar o mesmo tempo total que foi usado inicialmente
            startRecipeTimer(remainingTimeAtPause, originalTotalTimeInSeconds, true);
        } else {
            // Pausar o timer
            isPaused = true;
            pauseButton.innerHTML = '<i class="fas fa-play"></i>';
            pauseButton.style.backgroundColor = '#4caf50';
            
            // Adicionar efeito visual de pausa ao container
            progressContainer.classList.add('paused-progress');
            progressBar.classList.add('paused-bar');
            
            // Salvar o tempo restante atual
            const timeDisplay = document.getElementById('recipe-time');
            const timeParts = timeDisplay.textContent.split(':');
            
            // Calcular segundos totais restantes com base no formato exibido
            if (timeParts.length === 3) {
                // Formato hh:mm:ss
                remainingTimeAtPause = parseInt(timeParts[0]) * 3600 + parseInt(timeParts[1]) * 60 + parseInt(timeParts[2]);
            } else {
                // Formato mm:ss
                remainingTimeAtPause = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]);
            }
            
            // Parar o timer
            if (timerInterval) {
                clearInterval(timerInterval);
            }
        }
    }
    
    /**
     * Inicia o timer da receita com barra de progresso
     * @param {number} remainingSeconds - Segundos restantes
     * @param {number} totalTime - Tempo total em segundos
     * @param {boolean} isResuming - Indica se está retomando um timer pausado
     */
    function startRecipeTimer(remainingSeconds, totalTime, isResuming = false) {
        // Obter elementos
        const progressBar = document.getElementById('recipe-progress');
        const timeDisplay = document.getElementById('recipe-time');
        
        // Se não estiver retomando, determinar e armazenar o tempo total original
        if (!isResuming) {
            // Se totalTime for nulo, obter do nível
            if (totalTime === null || totalTime === undefined) {
                const level = document.querySelector('.recipe-level').textContent.toLowerCase();
                originalTotalTimeInSeconds = preparationTimes[level] * 60; // Converter para segundos
            } else {
                // Se for fornecido em minutos (valor pequeno), converter para segundos
                originalTotalTimeInSeconds = totalTime <= 100 ? totalTime * 60 : totalTime;
            }
            
            // Garantir que o tempo restante inicial seja igual ao tempo total
            remainingSeconds = originalTotalTimeInSeconds;
        }
        
        // Limpar intervalo anterior se existir
        if (timerInterval) {
            clearInterval(timerInterval);
        }
        
        // Calcular a porcentagem atual com base no tempo original
        const currentPercentage = Math.min(100, Math.max(0, (remainingSeconds / originalTotalTimeInSeconds) * 100));
        
        // Definir largura da barra de progresso
        progressBar.style.width = currentPercentage + '%';
        
        // Atualizar exibição inicial
        timeDisplay.textContent = formatTime(remainingSeconds);
        
        // Atualizar a cada segundo
        timerInterval = setInterval(() => {
            // Se estiver pausado, não fazer nada
            if (isPaused) return;
            
            // Reduzir tempo restante
            remainingSeconds--;
            
            // Atualizar display de tempo no formato hh:mm:ss
            timeDisplay.textContent = formatTime(remainingSeconds);
            
            // Atualizar barra de progresso com base no tempo total original
            const percentage = Math.min(100, Math.max(0, (remainingSeconds / originalTotalTimeInSeconds) * 100));
            progressBar.style.width = percentage + '%';
            
            // Mudar cor conforme o tempo diminui
            if (percentage <= 25) {
                progressBar.style.backgroundColor = '#e74c3c'; // Vermelho (crítico)
            } else if (percentage <= 50) {
                progressBar.style.backgroundColor = '#f39c12'; // Amarelo (aviso)
            }
            
            // Verificar se o tempo acabou
            if (remainingSeconds <= 0) {
                clearInterval(timerInterval);
                showCongratulations(document.querySelector('.recipe-level').textContent.toLowerCase(), false);
            }
        }, 1000);
    }
    
    /**
     * Exibe a tela de parabéns ou tempo esgotado
     * @param {string} level - Nível de dificuldade
     * @param {boolean} completed - Indica se o desafio foi completado com sucesso
     */
    function showCongratulations(level, completed) {
        // Limpar o container principal e qualquer timer anterior
        mainContainer.innerHTML = '';
        if (timerInterval) {
            clearInterval(timerInterval);
        }
        
        // Adicionar o link para Font Awesome para os ícones (se não existir)
        if (!document.getElementById('font-awesome-link')) {
            const fontAwesomeLink = document.createElement('link');
            fontAwesomeLink.id = 'font-awesome-link';
            fontAwesomeLink.rel = 'stylesheet';
            fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
            document.head.appendChild(fontAwesomeLink);
        }
        
        // Adicionar o script do dotlottie-player se não existir
        if (!document.getElementById('dotlottie-player-script')) {
            const lottieScript = document.createElement('script');
            lottieScript.id = 'dotlottie-player-script';
            lottieScript.src = 'https://unpkg.com/@dotlottie/player-component@2.7.12/dist/dotlottie-player.mjs';
            lottieScript.type = 'module';
            document.head.appendChild(lottieScript);
        }
        
        // Criar container para mensagem com design elegante
        const congratsContainer = document.createElement('div');
        congratsContainer.className = 'congrats-container fade-in';
        congratsContainer.style.position = 'relative';
        congratsContainer.style.width = '100%';
        congratsContainer.style.maxWidth = '800px';
        congratsContainer.style.margin = '0 auto';
        congratsContainer.style.padding = '30px';
        congratsContainer.style.backgroundColor = '#ffffff';
        congratsContainer.style.borderRadius = '15px';
        congratsContainer.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.1)';
        congratsContainer.style.textAlign = 'center';
        congratsContainer.style.overflow = 'hidden';
        congratsContainer.style.animation = 'fadeIn 0.7s ease-out forwards';
        
        // Estilos de animação básicos
        const animationStyles = document.createElement('style');
        animationStyles.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(animationStyles);
        
        // Título com estilo padrão anterior
        const congratsTitle = document.createElement('h2');
        congratsTitle.className = completed ? 'congrats-title gradient-text' : 'timeout-title gradient-text';
        congratsTitle.style.fontSize = '2.5rem';
        congratsTitle.style.fontWeight = 'bold';
        congratsTitle.style.marginBottom = '20px';
        congratsTitle.style.position = 'relative';
        congratsTitle.style.zIndex = '2';
        
        // Mensagem com estilo elegante
        const congratsMessage = document.createElement('p');
        congratsMessage.className = 'congrats-message';
        congratsMessage.style.fontSize = '1.1rem';
        congratsMessage.style.lineHeight = '1.6';
        congratsMessage.style.margin = '0 auto 30px';
        congratsMessage.style.maxWidth = '600px';
        congratsMessage.style.color = '#555';
        
        if (completed) {
            // Container para animação Lottie com posicionamento ajustado
            const lottieContainer = document.createElement('div');
            lottieContainer.style.margin = '15px auto 35px';
            lottieContainer.style.display = 'flex';
            lottieContainer.style.justifyContent = 'center';
            lottieContainer.style.alignItems = 'center';
            
            // Criando um wrapper para a animação que permite movê-la para a direita
            const lottieWrapper = document.createElement('div');
            lottieWrapper.style.marginLeft = '65px'; // Move 65px para a direita
            lottieWrapper.style.width = '300px';
            lottieWrapper.style.height = '300px';

            // Criar o elemento dotlottie-player usando DOM API para evitar XSS
            const lottiePlayer = document.createElement('dotlottie-player');
            lottiePlayer.setAttribute('src', 'https://lottie.host/15d4805b-6402-467a-9d06-76db89c1c9aa/jA93Oi7HJN.lottie');
            lottiePlayer.setAttribute('background', 'transparent');
            lottiePlayer.setAttribute('speed', '1');
            lottiePlayer.setAttribute('loop', '');
            lottiePlayer.setAttribute('autoplay', '');
            lottiePlayer.style.width = '100%';
            lottiePlayer.style.height = '100%';
            lottieWrapper.appendChild(lottiePlayer);

            lottieContainer.appendChild(lottieWrapper);

            congratsTitle.textContent = 'Parabéns! Desafio Concluído!';
            congratsMessage.textContent = '';
            const congratsHtml = sanitizeHtml(
                'Você completou o desafio culinário de nível ' +
                (level.charAt(0).toUpperCase() + level.slice(1)) +
                '! O seu prato certamente ficou delicioso.<br><br>👨‍🍳 Você é um verdadeiro chef! 👨‍🍳'
            );
            congratsMessage.insertAdjacentHTML('beforeend', congratsHtml);

            congratsContainer.appendChild(congratsTitle);
            congratsContainer.appendChild(lottieContainer);
            congratsContainer.appendChild(congratsMessage);
            
        } else {
            // Container para relógio elegante
            const timeoutContainer = document.createElement('div');
            timeoutContainer.style.position = 'relative';
            timeoutContainer.style.width = '150px';
            timeoutContainer.style.height = '150px';
            timeoutContainer.style.margin = '15px auto 25px';
            timeoutContainer.style.display = 'flex';
            timeoutContainer.style.justifyContent = 'center';
            timeoutContainer.style.alignItems = 'center';
            
            // Círculo de fundo para o relógio
            const clockBackground = document.createElement('div');
            clockBackground.style.position = 'absolute';
            clockBackground.style.width = '100px';
            clockBackground.style.height = '100px';
            clockBackground.style.borderRadius = '50%';
            clockBackground.style.background = 'radial-gradient(circle, rgba(244,67,54,0.1) 30%, rgba(244,67,54,0) 70%)';
            timeoutContainer.appendChild(clockBackground);
            
            // Ícone do relógio com estilo elegante
            const clockIcon = document.createElement('div');
            clockIcon.className = 'clock-icon';
            clockIcon.innerHTML = '<i class="fas fa-clock"></i>';
            clockIcon.style.fontSize = '60px';
            clockIcon.style.color = '#f44336';
            clockIcon.style.opacity = '0.9';
            clockIcon.style.position = 'relative';
            clockIcon.style.zIndex = '2';
            timeoutContainer.appendChild(clockIcon);
            
            congratsTitle.textContent = 'Tempo Esgotado!';
            congratsMessage.textContent = 'O tempo para completar o desafio terminou, mas não desanime! Algumas das melhores criações culinárias exigem tempo.';
            const timeoutHtml = sanitizeHtml('<br><br>⏰ Tente novamente quando estiver pronto! ⏰');
            congratsMessage.insertAdjacentHTML('beforeend', timeoutHtml);

            congratsContainer.appendChild(congratsTitle);
            congratsContainer.appendChild(timeoutContainer);
            congratsContainer.appendChild(congratsMessage);
        }
        
        // Botões com estilo elegante
        const congratsButtons = document.createElement('div');
        congratsButtons.className = 'congrats-buttons';
        congratsButtons.style.marginTop = '30px';
        
        const newChallengeButton = document.createElement('button');
        newChallengeButton.className = 'standardized-button';
        newChallengeButton.textContent = 'Novo Desafio';
        newChallengeButton.style.padding = '12px 30px';
        newChallengeButton.style.fontSize = '1.1rem';
        newChallengeButton.style.backgroundColor = completed ? '#4CAF50' : '#2196F3';
        newChallengeButton.style.color = 'white';
        newChallengeButton.style.border = 'none';
        newChallengeButton.style.borderRadius = '30px';
        newChallengeButton.style.cursor = 'pointer';
        newChallengeButton.style.boxShadow = '0 3px 5px rgba(0,0,0,0.2)';
        newChallengeButton.style.transition = 'all 0.3s ease';
        
        // Botão para voltar ao menu de receitas
        const returnMenuButton = document.createElement('button');
        returnMenuButton.className = 'standardized-button';
        returnMenuButton.textContent = 'Menu de Receitas';
        returnMenuButton.style.padding = '12px 30px';
        returnMenuButton.style.fontSize = '1.1rem';
        returnMenuButton.style.backgroundColor = completed ? '#FF9800' : '#9C27B0'; // Cor laranja ou roxa
        returnMenuButton.style.color = 'white';
        returnMenuButton.style.border = 'none';
        returnMenuButton.style.borderRadius = '30px';
        returnMenuButton.style.cursor = 'pointer';
        returnMenuButton.style.boxShadow = '0 3px 5px rgba(0,0,0,0.2)';
        returnMenuButton.style.transition = 'all 0.3s ease';
        returnMenuButton.style.marginLeft = '10px'; // Espaçamento à esquerda para separar do outro botão
        
        // Efeito hover suave
        returnMenuButton.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-3px)';
            this.style.boxShadow = '0 5px 10px rgba(0,0,0,0.25)';
        });
        
        returnMenuButton.addEventListener('mouseleave', function() {
            this.style.transform = '';
            this.style.boxShadow = '0 3px 5px rgba(0,0,0,0.2)';
        });
        
        // Adicionar confirmação ao clicar no botão
        returnMenuButton.addEventListener('click', () => {
            // Efeito de clique
            returnMenuButton.style.transform = 'scale(0.95)';
            setTimeout(() => {
                returnMenuButton.style.transform = '';
                showConfirmDialog('Voltar ao menu?', 'Tem certeza que deseja voltar ao menu de níveis?', () => {
                    location.reload();
                });
            }, 150);
        });
        
        // Adicionar o botão ao container de botões
        congratsButtons.appendChild(returnMenuButton);
        
        // Efeito hover suave
        newChallengeButton.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-3px)';
            this.style.boxShadow = '0 5px 10px rgba(0,0,0,0.25)';
        });
        
        newChallengeButton.addEventListener('mouseleave', function() {
            this.style.transform = '';
            this.style.boxShadow = '0 3px 5px rgba(0,0,0,0.2)';
        });
        
        // Adicionar confirmação ao clicar no botão
        newChallengeButton.addEventListener('click', () => {
            // Efeito de clique
            newChallengeButton.style.transform = 'scale(0.95)';
            setTimeout(() => {
                newChallengeButton.style.transform = '';
                showConfirmDialog('Iniciar novo desafio?', 'Tem certeza que deseja iniciar um novo desafio do mesmo nível?', () => {
                    // Iniciar novo desafio do mesmo nível em vez de recarregar a página
                    startChallenge(level);
                });
            }, 150);
        });
        
        // Adicionar botões ao container
        congratsButtons.appendChild(newChallengeButton);
        congratsContainer.appendChild(congratsButtons);
        
        // Adicionar ao container principal
        mainContainer.appendChild(congratsContainer);
    }
    
    /**
     * Exibe um diálogo de confirmação personalizado
     * @param {string} title - Título do diálogo
     * @param {string} message - Mensagem do diálogo
     * @param {Function} confirmCallback - Função a ser executada se confirmado
     */
    function showConfirmDialog(title, message, confirmCallback) {
        // Criar o overlay de fundo com efeito blur
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backdropFilter = 'blur(5px)'; // Aplicar blur ao fundo
        overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'; // Fundo claro semi-transparente
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.zIndex = '1000';
        
        // Criar o diálogo
        const dialog = document.createElement('div');
        dialog.className = 'confirm-dialog';
        dialog.style.backgroundColor = '#fff';
        dialog.style.borderRadius = '10px';
        dialog.style.padding = '20px';
        dialog.style.maxWidth = '400px';
        dialog.style.width = '80%';
        dialog.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.3)';
        dialog.style.textAlign = 'center';
        dialog.style.animation = 'scale-in 0.3s ease-out';
        
        // Título do diálogo
        const dialogTitle = document.createElement('h3');
        dialogTitle.style.fontFamily = "'Pacifico', cursive";
        dialogTitle.style.fontSize = '2rem';
        dialogTitle.style.color = '#e65100';
        dialogTitle.style.marginBottom = '15px';
        dialogTitle.style.textShadow = '3px 3px 6px rgba(0, 0, 0, 0.15)';
        dialogTitle.style.animation = 'colorCycle 8s infinite alternate';
        dialogTitle.style.letterSpacing = '1px';
        dialogTitle.textContent = title;
        
        // Mensagem do diálogo
        const dialogMessage = document.createElement('p');
        dialogMessage.style.marginBottom = '20px';
        dialogMessage.textContent = message;
        
        // Container para botões
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'center';
        buttonContainer.style.gap = '10px';
        
        // Botão de confirmar
        const confirmButton = document.createElement('button');
        confirmButton.className = 'standardized-button';
        confirmButton.style.backgroundColor = '#4caf50';
        confirmButton.style.color = 'white'; // Adicionando cor branca ao texto
        confirmButton.textContent = 'Confirmar';
        confirmButton.addEventListener('click', () => {
            document.body.removeChild(overlay);
            if (confirmCallback) confirmCallback();
        });
        
        // Botão de cancelar
        const cancelButton = document.createElement('button');
        cancelButton.className = 'standardized-button';
        cancelButton.style.backgroundColor = '#f44336';
        cancelButton.style.color = 'white'; // Adicionando cor branca ao texto
        cancelButton.textContent = 'Cancelar';
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });
        
        // Montar o diálogo
        buttonContainer.appendChild(confirmButton);
        buttonContainer.appendChild(cancelButton);
        dialog.appendChild(dialogTitle);
        dialog.appendChild(dialogMessage);
        dialog.appendChild(buttonContainer);
        overlay.appendChild(dialog);
        
        // Adicionar ao corpo do documento
        document.body.appendChild(overlay);
        
        // Adicionar animação
        document.head.insertAdjacentHTML('beforeend', `
            <style>
                @keyframes scale-in {
                    0% { transform: scale(0.5); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
            </style>
        `);
    }
    
    // ===== INICIALIZAÇÃO E EVENTOS =====
    // Adicionar eventos aos botões de nível
    challengeButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Obter o nível do atributo data
            const level = this.getAttribute('data-level');
            
            // Animação de clique
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
                
                // Confirmar antes de iniciar o desafio
                showConfirmDialog(
                    'Iniciar Desafio', 
                    `Tem certeza que deseja iniciar um desafio de nível ${level}?`, 
                    () => {
                        // Iniciar o desafio
                        startChallenge(level);
                    }
                );
            }, 200);
        });
    });
    
    // Efeitos de Hover Aprimorados
    const challengeLevels = document.querySelectorAll('.challenge-level');
    
    challengeLevels.forEach(level => {
        level.addEventListener('mouseenter', function() {
            // Efeito de elevação
            this.style.transform = 'translateY(-8px)';
            this.style.boxShadow = '0 15px 30px rgba(0,0,0,0.15)';
            
            // Destacar o botão
            const button = this.querySelector('.challenge-button');
            if (button) {
                button.style.transform = 'scale(1.1)';
            }
        });
        
        level.addEventListener('mouseleave', function() {
            // Restaurar estado normal
            this.style.transform = '';
            this.style.boxShadow = '';
            
            // Restaurar botão
            const button = this.querySelector('.challenge-button');
            if (button) {
                button.style.transform = '';
            }
        });
    });
    
    /**
     * Ajusta o layout com base no tamanho da tela
     */
    function adjustLayout() {
        const width = window.innerWidth;
        const challengeLevels = document.querySelectorAll('.challenge-level');
        
        if (width < 768) {
            // Layout móvel
            challengeLevels.forEach(level => {
                level.style.width = '80%';
                level.style.maxWidth = '300px';
            });
        } else {
            // Layout desktop
            challengeLevels.forEach(level => {
                level.style.width = '220px';
                level.style.maxWidth = '';
            });
        }
    }
    
    // Ajustar layout inicialmente e quando a janela for redimensionada
    adjustLayout();
    window.addEventListener('resize', adjustLayout);
    
    // Adicionar interatividade ao contêiner do Chef
    const chefContainer = document.getElementById('chef-svg-container');
    if (chefContainer) {
        // Cores dos níveis de dificuldade
        const levelColors = [
            '#4caf50', // Verde - Fácil
            '#ff9800', // Laranja - Médio
            '#f44336', // Vermelho - Difícil
            '#9c27b0'  // Roxo - Extremo
        ];
        
        let currentColorIndex = 0;
        
        // Função para mudar as cores do contêiner do chef
        function changeChefContainerColor() {
            // Avançar para a próxima cor
            currentColorIndex = (currentColorIndex + 1) % levelColors.length;
            const newColor = levelColors[currentColorIndex];
            
            // Aplicar a nova cor ao contêiner do chef
            chefContainer.style.transition = 'all 0.5s ease';
            
            // Mudar a cor do brilho ao redor do círculo
            chefContainer.style.setProperty('--chef-glow-color', newColor);
            
            // Atualizar o estilo ::after usando uma classe temporária
            document.documentElement.style.setProperty('--chef-container-color', newColor);
            
            // Adicionar efeito de pulsação ao mudar a cor
            chefContainer.classList.add('color-change-pulse');
            setTimeout(() => {
                chefContainer.classList.remove('color-change-pulse');
            }, 500);
        }
        // Adicionar evento de clique ao contêiner do chef
        chefContainer.addEventListener('click', changeChefContainerColor);
    }
    
    // ===== TRATAMENTO DE ERROS E OTIMIZAÇÕES =====
    // Adicionar tratamento de erros global
    window.addEventListener('error', function(event) {
        console.error('Erro capturado:', event.error);

        // Se o erro ocorrer durante a geração de receita, mostrar mensagem amigável
        if (mainContainer.querySelector('.countdown-container')) {
            const errorMessage = document.createElement('div');
            errorMessage.className = 'error-message';
            errorMessage.textContent = '';
            const errorHtml = sanitizeHtml(
                '<h3>Ops! Algo deu errado</h3>' +
                '<p>Não foi possível gerar a sua receita. Por favor, tente novamente.</p>' +
                '<button class="back-button standardized-button">Voltar</button>'
            );
            errorMessage.insertAdjacentHTML('beforeend', errorHtml);

            // Limpar o conteúdo atual
            mainContainer.innerHTML = '';
            mainContainer.appendChild(errorMessage);
            
            // Adicionar evento ao botão de voltar
            errorMessage.querySelector('.back-button').addEventListener('click', () => {
                location.reload();
            });
        }
    });
    
    /**
     * Verifica o status da API ao carregar a página
     */
    async function checkApiStatus() {
    try {
        const response = await fetch(RECIPE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: 'olá' }]
                    }
                ],
                generationConfig: {
                    temperature: 0,
                    maxOutputTokens: 10,
                }
            })
        });
        
        if (!response.ok) {
            console.warn("API Gemini pode estar com problemas:", response.status);
                // Adicionar uma notificação discreta na interface
                const apiNotification = document.createElement('div');
                apiNotification.className = 'api-notification';
                apiNotification.textContent = "⚠️ Serviço de receitas pode estar instável";
                apiNotification.style.position = 'fixed';
                apiNotification.style.bottom = '10px';
                apiNotification.style.right = '10px';
                apiNotification.style.backgroundColor = 'rgba(255, 152, 0, 0.9)';
                apiNotification.style.color = 'white';
                apiNotification.style.padding = '8px 12px';
                apiNotification.style.borderRadius = '5px';
                apiNotification.style.fontSize = '14px';
                apiNotification.style.zIndex = '1000';
                document.body.appendChild(apiNotification);
                
                // Remover após alguns segundos
                setTimeout(() => {
                    if (apiNotification.parentNode) {
                        document.body.removeChild(apiNotification);
                    }
                }, 5000);
            }
        } catch (error) {
            console.error("Erro ao verificar status da API:", error);
        }
    }
    
    /**
     * Otimiza a animação de fundo para dispositivos de baixo desempenho
     */
    function optimizeBackgroundAnimation() {
        // Verificar se o dispositivo é de baixo desempenho
        const isLowPowerDevice = navigator.hardwareConcurrency < 4 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isLowPowerDevice) {
            
            // Reduzir o número de elementos de comida
            const newFoodCount = 10;
            
            // Remover elementos extras
            while (foodElements.length > newFoodCount) {
                const element = foodElements.pop();
                if (element && element.parentNode) {
                    element.parentNode.removeChild(element);
                }
            }
            
            // Reduzir a opacidade da animação para economizar recursos
            backgroundAnimation.style.opacity = '0.3';
        }
    }
    
    // Inicialização de funções
    initFoodAnimation();
    checkApiStatus();
    setTimeout(optimizeBackgroundAnimation, 2000);
});

// Funcionalidade do botão de voltar com efeito de fechamento
document.addEventListener('DOMContentLoaded', function() {
    const backButton = document.getElementById('back-button');
    const transitionOverlay = document.getElementById('transition-overlay');
    const foodIcons = document.querySelectorAll('.food-icon');

    backButton.addEventListener('click', function(e) {
        e.preventDefault();

               // Ativar transição
               transitionOverlay.classList.add('active');

               let currentIcon = 0;
               const animationInterval = setInterval(() => {
                   foodIcons[currentIcon].classList.add('active');
       
                   setTimeout(() => {
                       foodIcons[currentIcon].classList.remove('active');
                       currentIcon = (currentIcon + 1) % foodIcons.length;
                   }, 400);
               }, 500);
           
               // Esperar 4 segundos antes de iniciar a transição final
               setTimeout(() => {
                   clearInterval(animationInterval);
       
                   // Aplicar efeito de fechamento ao body
                   document.body.style.animation = 'close-transition 1s ease-in-out forwards';
                   document.body.style.position = 'relative';
                   document.body.style.overflow = 'hidden';
                   
                   // Garantir que o efeito de clip-path seja aplicado corretamente
                   document.body.style.clipPath = 'circle(150% at center)';
                   
                   // Esperar que a animação termine antes de mudar de página
                   setTimeout(() => {
                       window.location.href = '../index.html';
                   }, 1000);
               }, 4000);
           });
       });