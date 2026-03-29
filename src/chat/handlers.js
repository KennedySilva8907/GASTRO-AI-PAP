/**
 * Chat Message Handlers
 * Manages chat UI, message history, API communication, and typing animations
 */

// Chat configuration constants
const MAX_HISTORY = 5;
const MAX_TOKENS = 900;
const TYPING_SPEED = 10;
const MAX_TYPING_TIME = 30000;

// Chat state
let conversationHistory = [];
let isProcessing = false;
let currentTyped = null;
let isTyping = false;
let currentRequest = null;

/**
 * Gets current time formatted as HH:MM
 * @returns {string} Formatted time
 */
function getCurrentTime() {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Toggles input elements enabled/disabled state
 * @param {object} elements - DOM element references
 * @param {boolean} enable - Whether to enable or disable
 */
function toggleInputs(elements, enable) {
  elements.userInput.disabled = !enable;
  elements.submitButton.disabled = !enable;
  elements.submitButton.classList.toggle('disabled', !enable);
}

/**
 * Toggles stop button enabled/disabled state
 * @param {HTMLElement} stopButton - Stop button element
 * @param {boolean} enable - Whether to enable or disable
 */
function toggleStopButton(stopButton, enable) {
  stopButton.disabled = !enable;
  stopButton.classList.toggle('disabled', !enable);
}

/**
 * Toggles clear button enabled/disabled state
 * @param {HTMLElement} clearButton - Clear button element
 * @param {boolean} enable - Whether to enable or disable
 */
function toggleClearButton(clearButton, enable) {
  clearButton.disabled = !enable;
  clearButton.classList.toggle('disabled', !enable);
}

/**
 * Shows typing indicator in chat
 * @param {HTMLElement} chatMessages - Chat messages container
 * @returns {HTMLElement} Typing indicator element
 */
function showTypingIndicator(chatMessages) {
  const typingIndicator = document.createElement('div');
  typingIndicator.classList.add('message', 'bot', 'typing-indicator');

  // Create three span elements for typing animation
  for (let i = 0; i < 3; i++) {
    typingIndicator.appendChild(document.createElement('span'));
  }

  chatMessages.appendChild(typingIndicator);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return typingIndicator;
}

/**
 * Removes typing indicator from chat
 * @param {HTMLElement} chatMessages - Chat messages container
 */
function removeTypingIndicator(chatMessages) {
  const typingIndicator = chatMessages.querySelector('.typing-indicator');
  if (typingIndicator) {
    chatMessages.removeChild(typingIndicator);
  }
}

/**
 * Creates message element structure
 * @param {string} sender - 'user' or 'bot'
 * @param {string} message - Original message text
 * @returns {object} Message element and content element
 */
function createMessageElement(sender, message) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', sender);
  messageElement.setAttribute('data-full-text', message);

  const contentElement = document.createElement('div');
  contentElement.classList.add('message-content');

  const timestamp = document.createElement('span');
  timestamp.classList.add('timestamp');
  timestamp.textContent = getCurrentTime();

  messageElement.appendChild(contentElement);
  messageElement.appendChild(timestamp);

  return { messageElement, contentElement };
}

/**
 * Builds Typed.js options for message animation
 * @param {string} htmlContent - Sanitized HTML content
 * @param {HTMLElement} chatMessages - Chat messages container
 * @param {string} sender - 'user' or 'bot'
 * @param {string} message - Original message text
 * @param {object} elements - DOM element references
 * @param {function} resolve - Promise resolve function
 * @returns {object} Typed.js configuration
 */
