/* ============================================================
   ELAMA CONSULTING — chat.js
   Native chat widget that talks to the Ignite chatbot API.

   IMPORTANT: Update CHAT_API_BASE for production deployment.
   ============================================================ */

'use strict';

// ---- Configuration ----
// Production chatbot URL — same in dev and prod so 192.168.x.x / file:// also work.
// To use a local API instead, change this to 'http://localhost:3001' temporarily.
const CHAT_API_BASE = 'https://ignite-chatbot-nu.vercel.app';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 min

const STARTER_QUESTIONS = [
  { label: 'Why am I here?',     message: 'Why am I here?' },
  { label: 'Why should I care?', message: 'Why should I care?' },
  { label: "What's the catch?", message: "What's the catch?" },
  { label: 'Send me a 1-page brochure', message: 'Please send me the one pager brochure' },
];

/**
 * Builds the final starter list for the current session.
 * Adds a "Book call with {Agent}" button if visitor came in via an agent's URL.
 */
function getStarterQuestions() {
  const agent = session && session.presetAgent;
  if (!agent || !agent.name) return STARTER_QUESTIONS;
  const firstName = agent.name.split(/\s+/)[0];
  return [
    ...STARTER_QUESTIONS,
    {
      label: `Book call with ${firstName}`,
      message: `I want to book a call with ${firstName}`,
      isBookingCta: true,
    },
  ];
}

// ---- Detect agent from URL (subdomain or ?agent= query param) ----
function detectAgentSlug() {
  // Query param takes precedence (e.g. www.elamaconsulting.com/health-chat?agent=brett)
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('agent');
    if (fromQuery) return fromQuery.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
  } catch {}

  // Subdomain detection (e.g. brett.elamaconsulting.com → "brett")
  const host = window.location.hostname;
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  const parts = host.split('.');
  // Skip naked domains (elamaconsulting.com → 2 parts) and www
  if (parts.length >= 3 && parts[0] !== 'www') {
    return parts[0].toLowerCase();
  }
  return null;
}

const AGENT_SLUG = detectAgentSlug();

// ---- State ----
let session = null; // { userId, sessionId, userName, presetAgent }
let messages = [];
let inactivityTimer = null;
let isLoading = false;

// ---- DOM refs (resolved on init) ----
const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  bindRegisterForm();
});

