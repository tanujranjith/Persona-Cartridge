// Shared helpers: settings, cartridge storage, primer building.

export const PROVIDERS = {
  openai: { label: 'OpenAI', base: 'https://api.openai.com/v1', model: 'gpt-4.1-mini', kind: 'openai' },
  anthropic: { label: 'Anthropic (Claude)', base: 'https://api.anthropic.com/v1', model: 'claude-haiku-4-5', kind: 'anthropic' },
  gemini: { label: 'Google Gemini', base: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.5-flash', kind: 'gemini' },
  deepseek: { label: 'DeepSeek', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat', kind: 'openai' },
  custom: { label: 'Custom (OpenAI-compatible)', base: '', model: '', kind: 'openai' }
};

export const DEFAULT_SETTINGS = {
  provider: 'openai',
  apiKey: '',
  model: '',
  baseUrl: '',
  maxChars: 120000,
  includeTranscript: false,
  transcriptTurns: 6,
  loadMode: 'file' // 'file' attaches a .md, 'text' pastes the primer
};

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

export async function saveSettings(s) {
  await chrome.storage.local.set({ settings: s });
}

export function resolvedProvider(s) {
  const p = PROVIDERS[s.provider] || PROVIDERS.openai;
  return { ...p, base: (s.baseUrl || p.base).replace(/\/+$/, ''), model: s.model || p.model };
}

export async function getCartridges() {
  const { cartridges } = await chrome.storage.local.get('cartridges');
  return cartridges || [];
}

export async function putCartridge(c) {
  const all = await getCartridges();
  const i = all.findIndex((x) => x.id === c.id);
  if (i >= 0) all[i] = c; else all.unshift(c);
  await chrome.storage.local.set({ cartridges: all });
  return c;
}

export async function deleteCartridge(id) {
  const all = await getCartridges();
  await chrome.storage.local.set({ cartridges: all.filter((c) => c.id !== id) });
}

export function newId() {
  return 'cart_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const list = (arr) => (arr || []).filter(Boolean).map((x) => '- ' + x).join('\n');

export function buildPrimer(c, settings = {}) {
  const src = c.source?.provider ? ` on ${c.source.provider}` : '';
  const out = [];
  out.push(`[PERSONA CARTRIDGE: ${c.name || 'Untitled'}]`);
  out.push(`I'm continuing a conversation I started${src}. Load the context below and continue as if this were the same chat.`);

  if (c.status === 'raw' || !c.persona) {
    out.push('\n## Previous conversation');
    out.push(transcriptText(c.transcript, settings.rawChars || 60000));
    out.push('\nPick up the same role, tone and context the assistant had above. Reply only with a one-line confirmation, then wait for my next message.');
    return out.join('\n');
  }

  const p = c.persona || {};
  out.push('\n## Who you are');
  if (p.role) out.push(p.role);
  if (p.tone) out.push(`Tone and style: ${p.tone}`);
  if (p.rules?.length) out.push('Rules you were following:\n' + list(p.rules));

  const u = c.user || {};
  if (u.facts?.length || u.preferences?.length) {
    out.push('\n## About me');
    if (u.facts?.length) out.push(list(u.facts));
    if (u.preferences?.length) out.push('Preferences:\n' + list(u.preferences));
  }

  const x = c.context || {};
  out.push('\n## Where we are');
  if (x.summary) out.push(x.summary);
  if (x.goals?.length) out.push('Goals:\n' + list(x.goals));
  if (x.decisions?.length) out.push('Decisions made:\n' + list(x.decisions));
  if (x.key_facts?.length) out.push('Key facts:\n' + list(x.key_facts));

  if (c.artifacts?.length) {
    out.push('\n## Important material');
    for (const a of c.artifacts) out.push(`### ${a.label}\n${a.content}`);
  }
  if (c.open_threads?.length) out.push('\n## Still open\n' + list(c.open_threads));

  if (settings.includeTranscript && c.transcript?.length) {
    const tail = c.transcript.slice(-(settings.transcriptTurns || 6));
    out.push('\n## Last few messages, word for word');
    out.push(transcriptText(tail, 20000));
  }
  out.push('\nReply only with a one-line confirmation that you have the context, then wait for my next message.');
  return out.join('\n');
}

export function transcriptText(msgs, maxChars = 120000) {
  const label = (r) => (r === 'user' ? 'USER' : r === 'transcript' ? 'TRANSCRIPT' : 'ASSISTANT');
  const parts = (msgs || []).map((m) => `${label(m.role)}:\n${m.text}`);
  let full = parts.join('\n\n---\n\n');
  if (full.length <= maxChars) return full;
  const head = Math.floor(maxChars * 0.2);
  const tail = maxChars - head;
  return full.slice(0, head) + '\n\n[... middle of conversation trimmed for length ...]\n\n' + full.slice(-tail);
}

export function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 604800) return Math.floor(s / 86400) + 'd ago';
  return new Date(ts).toLocaleDateString();
}

// ---------- Markdown cartridge file ----------

export function slug(name) {
  return (name || 'cartridge').toLowerCase().replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 32) || 'cartridge';
}

