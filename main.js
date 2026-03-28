// Lista de imagens de alimentos para animações
const foodImages = [
  "https://cdn-icons-png.flaticon.com/512/1046/1046784.png", // Pizza
  "https://cdn-icons-png.flaticon.com/512/1046/1046771.png", // Hambúrguer
  "https://cdn-icons-png.flaticon.com/512/1046/1046755.png", // Salada
  "https://cdn-icons-png.flaticon.com/512/135/135728.png",   // Bolo
  "https://cdn-icons-png.flaticon.com/512/6301/6301302.png", // Café
  "https://cdn-icons-png.flaticon.com/512/5344/5344260.png", // Frango
  "https://cdn-icons-png.flaticon.com/512/1046/1046748.png", // Sorvete
  "https://cdn-icons-png.flaticon.com/512/6108/6108623.png", // Macarrão
  "https://cdn-icons-png.flaticon.com/512/2909/2909761.png", // Outro alimento
  "https://cdn-icons-png.flaticon.com/512/1102/1102780.png"  // Outro alimento
];

/**
 * Função para desabilitar todos os botões durante a transição
 * Evita cliques múltiplos durante animações
 */
function disableAllButtons() {
  const buttons = [
    document.getElementById('chat-button'),
    document.getElementById('recipes-button'),
    document.getElementById('desafio-button'),
    document.getElementById('ai-button')
  ];
  
  buttons.forEach(button => {
    if (button) {
      button.disabled = true;
      button.style.pointerEvents = 'none';
    }
  });
}

/**
 * Retorna uma imagem aleatória da lista de imagens de alimentos
 */
function getRandomFoodImage() {
  const randomIndex = Math.floor(Math.random() * foodImages.length);
  return foodImages[randomIndex];
}

/**
 * Cria um elemento de comida animado que se move pela tela
 */
function createFoodElement() {
  const foodElement = document.createElement('div');
  foodElement.classList.add('food-element');
  foodElement.style.backgroundImage = `url('${getRandomFoodImage()}')`;

  // Define posições iniciais e finais aleatórias para a animação
  const startX = Math.random() * 100;
  const startY = Math.random() * 100;
  const endX = Math.random() * 100;
  const endY = Math.random() * 100;

  // Define variáveis CSS para controlar a animação
  foodElement.style.setProperty('--start-x', startX);
  foodElement.style.setProperty('--start-y', startY);
  foodElement.style.setProperty('--end-x', endX);
  foodElement.style.setProperty('--end-y', endY);

  foodMovement.appendChild(foodElement);

  // Quando a animação terminar, remove o elemento e cria um novo
  foodElement.addEventListener('animationend', () => {
    foodElement.remove();
    createFoodElement();
  });
}

/**
 * Cria partículas de comida que explodem a partir de um ponto
 * Usado em efeitos especiais como clique no botão de informações
 */
function createFoodParticles(e) {
  const foodEmojis = ['🍕', '🍔', '🍟', '🌭', '🍿', '🥗', '🍱', '🍣', '🍜', '🍝'];
  for (let i = 0; i < 20; i++) {
    const particle = document.createElement('div');
    particle.classList.add('food-particle');
    particle.style.backgroundImage = `url("https://twemoji.maxcdn.com/v/latest/svg/${foodEmojis[Math.floor(Math.random() * foodEmojis.length)].codePointAt(0).toString(16)}.svg")`;
    particle.style.left = `${e.clientX}px`;
    particle.style.top = `${e.clientY}px`;
    document.body.appendChild(particle);

    const angle = Math.random() * Math.PI * 2;
    const velocity = 2; // Velocidade constante
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
      complete: function(anim) {
        particle.remove();
      }
    });
  }
}

/**
 * Função para gerenciar a transição entre páginas
 * @param {string} targetUrl - URL de destino para navegação
 */
