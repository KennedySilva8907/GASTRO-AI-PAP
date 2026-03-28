// Array de imagens de comida para os ícones animados
const foodImages = [
    "https://cdn-icons-png.flaticon.com/512/1046/1046784.png",
    "https://cdn-icons-png.flaticon.com/512/1046/1046771.png",
    "https://cdn-icons-png.flaticon.com/512/1046/1046755.png",
    "https://cdn-icons-png.flaticon.com/512/135/135728.png",
    "https://cdn-icons-png.flaticon.com/512/6301/6301302.png",
    "https://cdn-icons-png.flaticon.com/512/5344/5344260.png",
    "https://cdn-icons-png.flaticon.com/512/1046/1046748.png",
    "https://cdn-icons-png.flaticon.com/512/6108/6108623.png",
    "https://cdn-icons-png.flaticon.com/512/2909/2909761.png",
    "https://cdn-icons-png.flaticon.com/512/1102/1102780.png"
];

// ===============================================================
// SECURITY: DOMPurify Configuration for XSS Prevention
// ===============================================================
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ['p', 'strong', 'em', 'ul', 'ol', 'li', 'code', 'pre', 'br', 'a', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'span'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['target'],
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

// ===============================================================
// CONFIGURAÇÃO DO MATTER.JS (MOTOR DE FÍSICA PARA ANIMAÇÕES)
// ===============================================================

// Importar componentes necessários do Matter.js
const Engine = Matter.Engine,
    Render = Matter.Render,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Body = Matter.Body,
    Events = Matter.Events,
    Mouse = Matter.Mouse,
    MouseConstraint = Matter.MouseConstraint;

// Criar motor de física com gravidade zero
const engine = Engine.create({ gravity: { x: 0, y: 0 } });
const world = engine.world;

// Configurar renderização
const render = Render.create({
    element: document.getElementById('food-container'),
    engine: engine,
    options: {
        width: window.innerWidth,
        height: window.innerHeight,
        wireframes: false,
        background: 'transparent'
    }
});

// Criar ícones de comida com física
const foods = [];
const baseSpeed = 0.12;  // Velocidade base para todos os ícones

// Criar vários ícones de comida
for (let i = 0; i < 13; i++) {
    // Posição aleatória na tela
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight;
    const size = 65;
    
    // Criar corpo circular com imagem
    const food = Bodies.circle(x, y, size / 2, {
        render: {
            sprite: {
                texture: foodImages[i % foodImages.length],
                xScale: size / 256,
                yScale: size / 256
            }
        },
        // Propriedades físicas para movimento suave
        restitution: 1,      // Elasticidade total
        friction: 0,         // Sem fricção
        frictionAir: 0,      // Sem resistência do ar
        inertia: Infinity,   // Não desacelera
        slop: 0              // Sem sobreposição
    });

    // Definir velocidade inicial em direção aleatória
    const angle = Math.random() * Math.PI * 2;
    Body.setVelocity(food, {
        x: Math.cos(angle) * baseSpeed,
        y: Math.sin(angle) * baseSpeed
    });

    foods.push(food);
}

// Adicionar todos os ícones de comida ao mundo
World.add(world, foods);

// Adicionar controle do mouse para interação
const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
        stiffness: 0.2,
        render: { visible: false }
    }
});

World.add(world, mouseConstraint);
render.mouse = mouse;

// ===============================================================
// FUNÇÕES DE FÍSICA E INTERAÇÃO
// ===============================================================

// Função para manter os ícones dentro da tela (efeito de envolvimento)
function wrapFoods() {
    const { width, height } = render.options;
    foods.forEach(food => {
        const { x, y } = food.position;
        // Se sair por um lado, aparece do lado oposto
        if (x < 0) Body.setPosition(food, { x: width, y: y });
        if (x > width) Body.setPosition(food, { x: 0, y: y });
        if (y < 0) Body.setPosition(food, { x: x, y: height });
        if (y > height) Body.setPosition(food, { x: x, y: 0 });
    });
}

