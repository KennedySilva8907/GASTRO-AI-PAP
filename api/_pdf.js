import { readFileSync } from 'node:fs';
import PDFDocument from 'pdfkit';
import { marked } from 'marked';

const EMOJI = new RegExp(
  [
    '[\\u{1F000}-\\u{1FAFF}]',
    '[\\u{2600}-\\u{27BF}]',
    '[\\u{FE00}-\\u{FE0F}]',
    '[\\u{1F1E6}-\\u{1F1FF}]',
    '[\\u{2B00}-\\u{2BFF}]',
    '\\u{200D}',
  ].join('|'),
  'gu'
);

export function stripEmoji(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(EMOJI, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function plainText(token) {
  const raw = typeof token?.text === 'string' ? token.text : '';
  return stripEmoji(raw.replace(/[*_`]/g, ''));
}

export function markdownToBlocks(markdown) {
  if (typeof markdown !== 'string' || !markdown.trim()) return [];

  const blocks = [];

  for (const token of marked.lexer(markdown)) {
    if (token.type === 'heading') {
      const text = plainText(token);
      if (text) blocks.push({ type: 'heading', text });
    } else if (token.type === 'list') {
      const items = token.items.map((item) => plainText(item)).filter(Boolean);
      if (items.length) blocks.push({ type: 'list', ordered: Boolean(token.ordered), items });
    } else if (token.type === 'code') {
      const text = stripEmoji(token.text);
      if (text) blocks.push({ type: 'code', text });
    } else if (token.type === 'blockquote') {
      const text = plainText(token);
      if (text) blocks.push({ type: 'quote', text });
    } else if (token.type === 'table') {
      const text = stripEmoji(token.raw.replace(/[|*_`]/g, ' '));
      if (text) blocks.push({ type: 'paragraph', text });
    } else if (token.type === 'paragraph' || token.type === 'text') {
      const text = plainText(token);
      if (text) blocks.push({ type: 'paragraph', text });
    }
  }

  return blocks;
}

export function slugify(title) {
  const slug = String(title ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '');

  return slug || 'conversa';
}

export function signerName(user) {
  const registered = user?.claims?.user_metadata?.name;
  const trimmed = typeof registered === 'string' ? registered.trim() : '';
  if (trimmed) return trimmed;

  const local = typeof user?.email === 'string' ? user.email.split('@')[0] : '';
  if (!local) return 'Utilizador';
  return local.charAt(0).toUpperCase() + local.slice(1);
}

const PAPER = '#fff8ef';
const INK = '#1f2937';
const MUTED = '#7b6557';
const ACCENT = '#ff9800';
const ACCENT_INK = '#9a3412';
const USER_RULE = '#b09a8a';
const TITLE_INK = '#241810';
const NAME_INK = '#3d2d23';
const FOOTER_RULE = '#e8d9c9';

const MARGIN = 56;

function registerFonts(doc) {
  doc.registerFont('body', readFileSync(new URL('./_fonts/Poppins-Regular.ttf', import.meta.url)));
  doc.registerFont(
    'bodyBold',
    readFileSync(new URL('./_fonts/Poppins-SemiBold.ttf', import.meta.url))
  );
  doc.registerFont(
    'display',
    readFileSync(new URL('./_fonts/CormorantGaramond-SemiBold.ttf', import.meta.url))
  );
}

function paintPage(doc) {
  doc.save();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(PAPER);
  doc.restore();
}

function longDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
}

function shortTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

function messageCountLabel(total) {
  return total === 1 ? '1 mensagem' : `${total} mensagens`;
}

function drawMasthead(doc, { conversation, messages, userName, width }) {
  doc.font('display').fontSize(15).fillColor(ACCENT_INK);
  doc.text('G A S T R O A I', MARGIN, MARGIN, { width, characterSpacing: 1 });

  doc.moveDown(0.25);
  doc.font('display').fontSize(28).fillColor(TITLE_INK);
  doc.text(conversation.title || 'Conversa', { width });

  const meta = [longDate(conversation.created_at), messageCountLabel(messages.length), userName]
    .filter(Boolean)
    .join('  ·  ');

  doc.moveDown(0.2);
  doc.font('body').fontSize(8.5).fillColor(MUTED);
  doc.text(meta, { width });

  doc.moveDown(0.7);
  const ruleY = doc.y;
  doc.save();
  doc
    .moveTo(MARGIN, ruleY)
    .lineTo(MARGIN + width, ruleY)
    .lineWidth(2)
    .stroke(ACCENT);
  doc.restore();
  doc.y = ruleY + 16;
}