function handlePageTransition(targetUrl) {
  const transitionOverlay = document.getElementById('transition-overlay');
  const foodIcons = document.querySelectorAll('.food-icon');
  
  // Desabilita todos os botões
  disableAllButtons();
  
  // Ativa a transição
  transitionOverlay.classList.add('active');
  
  // Anima os ícones de comida em sequência
  let currentIcon = 0;
  const animationInterval = setInterval(() => {
    foodIcons[currentIcon].classList.add('active');
    
    setTimeout(() => {
      foodIcons[currentIcon].classList.remove('active');
      currentIcon = (currentIcon + 1) % foodIcons.length;
    }, 400);
  }, 500);
  
  // Aguarda 4 segundos antes de iniciar a transição final
  setTimeout(() => {
    clearInterval(animationInterval);
    
    // Aplica o efeito de abertura
    document.body.style.animation = 'open-transition 1s ease-in-out forwards';
    
    // Aguarda o fim da animação antes de mudar de página
    setTimeout(() => {
      window.location.href = targetUrl;
    }, 1000);
  }, 4000);
}

// Inicialização quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
  // Configuração do botão de informações (AI)
  const aiButton = document.getElementById('ai-button');
  const aiInfo = document.getElementById('ai-info');
  
  if (aiButton && aiInfo) {
    aiButton.addEventListener('click', function(e) {
      aiInfo.classList.toggle('show');
      createFoodParticles(e);
    });

    // Fechar a caixa de informações se clicar fora dela
    document.addEventListener('click', function(event) {
      if (!aiButton.contains(event.target) && !aiInfo.contains(event.target)) {
        aiInfo.classList.remove('show');
      }
    });
  }

  // Configuração dos botões de navegação
  const chatButton = document.getElementById('chat-button');
  const recipesButton = document.getElementById('recipes-button');
  const desafioButton = document.getElementById('desafio-button');
  
  if (chatButton) {
    chatButton.addEventListener('click', function(e) {
      e.preventDefault();
      handlePageTransition('Chat bot/chatbot.html');
    });
  }
  
  if (recipesButton) {
    recipesButton.addEventListener('click', function(e) {
      e.preventDefault();
      handlePageTransition('Receitas/receitas.html');
    });
  }
  
  if (desafioButton) {
    desafioButton.addEventListener('click', function(e) {
      e.preventDefault();
      handlePageTransition('Desafios/desafio.html');
    });
  }
  
  // Configuração da animação do logo
  const spans = document.querySelectorAll('.logo span');
  const numLetters = spans.length;

  spans.forEach(function(span, i) {
    const mappedIndex = i - (numLetters / 2);
    span.style.animationDelay = (mappedIndex * 0.25) + 's';
  });
});

// Cria o contêiner para os elementos de comida em movimento
const foodMovement = document.createElement('div');
foodMovement.classList.add('food-movement');
document.body.appendChild(foodMovement);

// Inicializa com um elemento de comida
createFoodElement();

// Controle para limitar a criação de novos elementos (efeito de rastro do mouse)
let canCreateSpark = true;

// Efeito de rastro de comida ao mover o mouse
document.addEventListener('mousemove', function(e) {
  if (canCreateSpark) {
    const foodSpark = document.createElement('div');
    foodSpark.classList.add('food-spark');
    document.body.appendChild(foodSpark);

    // Escolhe uma imagem aleatoriamente da lista de imagens de alimentos
    const randomImage = foodImages[Math.floor(Math.random() * foodImages.length)];
    foodSpark.style.backgroundImage = `url('${randomImage}')`;

    // Posiciona o div na localização atual do mouse
    foodSpark.style.left = `${e.pageX - 15}px`; // Ajusta para que o centro da imagem esteja na posição do cursor
    foodSpark.style.top = `${e.pageY - 15}px`; // Ajusta para que o centro da imagem esteja na posição do cursor

    // Remove a imagem após a animação ser concluída para evitar sobrecarga no DOM
    setTimeout(() => {
      foodSpark.remove();
    }, 1000); // 1000 ms corresponde à duração da animação

    canCreateSpark = false;

    // Define o intervalo de tempo para permitir a criação de um novo elemento
    setTimeout(() => {
      canCreateSpark = true;
    }, 200); // Controla a velocidade de criação das imagens
  }
});

// Efeito de faísca ao mover o mouse
document.addEventListener('mousemove', function(e) {
  const spark = document.createElement('div');
  spark.classList.add('spark');
  document.body.appendChild(spark);

  // Posiciona a faísca onde o evento do mouse ocorreu
  spark.style.left = `${e.pageX}px`;
  spark.style.top = `${e.pageY}px`;

  // Remove a faísca depois que a animação é concluída
  setTimeout(() => {
    spark.remove();
  }, 700); // 700 ms = duração da animação
});