// Função para lidar com colisões entre ícones
function handleCollision(event) {
    const pairs = event.pairs;
    for (let i = 0; i < pairs.length; i++) {
        const bodyA = pairs[i].bodyA;
        const bodyB = pairs[i].bodyB;
        
        // Verificar se ambos os corpos são ícones de comida
        if (foods.includes(bodyA) && foods.includes(bodyB)) {
            // Calcular vetor de colisão
            const collisionVector = {
                x: bodyB.position.x - bodyA.position.x,
                y: bodyB.position.y - bodyA.position.y
            };

            // Normalizar o vetor
            const magnitude = Math.sqrt(collisionVector.x * collisionVector.x + collisionVector.y * collisionVector.y);
            const normalizedVector = {
                x: collisionVector.x / magnitude,
                y: collisionVector.y / magnitude
            };

            // Calcular produto escalar para reflexão
            const dotProductA = bodyA.velocity.x * normalizedVector.x + bodyA.velocity.y * normalizedVector.y;
            const dotProductB = bodyB.velocity.x * normalizedVector.x + bodyB.velocity.y * normalizedVector.y;

            // Aplicar reflexão (física de colisão)
            Body.setVelocity(bodyA, {
                x: bodyA.velocity.x - 2 * dotProductA * normalizedVector.x,
                y: bodyA.velocity.y - 2 * dotProductA * normalizedVector.y
            });

            Body.setVelocity(bodyB, {
                x: bodyB.velocity.x - 2 * dotProductB * normalizedVector.x,
                y: bodyB.velocity.y - 2 * dotProductB * normalizedVector.y
            });

            // Pequena separação para evitar sobreposição
            const separation = 1.01;
            Body.setPosition(bodyA, {
                x: bodyA.position.x - normalizedVector.x * separation,
                y: bodyA.position.y - normalizedVector.y * separation
            });
            Body.setPosition(bodyB, {
                x: bodyB.position.x + normalizedVector.x * separation,
                y: bodyB.position.y + normalizedVector.y * separation
            });

            // Efeito visual de "pulso" na colisão
            bodyA.render.sprite.xScale *= 1.1;
            bodyA.render.sprite.yScale *= 1.1;
            bodyB.render.sprite.xScale *= 1.1;
            bodyB.render.sprite.yScale *= 1.1;

            // Retornar ao tamanho normal após 100ms
            setTimeout(() => {
                bodyA.render.sprite.xScale /= 1.1;
                bodyA.render.sprite.yScale /= 1.1;
                bodyB.render.sprite.xScale /= 1.1;
                bodyB.render.sprite.yScale /= 1.1;
            }, 100);
        }
    }
}

// Função para manter velocidade constante dos ícones
function maintainConstantSpeed() {
    foods.forEach(food => {
        const velocity = food.velocity;
        const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
        // Se a velocidade for diferente da base, normalizar
        if (speed !== baseSpeed) {
            const factor = baseSpeed / speed;
            Body.setVelocity(food, {
                x: velocity.x * factor,
                y: velocity.y * factor
            });
        }
    });
}

// Iniciar o motor e renderização
Engine.run(engine);
Render.run(render);

// Adicionar event listeners para física
Events.on(engine, 'afterUpdate', wrapFoods);
Events.on(engine, 'afterUpdate', maintainConstantSpeed);
Events.on(engine, 'collisionStart', handleCollision);

// Lidar com a soltura do mouse (arremessar ícones)
Events.on(mouseConstraint, 'enddrag', function(event) {
    const body = event.body;
    if (foods.includes(body)) {
        // Calcular vetor de arremesso
        const mouseVelocity = event.mouse.mouseupPosition;
        const bodyPosition = body.position;
        const throwVector = {
            x: (mouseVelocity.x - bodyPosition.x) * 0.05,
            y: (mouseVelocity.y - bodyPosition.y) * 0.05
        };
        
        // Normalizar para manter velocidade constante
        const speed = Math.sqrt(throwVector.x * throwVector.x + throwVector.y * throwVector.y);
        const factor = baseSpeed / speed;
        Body.setVelocity(body, {
            x: throwVector.x * factor,
            y: throwVector.y * factor
        });
    }
});

// ===============================================================
// FUNCIONALIDADE DO CHATBOT
// ===============================================================