function drawBlocks(doc, blocks, { left, width }) {
  for (const block of blocks) {
    if (block.type === 'heading') {
      doc.moveDown(0.35);
      doc.font('bodyBold').fontSize(10).fillColor(ACCENT_INK);
      doc.text(block.text, left, doc.y, { width });
    } else if (block.type === 'list') {
      doc.font('body').fontSize(9.5).fillColor(INK);
      block.items.forEach((item, index) => {
        const bullet = block.ordered ? `${index + 1}.` : '•';
        doc.text(`${bullet}   ${item}`, left + 8, doc.y, { width: width - 8, indent: 0 });
        doc.moveDown(0.15);
      });
    } else if (block.type === 'code') {
      doc.font('body').fontSize(8.5).fillColor(MUTED);
      doc.text(block.text, left + 8, doc.y, { width: width - 8 });
    } else if (block.type === 'quote') {
      doc.font('body').fontSize(9.5).fillColor(MUTED);
      doc.text(block.text, left + 8, doc.y, { width: width - 8 });
    } else {
      doc.font('body').fontSize(9.5).fillColor(INK);
      doc.text(block.text, left, doc.y, { width });
    }
    doc.moveDown(0.4);
  }
}

function drawMessage(doc, message, { userName, width }) {
  const left = MARGIN + 13;
  const textWidth = width - 13;
  const isBot = message.role === 'model';
  const startPage = doc.bufferedPageRange().count;
  const top = doc.y;

  doc
    .font('bodyBold')
    .fontSize(9)
    .fillColor(isBot ? ACCENT_INK : NAME_INK);
  doc.text(isBot ? 'GastroAI' : userName, left, doc.y, { width: textWidth, continued: false });

  const headingY = doc.y;
  doc.font('body').fontSize(8).fillColor(MUTED);
  doc.text(shortTime(message.created_at), left, headingY - 11, {
    width: textWidth,
    align: 'right',
  });
  doc.y = headingY;
  doc.moveDown(0.25);

  drawBlocks(doc, markdownToBlocks(message.content), { left, width: textWidth });

  const endPage = doc.bufferedPageRange().count;
  if (endPage === startPage) {
    doc.save();
    doc
      .moveTo(MARGIN, top)
      .lineTo(MARGIN, doc.y - 4)
      .lineWidth(2)
      .stroke(isBot ? ACCENT : USER_RULE);
    doc.restore();
  }

  doc.moveDown(0.6);
}

function drawFooters(doc, width) {
  const range = doc.bufferedPageRange();

  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    doc.page.margins.bottom = 0;

    const y = doc.page.height - MARGIN + 14;

    doc.save();
    doc
      .moveTo(MARGIN, y - 10)
      .lineTo(MARGIN + width, y - 10)
      .lineWidth(0.5)
      .stroke(FOOTER_RULE);
    doc.restore();

    doc.font('body').fontSize(7.5).fillColor(MUTED);
    doc.text('GastroAI', MARGIN, y, { width: width / 2, lineBreak: false });
    doc.text(`${i + 1} de ${range.count}`, MARGIN + width / 2, y, {
      width: width / 2,
      align: 'right',
      lineBreak: false,
    });
  }
}

export function renderConversationPdf({ conversation, messages, userName }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const width = doc.page.width - MARGIN * 2;

    registerFonts(doc);
    doc.on('pageAdded', () => paintPage(doc));
    paintPage(doc);

    drawMasthead(doc, { conversation, messages, userName, width });

    for (const message of messages) {
      drawMessage(doc, message, { userName, width });
    }

    drawFooters(doc, width);
    doc.end();
  });
}