export function fileNameFor(c) {
  return `${slug(c.name)}-cartridge.md`;
}

const mdList = (arr) => (arr || []).filter(Boolean).map((x) => '- ' + x).join('\n');

export function buildMarkdown(c, settings = {}) {
  const src = c.source?.provider || 'another AI';
  const when = c.createdAt ? new Date(c.createdAt).toLocaleString() : '';
  const out = [];
  out.push(`# Persona cartridge: ${c.name || 'Untitled'}`);
  out.push(`> Saved from ${src}${when ? ' on ' + when : ''} with Persona Cartridges.`);
  out.push('');
  out.push('## Instructions for the assistant');
  out.push(`This file carries a conversation I had on ${src}. Take on the same role, tone and knowledge the assistant had there, treat everything below as things we already discussed, and continue as if this were the same chat. Do not summarize this file back to me.`);

  if (c.persona && c.status !== 'raw') {
    const p = c.persona;
    out.push('\n## Who you are');
    if (p.role) out.push(p.role);
    if (p.tone) out.push(`\n**Tone and style:** ${p.tone}`);
    if (p.rules?.length) out.push('\n**Rules you were following:**\n' + mdList(p.rules));
    const u = c.user || {};
    if (u.facts?.length || u.preferences?.length) {
      out.push('\n## About me');
      if (u.facts?.length) out.push(mdList(u.facts));
      if (u.preferences?.length) out.push('\n**Preferences:**\n' + mdList(u.preferences));
    }
    const x = c.context || {};
    out.push('\n## Where we left off');
    if (x.summary) out.push(x.summary);
    if (x.goals?.length) out.push('\n**Goals:**\n' + mdList(x.goals));
    if (x.decisions?.length) out.push('\n**Decided:**\n' + mdList(x.decisions));
    if (x.key_facts?.length) out.push('\n**Key facts:**\n' + mdList(x.key_facts));
    if (c.artifacts?.length) {
      out.push('\n## Important material');
      for (const a of c.artifacts) out.push(`\n### ${a.label}\n\n${a.content}`);
    }
    if (c.open_threads?.length) out.push('\n## Still open\n' + mdList(c.open_threads));
  }

  if (c.transcript?.length) {
    out.push('\n## Full conversation');
    const name = (r) => (r === 'user' ? 'Me' : r === 'transcript' ? 'Transcript' : 'Assistant');
    for (const m of c.transcript) out.push(`\n### ${name(m.role)}\n\n${m.text}`);
  }
  return out.join('\n') + '\n';
}

export function attachNote(c) {
  return `I've attached a persona cartridge from a chat I had on ${c.source?.provider || 'another AI'}. Read it, pick up that role and context, reply with a one-line confirmation, then wait for my next message.`;
}

// ---------- PIN locks (AES-GCM, key from PBKDF2 of the PIN) ----------

const LOCKED_FIELDS = ['persona', 'user', 'context', 'artifacts', 'open_threads', 'transcript', 'note'];
const b64 = (buf) => {
  const u = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));

async function pinKey(pin, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function lockCartridge(c, pin) {
  const payload = {};
  for (const f of LOCKED_FIELDS) if (c[f] !== undefined) payload[f] = c[f];
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const iterations = 250000;
  const key = await pinKey(pin, salt, iterations);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(payload)));
  const locked = { ...c };
  for (const f of LOCKED_FIELDS) delete locked[f];
  locked.locked = { v: 1, salt: b64(salt), iv: b64(iv), iterations, data: b64(data) };
  return locked;
}

// Returns the full cartridge, or throws if the PIN is wrong.
export async function unlockCartridge(c, pin) {
  const L = c.locked;
  const key = await pinKey(pin, unb64(L.salt), L.iterations);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(L.iv) }, key, unb64(L.data));
  const payload = JSON.parse(new TextDecoder().decode(plain));
  const full = { ...c, ...payload };
  delete full.locked;
  return full;
}

// Slow down guessing: 5 wrong PINs locks that cartridge for 30s, doubling after.
export async function pinThrottle(id) {
  const { pinFails = {} } = await chrome.storage.local.get('pinFails');
  const f = pinFails[id] || { n: 0, until: 0 };
  return Math.max(0, f.until - Date.now());
}
export async function pinResult(id, ok) {
  const { pinFails = {} } = await chrome.storage.local.get('pinFails');
  if (ok) delete pinFails[id];
  else {
    const f = pinFails[id] || { n: 0, until: 0 };
    f.n++;
    if (f.n >= 5) f.until = Date.now() + 30000 * Math.pow(2, Math.floor((f.n - 5) / 5));
    pinFails[id] = f;
  }
  await chrome.storage.local.set({ pinFails });
}