document.addEventListener('DOMContentLoaded', () => {
    // Elementos da interface do chat
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatMessages = document.getElementById('chat-messages');
    const chatContainer = document.getElementById('chat-container');
    const chatHeader = document.getElementById('chat-header');
    const submitButton = document.querySelector('#chat-form button[type="submit"]');
    const stopButton = document.getElementById('stop-button');
    const clearButton = document.getElementById('clear-button');
    
    // Configuração da API Gemini
    const API_URL = '/api/chat'; // Para o chatbot


    // Variáveis de estado do chat
    let conversationHistory = [];
    const MAX_HISTORY = 5;          // Número máximo de pares de mensagens no histórico
    const MAX_TOKENS = 900;         // Limite de tokens para a resposta da API
    const TYPING_SPEED = 10;        // Velocidade de digitação (ms por caractere)
    const MAX_TYPING_TIME = 30000;  // Tempo máximo de digitação (30 segundos)

    let isProcessing = false;       // Flag para controlar processamento de mensagem
    let currentTyped = null;        // Objeto Typed.js atual
    let isTyping = false;           // Flag para controlar animação de digitação
    let currentRequest = null;      // Objeto de requisição atual (para abortar)
    
    // Função para limpar o chat
    function clearChat() {
        chatMessages.innerHTML = '';
        conversationHistory = [];
        addMessage('bot', 'Olá! Sou o GastroAI, o seu assistente de culinária especializado. Como posso ajudá-lo com questões de gastronomia hoje?');
        userInput.value = '';
        userInput.focus();
    }

    // Adicionar event listener para o botão de limpar
    clearButton.addEventListener('click', clearChat);

    // Função para obter a hora atual formatada
    function getCurrentTime() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  
    // Funções para controlar o estado dos inputs
    function toggleInputs(enable) {
        userInput.disabled = !enable;
        submitButton.disabled = !enable;
        submitButton.classList.toggle('disabled', !enable);
    }

    function toggleStopButton(enable) {
        stopButton.disabled = !enable;
        stopButton.classList.toggle('disabled', !enable);
    }

    function toggleClearButton(enable) {
        clearButton.disabled = !enable;
        clearButton.classList.toggle('disabled', !enable);
    }

    // Função para interromper a requisição atual
    function stopCurrentRequest() {
        if (currentRequest) {
            currentRequest.abort();
            currentRequest = null;
        }
        if (currentTyped) {
            currentTyped.destroy();
            currentTyped = null;
        }
        isProcessing = false;
        isTyping = false;
        toggleStopButton(false);
        toggleInputs(true);

        // Remover indicador de digitação se existir
        const typingIndicator = chatMessages.querySelector('.typing-indicator');
        if (typingIndicator) {
            chatMessages.removeChild(typingIndicator);
        }

        // Remover última mensagem do bot se estiver vazia
        const lastBotMessage = chatMessages.querySelector('.message.bot:last-child');
        if (lastBotMessage && !lastBotMessage.querySelector('.message-content').textContent.trim()) {
            chatMessages.removeChild(lastBotMessage);
        }

        addMessage('bot', 'A solicitação foi cancelada. Por favor, digite uma nova pergunta abaixo.');
    }

    // Adicionar event listener para o botão de parar
    stopButton.addEventListener('click', stopCurrentRequest);
  
    // Função para adicionar mensagem ao chat com efeito de digitação
    function addMessage(sender, message) {
        return new Promise((resolve) => {
            // Criar elemento da mensagem
            const messageElement = document.createElement('div');
            messageElement.classList.add('message', sender);
            messageElement.setAttribute('data-full-text', message);
            messageElement.innerHTML = `
                <div class="message-content"></div>
                <span class="timestamp">${getCurrentTime()}</span>
            `;
            chatMessages.appendChild(messageElement);

            const contentElement = messageElement.querySelector('.message-content');
            // Converter markdown para HTML e sanitizar para prevenir XSS
            const rawHtml = marked.parse(message);
            const htmlContent = sanitizeHtml(rawHtml);

            // Calcular tempo de digitação (limitado a MAX_TYPING_TIME)
            let typingTime = Math.min(htmlContent.length * TYPING_SPEED, MAX_TYPING_TIME);

            // Configurar animação de digitação com Typed.js
            const options = {
                strings: [htmlContent],
                typeSpeed: typingTime / htmlContent.length,
                showCursor: false,
                contentType: 'html',
                onStringTyped: () => chatMessages.scrollTop = chatMessages.scrollHeight,
                preStringTyped: () => {
                    isTyping = true;
                    toggleStopButton(true);
                },
                onComplete: () => {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                    isTyping = false;
                    if (!isProcessing) {
                        toggleStopButton(false);
                        toggleInputs(true);
                    }
                    currentTyped = null;

                    // Adicionar mensagem ao histórico de conversa
                    conversationHistory.push({ role: sender === 'user' ? 'user' : 'model', parts: [{ text: message }] });
                    if (conversationHistory.length > MAX_HISTORY * 2) {
                        conversationHistory.splice(0, 2);
                    }

                    toggleClearButton(true);
                    resolve();
                }
            };

            currentTyped = new Typed(contentElement, options);
        });
    }
  
    // Função para mostrar indicador de digitação enquanto espera resposta
    function showTypingIndicator() {
        const typingIndicator = document.createElement('div');
        typingIndicator.classList.add('message', 'bot', 'typing-indicator');
        typingIndicator.innerHTML = '<span></span><span></span><span></span>';
        chatMessages.appendChild(typingIndicator);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return typingIndicator;
    }
  
    // Função para obter resposta da API do chatbot
   async function getChatbotResponse(message) {
    const controller = new AbortController();
    const signal = controller.signal;
    currentRequest = controller;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: 'Use sempre português de Portugal nas suas respostas. Você é um assistente especializado em gastronomia. Responda apenas a perguntas relacionadas à culinária, receitas, técnicas de cozinha e temas gastronómicos.' }]
                    },
                    {
                        role: 'model',
                        parts: [{ text: 'Entendido. Sou um assistente especializado em gastronomia e vou responder apenas a perguntas relacionadas à culinária, receitas, técnicas de cozinha e temas gastronómicos, sempre utilizando o português de Portugal.' }]
                    },
                    ...conversationHistory,
                    { role: 'user', parts: [{ text: message }] }
                ],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: MAX_TOKENS,
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ]
            }),
            signal: signal
        });

        if (!response.ok) {
            let errorMsg = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg += ` - ${JSON.stringify(errorData)}`;
            } catch (_) {
                // ignora se a resposta de erro não for JSON válido
            }
            throw new Error(errorMsg);
        }

        const data = await response.json();
        if (!data.candidates || data.candidates.length === 0) {
            throw new Error('Resposta da API não contém conteúdo válido');
        }
        return data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Solicitação cancelada');
        }
        console.error('Error in getChatbotResponse:', error);
        throw error;
    } finally {
        currentRequest = null;
    }
}

  
    // Event listener para envio de mensagem
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = userInput.value.trim().slice(0, 500); // Máximo 500 caracteres
        if (message && !isProcessing) {
            isProcessing = true;
            userInput.value = '';

            toggleInputs(false);
            toggleStopButton(true);

            try {
                await addMessage('user', message);
                const typingIndicator = showTypingIndicator();

                // Obter e mostrar resposta do bot
                const botResponse = await getChatbotResponse(message);
                if (typingIndicator && typingIndicator.parentNode) {
                    chatMessages.removeChild(typingIndicator);
                }
                await addMessage('bot', botResponse);
            } catch (error) {
                console.error('Error in chat submission:', error);
                if (error.message !== 'Solicitação cancelada') {
                    const typingIndicator = chatMessages.querySelector('.typing-indicator');
                    if (typingIndicator) {
                        chatMessages.removeChild(typingIndicator);
                    }
                    await addMessage('bot', `Desculpe, ocorreu um erro ao processar a sua mensagem. Por favor, tente novamente.`);
                }
            } finally {
                isProcessing = false;
                if (!isTyping) {
                    toggleStopButton(false);
                    toggleInputs(true);
                }
                userInput.focus();
            }
        }
    });

    // Inicialização do chat
    toggleInputs(true);
    toggleStopButton(false);
    toggleClearButton(false);
    setTimeout(() => addMessage('bot', 'Olá! Sou o GastroAI, o seu assistente de culinária especializado. Como posso ajudá-lo com questões de gastronomia hoje?'), 1000);
  
    // ===============================================================
    // FUNCIONALIDADE DE ARRASTAR O CHAT
    // ===============================================================
    
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    // Event listeners para arrastar o chat
    chatHeader.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        if (e.target === chatHeader) isDragging = true;
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            xOffset = currentX;
            yOffset = currentY;
            setTranslate(currentX, currentY, chatContainer);
        }
    }

    function dragEnd() {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
    }

    function setTranslate(xPos, yPos, el) {
        el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
    }
});