function buildTypedOptions(
  htmlContent,
  chatMessages,
  sender,
  message,
  elements,
  resolve
) {
  const typingTime = Math.min(htmlContent.length * TYPING_SPEED, MAX_TYPING_TIME);
  return {
    strings: [htmlContent],
    typeSpeed: typingTime / htmlContent.length,
    showCursor: false,
    contentType: 'html',
    onStringTyped: () => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    },
    preStringTyped: () => {
      isTyping = true;
      toggleStopButton(elements.stopButton, true);
    },
    onComplete: () => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
      isTyping = false;
      if (!isProcessing) {
        toggleStopButton(elements.stopButton, false);
        toggleInputs(elements, true);
      }
      currentTyped = null;
      conversationHistory.push({
        role: sender === 'user' ? 'user' : 'model',
        parts: [{ text: message }]
      });
      if (conversationHistory.length > MAX_HISTORY * 2) {
        conversationHistory.splice(0, 2);
      }
      toggleClearButton(elements.clearButton, true);
      resolve();
    }
  };
}

/**
 * Adds message to chat with typing animation
 * @param {string} sender - 'user' or 'bot'
 * @param {string} message - Message text
 * @param {HTMLElement} chatMessages - Chat messages container
 * @param {function} sanitizeHtml - HTML sanitizer function
 * @param {object} elements - DOM element references
 * @returns {Promise<void>}
 */
function addMessage(sender, message, chatMessages, sanitizeHtml, elements) {
  return new Promise((resolve) => {
    const { messageElement, contentElement } = createMessageElement(
      sender,
      message
    );
    chatMessages.appendChild(messageElement);

    const rawHtml = marked.parse(message);
    const htmlContent = sanitizeHtml(rawHtml);

    const options = buildTypedOptions(
      htmlContent,
      chatMessages,
      sender,
      message,
      elements,
      resolve
    );

    currentTyped = new Typed(contentElement, options);
  });
}

/**
 * Builds API request payload for chatbot
 * @param {string} message - User message
 * @returns {object} API request body
 */
function buildChatRequestPayload(message) {
  return {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: 'Use sempre português de Portugal nas suas respostas. Você é um assistente especializado em gastronomia. Responda apenas a perguntas relacionadas à culinária, receitas, técnicas de cozinha e temas gastronómicos.'
          }
        ]
      },
      {
        role: 'model',
        parts: [
          {
            text: 'Entendido. Sou um assistente especializado em gastronomia e vou responder apenas a perguntas relacionadas à culinária, receitas, técnicas de cozinha e temas gastronómicos, sempre utilizando o português de Portugal.'
          }
        ]
      },
      ...conversationHistory,
      { role: 'user', parts: [{ text: message }] }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: MAX_TOKENS
    },
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      }
    ]
  };
}

/**
 * Fetches chatbot response from API
 * @param {string} message - User message
 * @returns {Promise<string>} Bot response text
 */
