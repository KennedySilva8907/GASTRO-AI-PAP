import { listConversations, deleteConversation } from './conversations-api.js';
import { dropCached } from './conversation-cache.js';
import { confirmDeleteConversation } from './confirm-dialog.js';

const COLLAPSED_KEY = 'gastro-sidebar-collapsed';
const UNTITLED = 'Conversa nova';
const FREE_SLOTS = 3;

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeCollapsed(value) {
  try {
    localStorage.setItem(COLLAPSED_KEY, String(value));
  } catch {
    return;
  }
}

function relativeDate(iso) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 7) return `há ${days} dias`;
  if (days < 14) return 'há 1 semana';
  if (days < 31) return `há ${Math.floor(days / 7)} semanas`;
  return new Date(then).toLocaleDateString('pt-PT');
}

function messageLabel(count) {
  return count === 1 ? '1 mensagem' : `${count} mensagens`;
}

function metaText(updatedAt, count) {
  const when = relativeDate(updatedAt);
  return when ? `${when} · ${messageLabel(count)}` : messageLabel(count);
}

function initial(title) {
  return (title || UNTITLED).trim().charAt(0).toUpperCase();
}

function trashIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '13');
  svg.setAttribute('height', '13');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('aria-hidden', 'true');

  const top = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  top.setAttribute('points', '3 6 5 6 21 6');

  const body = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  body.setAttribute(
    'd',
    'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'
  );

  svg.append(top, body);
  return svg;
}

export function initSidebar({ root, scrim, onSelect, onNew }) {
  const list = root.querySelector('.conversation-list');
  const toggle = root.querySelector('.sidebar-toggle');
  const newButton = root.querySelector('.new-chat-button');
  const foot = root.querySelector('.sidebar-foot');
  const footText = root.querySelector('.sidebar-foot-text');

  let collapsed = readCollapsed();
  let activeId = null;
  let plan = 'free';
  let conversationCount = 0;

  function applyCollapsed() {
    root.classList.toggle('is-collapsed', collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.title = collapsed ? 'Mostrar conversas' : 'Minimizar conversas';

    root.querySelectorAll('.conversation-delete, .sidebar-foot-text').forEach((element) => {
      element.setAttribute('tabindex', collapsed ? '-1' : '0');
      element.setAttribute('aria-hidden', String(collapsed));
    });
  }

  function applyPlan() {
    if (!foot) return;

    if (plan === 'pro') {
      foot.hidden = true;
      return;
    }

    foot.hidden = false;
    if (footText) {
      footText.textContent = `${conversationCount} de ${FREE_SLOTS} guardadas no plano free.`;
    }
  }

  function closeDrawer() {
    root.classList.remove('is-open');
    if (scrim) scrim.hidden = true;
  }

  function openDrawer() {
    root.classList.add('is-open');
    if (scrim) scrim.hidden = false;
  }

  function buildItem(conversation) {
    const label = conversation.title || UNTITLED;

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'conversation-item';
    item.dataset.id = conversation.id;
    item.dataset.count = String(conversation.message_count);
    item.title = label;
    item.setAttribute('aria-label', label);
    if (conversation.id === activeId) item.classList.add('is-active');

    const badge = document.createElement('span');
    badge.className = 'conversation-badge';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = initial(conversation.title);

    const text = document.createElement('span');
    text.className = 'conversation-text';

    const title = document.createElement('span');
    title.className = 'conversation-title';
    title.textContent = label;

    const meta = document.createElement('span');
    meta.className = 'conversation-meta';
    meta.textContent = metaText(conversation.updated_at, conversation.message_count);

    const remove = document.createElement('span');
    remove.className = 'conversation-delete';
    remove.setAttribute('role', 'button');
    remove.setAttribute('tabindex', '0');
    remove.setAttribute('title', `Apagar ${label}`);
    remove.setAttribute('aria-label', `Apagar ${label}`);
    remove.appendChild(trashIcon());

    remove.onclick = async (event) => {
      event.stopPropagation();
      if (!(await confirmDeleteConversation(label))) return;

      const position = [...list.children].indexOf(item);
      item.remove();
      conversationCount = Math.max(0, conversationCount - 1);
      applyPlan();
      if (conversation.id === activeId) activeId = null;

      try {
        await deleteConversation(conversation.id);
        dropCached(conversation.id);
      } catch (error) {
        const siblings = list.children;
        if (position >= siblings.length) list.appendChild(item);
        else list.insertBefore(item, siblings[position]);
        conversationCount += 1;
        applyPlan();
        throw error;
      }
    };

    item.addEventListener('click', () => {
      closeDrawer();
      onSelect(conversation.id);
    });

    text.append(title, meta);
    item.append(badge, text, remove);
    return item;
  }

  async function refresh() {
    const conversations = await listConversations();
    conversationCount = conversations.length;
    list.replaceChildren(...conversations.map(buildItem));
    applyCollapsed();
    applyPlan();
    return conversations;
  }

  toggle.addEventListener('click', () => {
    collapsed = !collapsed;
    writeCollapsed(collapsed);
    applyCollapsed();
  });

  newButton.addEventListener('click', () => {
    closeDrawer();
    onNew();
  });

  if (scrim) scrim.addEventListener('click', closeDrawer);

  applyCollapsed();
  applyPlan();

  return {
    refresh,
    bump(id, added = 2) {
      const item = [...list.children].find((child) => child.dataset.id === id);
      if (!item) return;

      const current = Number(item.dataset.count);
      const next = (Number.isNaN(current) ? 0 : current) + added;
      item.dataset.count = String(next);

      const meta = item.querySelector('.conversation-meta');
      if (meta) meta.textContent = metaText(new Date().toISOString(), next);

      list.prepend(item);
    },
    openDrawer,
    closeDrawer,
    setPlan(next) {
      plan = next;
      applyPlan();
    },
    setActive(id) {
      activeId = id;
      list.querySelectorAll('.conversation-item').forEach((item) => {
        item.classList.toggle('is-active', item.dataset.id === id);
      });
    },
    collapse() {
      collapsed = true;
      writeCollapsed(true);
      applyCollapsed();
    },
    expand() {
      collapsed = false;
      writeCollapsed(false);
      applyCollapsed();
    },
    isCollapsed() {
      return collapsed;
    },
  };
}