// ===============================================================
// FUNCIONALIDADE DO BOTÃO DE VOLTAR
// ===============================================================

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

// ===============================================================
// ANIMAÇÕES DOS BOTÕES DE CONTROLE
// ===============================================================

document.addEventListener('DOMContentLoaded', () => {
    const submitButton = document.getElementById('submit-button');
    const stopButton = document.getElementById('stop-button');
    const clearButton = document.getElementById('clear-button');

    // Adicionar animações aos botões quando clicados
    submitButton.addEventListener('click', () => {
        submitButton.style.animation = 'pulse 0.5s';
        setTimeout(() => {
            submitButton.style.animation = '';
        }, 500);
    });

    stopButton.addEventListener('click', () => {
        stopButton.style.animation = 'rotate 0.5s';
        setTimeout(() => {
            stopButton.style.animation = '';
        }, 500);
    });

    clearButton.addEventListener('click', () => {
        clearButton.style.animation = 'shake 0.5s';
        setTimeout(() => {
            clearButton.style.animation = '';
        }, 500);
    });
});

// ===============================================================
// TOOLTIPS DOS BOTÕES
// ===============================================================

document.addEventListener('DOMContentLoaded', function() {
    const controlButtons = document.querySelectorAll('.control-button');

    // Adicionar tooltips que aparecem após 2 segundos de hover
    controlButtons.forEach(button => {
        let timeoutId;

        button.addEventListener('mouseenter', () => {
            timeoutId = setTimeout(() => {
                button.classList.add('show-tooltip');
            }, 2000);  // 2000 milissegundos = 2 segundos
        });

        button.addEventListener('mouseleave', () => {
            clearTimeout(timeoutId);
            button.classList.remove('show-tooltip');
        });
    });
});


