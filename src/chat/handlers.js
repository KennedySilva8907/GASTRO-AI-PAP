/**
 * Chat Message Handlers
 * Manages chat UI, message history, API communication, and typing animations
 */

import { handleAsyncError, UserFacingError } from '../shared/errors.js';
import { fetchWithAuth } from '../shared/api-client.js';
import { API_ENDPOINTS } from '../shared/constants.js';
import {
  buildChatRequestPayload,
  extractChatResponseText,
  getTypeSpeed,
  messageForApiError,
  MAX_MESSAGE_LENGTH,
} from './chat-api.js';
import {
  ConversationLimitError,
  createConversation,
  deleteConversation,
  loadConversation,
  requestTitle,
} from './conversations-api.js';
import { askWhichToDelete } from './limit-dialog.js';
import { dropCached, getCached, sameConversation, setCached } from './conversation-cache.js';
import { createPdfButton, readWithProgress } from './pdf-button.js';

// Chat state
let currentConversationId = null;
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
    minute: '2-digit',
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
 * @param {HTMLElement} exportButton - PDF button element
 * @param {boolean} enable - Whether to enable or disable
 */
function togglePdfButton(exportButton, enable) {
  exportButton.disabled = !enable;
  exportButton.classList.toggle('disabled', !enable);
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
function createMessageElement(sender, message, time = getCurrentTime()) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', sender);
  messageElement.setAttribute('data-full-text', message);

  const contentElement = document.createElement('div');
  contentElement.classList.add('message-content');

  const timestamp = document.createElement('span');
  timestamp.classList.add('timestamp');
  timestamp.textContent = time;

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
function buildTypedOptions(htmlContent, chatMessages, sender, message, elements, resolve) {
  return {
    strings: [htmlContent],
    typeSpeed: getTypeSpeed(htmlContent),
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
      resolve();
    },
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
function formatStoredTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return getCurrentTime();
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderStoredMessage(sender, message, chatMessages, sanitizeHtml, createdAt) {
  const { messageElement, contentElement } = createMessageElement(
    sender,
    message,
    formatStoredTime(createdAt)
  );
  contentElement.innerHTML = sanitizeHtml(marked.parse(message));
  messageElement.style.opacity = '1';
  messageElement.style.transform = 'none';
  messageElement.style.animation = 'none';
  chatMessages.appendChild(messageElement);
}

function addMessage(sender, message, chatMessages, sanitizeHtml, elements) {
  return new Promise((resolve) => {
    const { messageElement, contentElement } = createMessageElement(sender, message);
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
 * Fetches chatbot response from the server API
 * @param {string} message - User message
 * @returns {Promise<string>} Bot response text
 */
async function getChatbotResponse(message, conversationId) {
  const controller = new AbortController();
  const signal = controller.signal;
  currentRequest = controller;

  try {
    const response = await fetchWithAuth(API_ENDPOINTS.chat, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildChatRequestPayload(message, conversationId)),
      signal: signal,
    });

    if (!response.ok) {
      let errorData = {};
      try {
        errorData = await response.json();
      } catch {
        errorData = {};
      }
      throw new UserFacingError(
        errorData?.error || `HTTP error! status: ${response.status}`,
        messageForApiError({ code: errorData?.code, status: response.status })
      );
    }

    const data = await response.json();
    return extractChatResponseText(data);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Solicitação cancelada', { cause: error });
    }
    // eslint-disable-next-line no-console
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
  const message = elements.userInput.value.trim().slice(0, MAX_MESSAGE_LENGTH);

  if (message && !isProcessing) {
    isProcessing = true;
    toggleInputs(elements, false);

    let conversationId;
    try {
      conversationId = await ensureConversation();
    } catch (error) {
      isProcessing = false;
      toggleInputs(elements, true);
      if (!error.requiresAuth) {
        handleAsyncError(error, 'Não consegui começar a conversa. Tenta outra vez.');
      }
      return;
    }

    if (!conversationId) {
      isProcessing = false;
      toggleInputs(elements, true);
      elements.userInput.focus();
      return;
    }

    const isFirstMessage = elements.chatMessages.querySelectorAll('.message.user').length === 0;
    elements.userInput.value = '';
    toggleStopButton(elements.stopButton, true);

    try {
      await addMessage('user', message, elements.chatMessages, sanitizeHtml, elements);
      const typingIndicator = showTypingIndicator(elements.chatMessages);

      const botResponse = await getChatbotResponse(message, conversationId);
      if (typingIndicator && typingIndicator.parentNode) {
        elements.chatMessages.removeChild(typingIndicator);
      }
      await addMessage('bot', botResponse, elements.chatMessages, sanitizeHtml, elements);

      togglePdfButton(elements.exportButton, true);
      dropCached(conversationId);
      onConversationsChanged(conversationId);

      if (isFirstMessage) {
        requestTitle(conversationId).then(() =>
          onConversationsChanged(conversationId, { reload: true })
        );
      }
    } catch (error) {
      if (error.requiresAuth) {
        removeTypingIndicator(elements.chatMessages);
        return;
      }
      const userMessage = handleAsyncError(
        error,
        'Desculpe, ocorreu um erro ao processar a sua mensagem. Por favor, tente novamente.'
      );
      if (error.message !== 'Solicitação cancelada') {
        removeTypingIndicator(elements.chatMessages);
        await addMessage('bot', userMessage, elements.chatMessages, sanitizeHtml, elements);
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

  const lastBotMessage = elements.chatMessages.querySelector('.message.bot:last-child');
  if (lastBotMessage && !lastBotMessage.querySelector('.message-content').textContent.trim()) {
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

const GREETING =
  'Olá! Sou o GastroAI, o seu assistente de culinária especializado. Como posso ajudá-lo com questões de gastronomia hoje?';

let onConversationsChanged = () => {};
let pendingConversationLoad = null;

function showConversationLoading(chatMessages) {
  const placeholder = document.createElement('div');
  placeholder.className = 'conversation-loading';
  placeholder.textContent = 'A abrir a conversa...';
  chatMessages.replaceChildren(placeholder);
}

async function startNewConversation(elements, sanitizeHtml) {
  pendingConversationLoad = null;
  currentConversationId = null;
  elements.chatMessages.replaceChildren();
  togglePdfButton(elements.exportButton, false);
  await addMessage('bot', GREETING, elements.chatMessages, sanitizeHtml, elements);
  elements.userInput.value = '';
  elements.userInput.focus();
}

export async function openConversation(id, elements, sanitizeHtml) {
  if (currentTyped) {
    currentTyped.destroy();
    currentTyped = null;
  }
  isTyping = false;

  pendingConversationLoad = id;

  function paint(payload) {
    const { conversation, messages } = payload;
    currentConversationId = conversation.id;
    elements.chatMessages.replaceChildren();

    renderStoredMessage(
      'bot',
      GREETING,
      elements.chatMessages,
      sanitizeHtml,
      conversation.created_at
    );

    for (const message of messages) {
      renderStoredMessage(
        message.role === 'model' ? 'bot' : 'user',
        message.content,
        elements.chatMessages,
        sanitizeHtml,
        message.created_at
      );
    }

    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    togglePdfButton(elements.exportButton, messages.length > 0);
    toggleStopButton(elements.stopButton, false);
    toggleInputs(elements, true);
  }

  const cached = getCached(id);
  if (cached) {
    paint(cached);
    elements.userInput.focus();
  } else {
    showConversationLoading(elements.chatMessages);
  }

  const fresh = await loadConversation(id);
  if (pendingConversationLoad !== id) return;

  setCached(id, fresh);
  if (!cached || !sameConversation(cached, fresh)) {
    paint(fresh);
  }
  elements.userInput.focus();
}

export function resetConversation(elements, sanitizeHtml) {
  return startNewConversation(elements, sanitizeHtml);
}

export function setConversationsChangedHandler(handler) {
  onConversationsChanged = handler;
}

async function ensureConversation() {
  if (currentConversationId) return currentConversationId;

  try {
    const conversation = await createConversation();
    currentConversationId = conversation.id;
    return conversation.id;
  } catch (error) {
    if (!(error instanceof ConversationLimitError)) throw error;

    const chosen = await askWhichToDelete({
      conversations: error.conversations,
      limit: error.limit,
    });
    if (!chosen) return null;

    await deleteConversation(chosen);
    const conversation = await createConversation();
    currentConversationId = conversation.id;
    return conversation.id;
  }
}

function fileNameFromResponse(response) {
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/.exec(disposition);
  return match?.[1] || `gastroai-conversa-${new Date().toISOString().slice(0, 10)}.pdf`;
}

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

async function downloadPdf(conversationId, onProgress) {
  const response = await fetchWithAuth(`${API_ENDPOINTS.conversations}/${conversationId}/pdf`);

  if (!response.ok) {
    let body;
    try {
      body = await response.json();
    } catch {
      body = {};
    }
    throw new UserFacingError(
      body?.error || 'PDF request failed',
      messageForApiError({ code: body?.code, status: response.status })
    );
  }

  const blob = await readWithProgress(response, onProgress);
  saveBlob(blob, fileNameFromResponse(response));
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

  elements.newConversationButton.addEventListener('click', () => {
    startNewConversation(elements, sanitizeHtml);
  });

  const pdfButton = createPdfButton(elements.exportButton);

  elements.exportButton.addEventListener('click', async () => {
    if (!currentConversationId) return;

    pdfButton.start();
    try {
      await downloadPdf(currentConversationId, (percent) => pdfButton.setProgress(percent));
      pdfButton.succeed();
    } catch (error) {
      pdfButton.fail();
      handleAsyncError(error, 'Não consegui gerar o PDF. Tenta outra vez.');
    }
  });

  toggleInputs(elements, true);
  toggleStopButton(elements.stopButton, false);
  togglePdfButton(elements.exportButton, false);

  setTimeout(
    () => addMessage('bot', GREETING, elements.chatMessages, sanitizeHtml, elements),
    1000
  );
}