async function getChatbotResponse(message) {
  const controller = new AbortController();
  const signal = controller.signal;
  currentRequest = controller;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildChatRequestPayload(message)),
      signal: signal
    });

    if (!response.ok) {
      let errorMsg = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMsg += ` - ${JSON.stringify(errorData)}`;
      } catch (_) {
        // Ignore if error response is not valid JSON
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

/**
 * Handles chat form submission
 * @param {Event} event - Form submit event
 * @param {object} elements - DOM element references
 * @param {function} sanitizeHtml - HTML sanitizer function
 */
async function handleChatSubmit(event, elements, sanitizeHtml) {
  event.preventDefault();
  const message = elements.userInput.value.trim().slice(0, 500);

  if (message && !isProcessing) {
    isProcessing = true;
    elements.userInput.value = '';

    toggleInputs(elements, false);
    toggleStopButton(elements.stopButton, true);

    try {
      await addMessage(
        'user',
        message,
        elements.chatMessages,
        sanitizeHtml,
        elements
      );
      const typingIndicator = showTypingIndicator(elements.chatMessages);

      const botResponse = await getChatbotResponse(message);
      if (typingIndicator && typingIndicator.parentNode) {
        elements.chatMessages.removeChild(typingIndicator);
      }
      await addMessage(
        'bot',
        botResponse,
        elements.chatMessages,
        sanitizeHtml,
        elements
      );
    } catch (error) {
      console.error('Error in chat submission:', error);
      if (error.message !== 'Solicitação cancelada') {
        removeTypingIndicator(elements.chatMessages);
        await addMessage(
          'bot',
          'Desculpe, ocorreu um erro ao processar a sua mensagem. Por favor, tente novamente.',
          elements.chatMessages,
          sanitizeHtml,
          elements
        );
      }
    } finally {
      isProcessing = false;
      if (!isTyping) {
        toggleStopButton(elements.stopButton, false);
        toggleInputs(elements, true);
      }
      elements.userInput.focus();
    }
  }
}

/**
 * Stops current request and typing animation
 * @param {object} elements - DOM element references
 * @param {function} sanitizeHtml - HTML sanitizer function
 */
async function stopCurrentRequest(elements, sanitizeHtml) {
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
  toggleStopButton(elements.stopButton, false);
  toggleInputs(elements, true);

  removeTypingIndicator(elements.chatMessages);

  const lastBotMessage = elements.chatMessages.querySelector(
    '.message.bot:last-child'
  );
  if (
    lastBotMessage &&
    !lastBotMessage.querySelector('.message-content').textContent.trim()
  ) {
    elements.chatMessages.removeChild(lastBotMessage);
  }

  await addMessage(
    'bot',
    'A solicitação foi cancelada. Por favor, digite uma nova pergunta abaixo.',
    elements.chatMessages,
    sanitizeHtml,
    elements
  );
}

/**
 * Clears chat messages and resets conversation
 * @param {object} elements - DOM element references
 * @param {function} sanitizeHtml - HTML sanitizer function
 */
async function clearChat(elements, sanitizeHtml) {
  elements.chatMessages.innerHTML = '';
  conversationHistory = [];
  await addMessage(
    'bot',
    'Olá! Sou o GastroAI, o seu assistente de culinária especializado. Como posso ajudá-lo com questões de gastronomia hoje?',
    elements.chatMessages,
    sanitizeHtml,
    elements
  );
  elements.userInput.value = '';
  elements.userInput.focus();
}

/**
 * Exports chat conversation as text file
 * @param {HTMLElement} chatMessages - Chat messages container
 */
function exportChat(chatMessages) {
  const messages = chatMessages.querySelectorAll('.message');

  let conversationText = 'Conversa com GastroAI\n';
  conversationText += 'Data: ' + new Date().toLocaleDateString() + '\n';
  conversationText += 'Hora: ' + new Date().toLocaleTimeString() + '\n\n';

  messages.forEach((message) => {
    const isBot = message.classList.contains('bot');
    const sender = isBot ? 'GastroAI' : 'Você';
    const timestamp = message.querySelector('.timestamp').textContent;
    const content =
      message.getAttribute('data-full-text') ||
      message.querySelector('.message-content').textContent;

    conversationText += `[${timestamp}] ${sender}:\n${content}\n\n`;
  });

  const blob = new Blob([conversationText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);

  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = `gastroai-conversa-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);

  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Initializes chat handlers and event listeners
 * @param {object} elements - DOM element references
 * @param {function} sanitizeHtml - HTML sanitizer function
 */
export function initChatHandlers(elements, sanitizeHtml) {
  // Form submit handler
  elements.chatForm.addEventListener('submit', (event) => {
    handleChatSubmit(event, elements, sanitizeHtml);
  });

  // Stop button handler
  elements.stopButton.addEventListener('click', () => {
    stopCurrentRequest(elements, sanitizeHtml);
  });

  // Clear button handler
  elements.clearButton.addEventListener('click', () => {
    clearChat(elements, sanitizeHtml);
  });

  // Export button handler
  elements.exportButton.addEventListener('click', () => {
    exportChat(elements.chatMessages);
  });

  // Initialize UI state
  toggleInputs(elements, true);
  toggleStopButton(elements.stopButton, false);
  toggleClearButton(elements.clearButton, false);

  // Initial greeting
  setTimeout(
    () =>
      addMessage(
        'bot',
        'Olá! Sou o GastroAI, o seu assistente de culinária especializado. Como posso ajudá-lo com questões de gastronomia hoje?',
        elements.chatMessages,
        sanitizeHtml,
        elements
      ),
    1000
  );
}