document.addEventListener('DOMContentLoaded', function() {
    const exportButton = document.getElementById('export-button');
    
    // Adicionar funcionalidade de exportação
    exportButton.addEventListener('click', exportChat);
    
    // Adicionar animação ao clicar
    exportButton.addEventListener('click', () => {
        exportButton.style.animation = 'bounce 0.5s';
        setTimeout(() => {
            exportButton.style.animation = '';
        }, 500);
    });
    
    // Adicionar tooltip como os outros botões
    let timeoutId;
    exportButton.addEventListener('mouseenter', () => {
        timeoutId = setTimeout(() => {
            exportButton.classList.add('show-tooltip');
        }, 2000);
    });
    
    exportButton.addEventListener('mouseleave', () => {
        clearTimeout(timeoutId);
        exportButton.classList.remove('show-tooltip');
    });
});

// Função para exportar a conversa
function exportChat() {
    // Obter todas as mensagens
    const chatMessages = document.getElementById('chat-messages');
    const messages = chatMessages.querySelectorAll('.message');
    
    // Formatar a conversa para exportação
    let conversationText = "Conversa com GastroAI\n";
    conversationText += "Data: " + new Date().toLocaleDateString() + "\n";
    conversationText += "Hora: " + new Date().toLocaleTimeString() + "\n\n";
    
    messages.forEach(message => {
        const isBot = message.classList.contains('bot');
        const sender = isBot ? "GastroAI" : "Você";
        const timestamp = message.querySelector('.timestamp').textContent;
        // Usar o atributo data-full-text se disponível, caso contrário usar o conteúdo
        const content = message.getAttribute('data-full-text') || 
                       message.querySelector('.message-content').textContent;
        
        conversationText += `[${timestamp}] ${sender}:\n${content}\n\n`;
    });
    
    // Criar arquivo para download
    const blob = new Blob([conversationText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    // Criar elemento de download e clicar nele
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `gastroai-conversa-${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    // Liberar o URL do objeto
    setTimeout(() => URL.revokeObjectURL(url), 100);
}