// ===========================================================
// REGISTRATION (user capture)
// ===========================================================
function bindRegisterForm() {
  const form = $('chatRegisterForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name    = $('chatName').value.trim();
    const company = $('chatCompany').value.trim();
    const email   = $('chatEmail').value.trim();
    const phone   = $('chatPhone').value.trim();
    const errEl   = $('chatRegisterError');
    const btn     = $('chatRegisterBtn');

    errEl.classList.add('d-none');

    if (!name || !company || !email) {
      errEl.textContent = 'Please enter your name, company, and email to continue.';
      errEl.classList.remove('d-none');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errEl.textContent = 'Please enter a valid email address.';
      errEl.classList.remove('d-none');
      return;
    }

    btn.disabled = true;
    const origLabel = btn.textContent;
    btn.textContent = 'Starting your session…';

    try {
      const res = await fetch(`${CHAT_API_BASE}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, company, email, phone: phone || undefined, agentSlug: AGENT_SLUG }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');

      session = {
        userId: data.userId,
        sessionId: data.sessionId,
        userName: name,
        presetAgent: data.presetAgent || null,
      };
      switchToChatView();
      seedWelcomeMessage();
    } catch (err) {
      console.error('[Chat] Register failed:', err);
      errEl.textContent = (err && err.message) ? err.message : 'Something went wrong. Please try again.';
      errEl.classList.remove('d-none');
      btn.disabled = false;
      btn.textContent = origLabel;
    }
  });
}

// ===========================================================
// VIEW SWITCHING
// ===========================================================
function switchToChatView() {
  $('chatRegisterCard').classList.add('d-none');
  $('chatActiveCard').classList.remove('d-none');
  $('chatGreetingName').textContent = session.userName;
  $('chatUserAvatar').textContent = session.userName.charAt(0).toUpperCase();

  // Show "Sent by Brett" badge if visitor came in via an agent's URL
  const badge = $('chatAgentBadge');
  if (badge && session.presetAgent) {
    badge.querySelector('[data-agent-name]').textContent = session.presetAgent.name;
    badge.classList.remove('d-none');
  }

  renderStarters();
  bindChatInput();
  bindInactivityWatchers();
  resetInactivityTimer();
}

function seedWelcomeMessage() {
  const name = session.userName;
  const agent = session.presetAgent;
  const agentLine = agent
    ? `**${agent.name}** asked me to walk you through this.\n\n`
    : '';

  pushAssistant(
    `Hi ${name}.\n\n` +
    agentLine +
    `Most U.S. employers leave **$620+ per W-2 employee per year** in payroll tax savings on the table, ` +
    `plus up to **$3,600 of new benefits per employee at no cost to take-home pay** — all funded through ` +
    `federal tax incentives, not new budget. It's **not an insurance product**; it works alongside your existing insurance.\n\n` +
    `Ask me anything, or tap a Get-To-The-Point button below.`
  );
}

// ===========================================================
// MESSAGE RENDERING
// ===========================================================
function pushAssistant(content) {
  messages.push({ role: 'assistant', content });
  appendMessageDOM('assistant', content);
}
function pushUser(content) {
  messages.push({ role: 'user', content });
  appendMessageDOM('user', content);
}

function appendMessageDOM(role, content) {
  const list = $('chatMessages');
  const wrap = document.createElement('div');
  wrap.className = `chat-msg-row ${role === 'user' ? 'chat-msg-user' : 'chat-msg-assistant'}`;

  if (role === 'assistant') {
    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar chat-avatar-assistant';
    avatar.innerHTML = `<span class="ec-logo-mark" style="gap:2px;">
      <span class="ec-dot ec-dot-1" style="width:4px;height:4px;"></span>
      <span class="ec-dot ec-dot-2" style="width:4px;height:4px;"></span>
      <span class="ec-dot ec-dot-3" style="width:4px;height:4px;"></span>
    </span>`;
    wrap.appendChild(avatar);
  }

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble chat-bubble-${role}`;
  bubble.innerHTML = renderMarkdown(content);
  wrap.appendChild(bubble);

  if (role === 'user') {
    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar chat-avatar-user';
    avatar.textContent = session.userName.charAt(0).toUpperCase();
    wrap.appendChild(avatar);
  }

  list.appendChild(wrap);
  scrollMessagesToBottom();
}

function renderMarkdown(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped
    .split('\n')
    .map(line => {
      let l = line;
      // Bold
      l = l.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      // Links
      l = l.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      // List items
      if (/^[-•]\s/.test(l)) {
        return `<li>${l.replace(/^[-•]\s/, '')}</li>`;
      }
      // Table rows
      if (l.startsWith('|')) {
        const cells = l.split('|').filter(Boolean).map(c => `<td>${c.trim()}</td>`).join('');
        return `<table class="chat-table"><tr>${cells}</tr></table>`;
      }
      if (l.trim() === '') return '<br/>';
      return `<p>${l}</p>`;
    })
    .join('');
}

function scrollMessagesToBottom() {
  const list = $('chatMessages');
  list.scrollTop = list.scrollHeight;
}

// ===========================================================
// STARTERS + INPUT
// ===========================================================
function renderStarters() {
  const container = $('chatStarters');
  container.innerHTML = '';
  getStarterQuestions().forEach(q => {
    const btn = document.createElement('button');
    btn.className = q.isBookingCta ? 'chat-starter chat-starter-cta' : 'chat-starter';
    btn.textContent = q.label;
    btn.addEventListener('click', () => sendMessage(q.message));
    container.appendChild(btn);
  });
}

function bindChatInput() {
  const input = $('chatInput');
  const send  = $('chatSendBtn');

  send.addEventListener('click', () => sendMessage(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input.value);
    }
  });
}

async function sendMessage(text) {
  if (!text || !text.trim() || isLoading || !session) return;

  resetInactivityTimer();

  pushUser(text);
  $('chatInput').value = '';
  setLoading(true);

  try {
    const res = await fetch(`${CHAT_API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        sessionId: session.sessionId,
        userId: session.userId,
        history: messages.slice(0, -1), // exclude the just-pushed user msg, server will add it
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to get response');
    pushAssistant(data.response);
  } catch (err) {
    console.error('[Chat] Send failed:', err);
    pushAssistant(
      "I'm sorry, I hit a technical issue. Please try again in a moment, or " +
      "[book a call](https://www.elamaconsulting.com#contact) directly."
    );
  } finally {
    setLoading(false);
  }
}

function setLoading(loading) {
  isLoading = loading;
  const indicator = $('chatTyping');
  if (loading) {
    indicator.classList.remove('d-none');
    scrollMessagesToBottom();
  } else {
    indicator.classList.add('d-none');
  }
  $('chatSendBtn').disabled = loading;
  $('chatInput').disabled = loading;
}

// ===========================================================
// INACTIVITY HANDLING
// ===========================================================
function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(endSession, INACTIVITY_TIMEOUT_MS);
}

function endSession() {
  if (!session) return;
  // Use sendBeacon-style fetch with keepalive so the request survives navigation
  fetch(`${CHAT_API_BASE}/api/session/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: session.sessionId }),
    keepalive: true,
  }).catch(() => {});
}

function bindInactivityWatchers() {
  window.addEventListener('beforeunload', endSession);
}
