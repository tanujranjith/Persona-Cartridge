import {
  getSettings, getCartridges, putCartridge, deleteCartridge, newId, buildPrimer, buildMarkdown, fileNameFor,
  attachNote, timeAgo, lockCartridge, unlockCartridge, pinThrottle, pinResult
} from './shared.js';
import { extractChat, injectPrimer, attachFile } from './page-scripts.js';

const IS_PANEL = new URLSearchParams(location.search).has('panel');
if (IS_PANEL) document.documentElement.classList.add('panel');

const $ = (id) => document.getElementById(id);
const COLORS = { ChatGPT: '#10a37f', Claude: '#d97757', Gemini: '#4f7cff', DeepSeek: '#4d6bfe' };
// Pastel cartridge labels: [fill, stroke]
const LABELS = { ChatGPT: ['#d3ecdf', '#b4dcc6'], Claude: ['#f9dfcb', '#efc6a6'], Gemini: ['#d4e6f7', '#b5d1ee'], DeepSeek: ['#e4daf4', '#cebee9'] };
const PASTELS = [['#f6ecc4', '#e8d897'], ['#f5d6dc', '#ebbac4'], ['#d9eee9', '#b8dfd6'], ['#e7e2d8', '#d3ccbd'], ['#dfe3f7', '#c3cbef'], ['#f3dcef', '#e5bfdf']];
const LOGO = {
  ChatGPT: '<svg viewBox="0 0 24 24" style="stroke-width:1.5"><g transform="translate(12 12)"><ellipse rx="3.4" ry="7.6" transform="rotate(0)"/><ellipse rx="3.4" ry="7.6" transform="rotate(60)"/><ellipse rx="3.4" ry="7.6" transform="rotate(120)"/></g></svg>',
  Claude: '<svg viewBox="0 0 24 24" style="stroke:#d97757;stroke-width:2.2"><path d="M12 3.5v6M12 14.5v6M3.5 12h6M14.5 12h6M6 6l4.2 4.2M13.8 13.8 18 18M6 18l4.2-4.2M13.8 10.2 18 6"/></svg>',
  Gemini: '<svg viewBox="0 0 24 24" style="stroke:none"><defs><linearGradient id="gg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f7cff"/><stop offset="1" stop-color="#b56cf0"/></linearGradient></defs><path fill="url(#gg)" d="M12 2c.6 5.4 4.6 9.4 10 10-5.4.6-9.4 4.6-10 10-.6-5.4-4.6-9.4-10-10 5.4-.6 9.4-4.6 10-10z"/></svg>',
  DeepSeek: '<svg viewBox="0 0 24 24" style="stroke:#4d6bfe;stroke-width:1.8"><path d="M3.5 12.5c1.5 4 5 6 9 5.5 4-.5 7-3.5 7.5-8-1.5 1.5-3 2-4.5 1.5M3.5 12.5c2-1 4-1 6 .5M15.5 11.5c-.5-2-2-3.5-4-4"/><circle cx="14.6" cy="13.6" r=".6" fill="#4d6bfe"/></svg>'
};
function hashIdx(s, n) { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % n; }
function labelColors(c) { return LABELS[c.source?.provider] || PASTELS[hashIdx(c.name || c.id, PASTELS.length)]; }
function provLogo(provider) {
  if (LOGO[provider]) return LOGO[provider];
  const ch = (provider || '?').replace(/^www\./, '')[0].toUpperCase();
  return `<span style="font-weight:700;font-size:11px">${ch.replace(/[<&]/g, '')}</span>`;
}
// Cartridge outline: 171x158, chamfered top-right corner, side notch, grip ridges.
const W = 171, H = 158;
function shellSvg(fill, stroke) {
  let ridges = '';
  for (let x = 20; x <= 148; x += 5.4) ridges += `<rect class="ridge" x="${x.toFixed(1)}" y="145" width="2.4" height="8" rx="1"/>`;
  return `<svg class="shell" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <path class="body" d="M10 .5H147L170.5 24V148Q170.5 157.5 161 157.5H10Q.5 157.5 .5 148V130H4.5V114H.5V10Q.5 .5 10 .5Z"/>
    <path class="label" style="--lc:${fill};--ls:${stroke}" d="M20 12H142L158 28V60Q158 68 150 68H20Q12 68 12 60V20Q12 12 20 12Z"/>
    ${ridges}</svg>`;
}
const ICON = {
  lock: '<svg viewBox="0 0 20 20"><rect x="4.5" y="9" width="11" height="8" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/></svg>',
  unlock: '<svg viewBox="0 0 20 20"><rect x="4.5" y="9" width="11" height="8" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 5.8-1"/></svg>',
  edit: '<svg viewBox="0 0 20 20"><path d="M4 16h3l8.5-8.5-3-3L4 13z"/></svg>',
  spark: '<svg viewBox="0 0 20 20"><path d="M10 3v4M10 13v4M3 10h4M13 10h4M5.5 5.5l2 2M12.5 12.5l2 2M5.5 14.5l2-2M12.5 7.5l2-2"/></svg>',
  file: '<svg viewBox="0 0 20 20"><path d="M6 3h5l4 4v10H6z"/><path d="M11 3v4h4"/></svg>',
  trash: '<svg viewBox="0 0 20 20"><path d="M4.5 6h11M8 6V4h4v2M6 6l.7 10h6.6L14 6"/></svg>',
  globe: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6.5"/><path d="M3.5 10h13M10 3.5c2 2.2 2 10.8 0 13M10 3.5c-2 2.2-2 10.8 0 13"/></svg>'
};

let tab = null;
let settings = null;
let all = [];
let shown = [];
let sel = 0;
let query = '';
let current = null; // cartridge open in detail view
const unlocked = new Map(); // id -> decrypted cartridge, this popup session only

/* ---------- small helpers ---------- */
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function toast(msg, bad = false) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.toggle('bad', bad);
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}
function avatar(provider, size) {
  const a = el('div', 'avatar');
  const color = COLORS[provider];
  if (color) { a.style.setProperty('--c', color); a.textContent = provider[0]; }
  else if (provider) { a.style.setProperty('--c', '#2a2a31'); a.textContent = provider.replace(/^www\./, '')[0].toUpperCase(); }
  else a.innerHTML = ICON.globe;
  return a;
}
function status(msg, cls = '') {
  const s = $('status');
  s.className = 'status ' + cls;
  s.textContent = msg;
  s.classList.toggle('hidden', !msg);
}
function canScript(t) {
  return t && t.url && /^https?:/.test(t.url) && !/^https:\/\/chromewebstore\.google\.com/.test(t.url);
}
// The side panel can't lean on activeTab, so make sure we may script this site.
// Known chat sites are granted at install; anything else asks once (needs the click).
function originOf(t) { try { return new URL(t.url).origin + '/*'; } catch (e) { return null; } }
async function hasAccess(t) {
  const o = originOf(t);
  if (!o) return false;
  try { return await chrome.permissions.contains({ origins: [o] }); } catch (e) { return false; }
}
async function ensureAccess(t) {
  const o = originOf(t);
  if (!o) return false;
  try { if (await chrome.permissions.contains({ origins: [o] })) return true; } catch (e) {}
  try { return await chrome.permissions.request({ origins: [o] }); } catch (e) { return false; }
}
async function run(func, args = []) {
  const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func, args });
  return res?.result;
}
// Run in every frame and keep the frame that found the most conversation.
async function runBest(func, args = [], t = tab) {
  let results = [];
  try { results = await chrome.scripting.executeScript({ target: { tabId: t.id, allFrames: true }, func, args }); }
  catch (e) { results = await chrome.scripting.executeScript({ target: { tabId: t.id }, func, args }); }
  const rank = { 'site-reader': 4, 'role-attributes': 3, layout: 2, selection: 1, 'page-text': 0 };
  const score = (r) => {
    if (!r) return -1;
    if (typeof r.count === 'number') return (rank[r.method] || 0) * 1e9 + r.count;
    const chars = (r.messages || []).reduce((n, m) => n + m.text.length, 0);
    return (r.messages?.length ? (rank[r.method] || 0) * 1e9 : 0) + chars;
  };
  const top = results.find((r) => r.frameId === 0)?.result;
  const best = results.map((r) => r.result).filter(Boolean).sort((a, b) => score(b) - score(a))[0];
  if (best && top && best !== top) best.provider = top.provider;
  return best || top;
}
function download(name, text, type = 'text/markdown') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

/* ---------- PIN sheet ---------- */
// mode 'enter' returns the PIN; mode 'set' asks twice and returns it. null if cancelled.
function askPin({ title, sub = '', mode = 'enter', check }) {
  return new Promise((resolve) => {
    const sheet = $('pinSheet'), dots = $('pinDots'), pad = $('pinPad'), subEl = $('pinSub');
    let pin = '', first = null;
    $('pinTitle').textContent = title;
    const setSub = (t, err) => { subEl.textContent = t; subEl.classList.toggle('err', !!err); };
    setSub(sub || (mode === 'set' ? 'Choose 4 to 8 digits' : ''));
    const draw = () => {
      const n = Math.max(4, pin.length);
      dots.replaceChildren(...Array.from({ length: n }, (_, i) => el('i', i < pin.length ? 'on' : '')));
    };
    const shake = (msg) => { setSub(msg, true); dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake'); pin = ''; draw(); };
    const close = (v) => { sheet.classList.add('hidden'); document.removeEventListener('keydown', onKey, true); resolve(v); };
    const submit = async () => {
      if (pin.length < 4) return shake('At least 4 digits');
      if (mode === 'set' && first === null) { first = pin; pin = ''; draw(); $('pinTitle').textContent = 'Confirm PIN'; setSub('Type it once more'); return; }
      if (mode === 'set' && pin !== first) { first = null; $('pinTitle').textContent = title; return shake("PINs didn't match"); }
      if (check) {
        setSub('Checking…');
        const err = await check(pin);
        if (err) return shake(err);
      }
      close(pin);
    };
    const press = (k) => {
      if (k === 'back') pin = pin.slice(0, -1);
      else if (k === 'ok') return submit();
      else if (pin.length < 8) pin += k;
      draw();
    };
    const onKey = (e) => {
      e.stopImmediatePropagation();
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('back');
      else if (e.key === 'Enter') press('ok');
      else if (e.key === 'Escape') close(null);
      else return;
      e.preventDefault();
    };
    pad.replaceChildren();
    for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'ok']) {
      const b = el('button', 'key' + (k.length > 1 ? ' fn' : ''), k === 'back' ? '⌫' : k === 'ok' ? 'Enter' : k);
      b.addEventListener('click', () => press(k));
      pad.appendChild(b);
    }
    $('pinCancel').onclick = () => close(null);
    document.addEventListener('keydown', onKey, true);
    draw();
    sheet.classList.remove('hidden');
  });
}

// The usable cartridge: decrypts locked ones after asking for the PIN.
async function getFull(c, why = 'to use it') {
  if (!c.locked) return c;
  if (unlocked.has(c.id)) return unlocked.get(c.id);
  let full = null;
  const pin = await askPin({
    title: `Unlock “${c.name}”`,
    sub: `Enter the PIN ${why}`,
    check: async (p) => {
      const wait = await pinThrottle(c.id);
      if (wait) return `Too many tries. Wait ${Math.ceil(wait / 1000)}s`;
      try { full = await unlockCartridge(c, p); await pinResult(c.id, true); return null; }
      catch (e) { await pinResult(c.id, false); return 'Wrong PIN'; }
    }
  });
  if (!pin || !full) return null;
  unlocked.set(c.id, full);
  return full;
}

/* ---------- current tab ---------- */
async function detect() {
  const title = $('hereTitle'), sub = $('hereSub'), av = $('hereAvatar');
  if (!canScript(tab)) {
    av.innerHTML = ICON.globe;
    title.textContent = 'Open a chat to save it';
    sub.textContent = 'This page can’t be read';
    $('saveBtn').disabled = true;
    return;
  }
  $('saveBtn').disabled = false;
  if (IS_PANEL && !(await hasAccess(tab))) {
    av.innerHTML = ICON.globe;
    title.textContent = tab.title || new URL(tab.url).hostname;
    sub.textContent = 'Hit Save to let Persona Cartridges read this site';
    return;
  }
  try {
    const d = await runBest(extractChat, [{ detectOnly: true }]);
    av.innerHTML = provLogo(d.provider);
    title.textContent = d.title || (d.supported ? `${d.provider} chat` : d.provider);
    if (d.count) sub.textContent = `${d.provider} · ${d.count} message${d.count === 1 ? '' : 's'} on screen`;
    else if (d.hasSelection) sub.textContent = `${d.provider} · will save your highlight`;
    else sub.textContent = `${d.provider} · will read the page text`;
  } catch (e) {
    title.textContent = 'Can’t read this page';
    sub.textContent = String(e.message || e).slice(0, 60);
    $('saveBtn').disabled = true;
  }
}

async function save() {
  const btn = $('saveBtn');
  if (btn.disabled) return;
  const curTab = tab;
  if (!(await ensureAccess(curTab))) { status('Chrome didn’t allow access to this site, so nothing was saved.', 'err'); return; }
  btn.disabled = true;
  btn.querySelector('.save-label').textContent = 'Reading the whole chat…';
  $('slotLine').classList.add('busy');
  status('Scrolling through the whole chat. Keep this open.');
  try {
    const chat = await runBest(extractChat, [{}], curTab);
    if (!chat || !chat.messages?.length) { status('Found no chat text on this page. Nothing saved.', 'err'); addDebug(chat?.diag); return; }
    const chars = chat.messages.reduce((n, m) => n + m.text.length, 0);
    const c = {
      id: newId(), version: 2,
      name: chat.title || `${chat.provider} chat`,
      createdAt: Date.now(),
      source: { provider: chat.provider, url: chat.url, title: chat.title, method: chat.method },
      status: settings.apiKey ? 'processing' : 'raw',
      transcript: chat.messages,
      stats: { messages: chat.messages.length, chars }
    };
    await putCartridge(c);
    chrome.runtime.sendMessage({ type: 'distill', id: c.id });
    const real = ['site-reader', 'role-attributes', 'layout'].includes(chat.method);
    const what = chat.method === 'selection' ? 'your highlight' : real ? `${c.stats.messages} messages` : `the page text (${Math.round(chars / 1000)}k chars)`;
    status(`Saved ${what}${settings.apiKey ? '. Distilling the persona…' : ' as a raw transcript.'}`, 'ok');
    if (!real) addDebug(chat.diag);
    sel = 0; filter = 'all'; markFilter();
  } catch (e) {
    status('Couldn’t read this page: ' + (e.message || e), 'err');
  } finally {
    btn.disabled = false;
    btn.querySelector('.save-label').textContent = 'Save this chat';
    $('slotLine').classList.remove('busy');
  }
}
function addDebug(diag) {
  if (!diag) return;
  const b = el('button', 'link', 'Copy debug info');
  b.addEventListener('click', async () => { await navigator.clipboard.writeText(JSON.stringify(diag, null, 1)); toast('Debug info copied'); });
  $('status').appendChild(b);
}

/* ---------- load / copy / download ---------- */
async function touch(c) {
  if (c.status === 'processing') return;
  try {
    const fresh = (await getCartridges()).find((x) => x.id === c.id);
    if (fresh) { fresh.lastUsedAt = Date.now(); await putCartridge(fresh); }
  } catch (e) {}
}
async function load(c) {
  const full = await getFull(c, 'to load it');
  if (!full) return;
  touch(c);
  if (full.status === 'processing') toast('Still distilling. Loading the transcript', true);
  if (!canScript(tab)) {
    await navigator.clipboard.writeText(buildPrimer(full, settings)).catch(() => {});
    return toast('Open a chat tab first. Copied as text', true);
  }
  if (!(await ensureAccess(tab))) {
    await navigator.clipboard.writeText(buildPrimer(full, settings)).catch(() => {});
    return toast('No access to this site. Copied as text', true);
  }
  if (settings.loadMode !== 'text') {
    const name = fileNameFor(full);
    const md = buildMarkdown(full, settings);
    try {
      const r = await run(attachFile, [name, md, attachNote(full)]);
      if (r?.ok) return toast(`Attached ${name}. Hit send`);
      if (r?.reason === 'no-composer') return toast('No chat box on this page', true);
    } catch (e) {}
    download(name, md);
    return toast('Site blocked the attach. Drag the downloaded .md in', true);
  }
  const primer = buildPrimer(full, settings);
  await navigator.clipboard.writeText(primer).catch(() => {});
  try {
    const r = await run(injectPrimer, [primer]);
    toast(r?.ok ? 'Loaded. Hit send in the chat' : 'No chat box found. Copied instead', !r?.ok);
  } catch (e) { toast('Copied. Paste it into the chat', true); }
}
async function copyText(c) {
  const full = await getFull(c, 'to copy it');
  if (!full) return;
  await navigator.clipboard.writeText(buildPrimer(full, settings));
  toast('Copied as text');
}
async function downloadMd(c) {
  const full = await getFull(c, 'to download it');
  if (!full) return;
  download(fileNameFor(full), buildMarkdown(full, settings));
  toast('Downloaded ' + fileNameFor(full));
}

/* ---------- import ---------- */
async function importFiles(files) {
  let n = 0;
  for (const f of files) {
    try {
      const text = await f.text();
      if (/\.md$/i.test(f.name)) {
        const title = (text.match(/^# Persona cartridge: (.+)$/m) || text.match(/^# (.+)$/m) || [])[1] || f.name.replace(/(-cartridge)?\.md$/i, '');
        await putCartridge({ id: newId(), version: 2, name: title.trim(), createdAt: Date.now(), source: { provider: 'Imported', method: 'file' }, status: 'raw', transcript: [{ role: 'transcript', text }], stats: { messages: 1, chars: text.length } });
        n++;
        continue;
      }
      const data = JSON.parse(text);
      for (const c of Array.isArray(data) ? data : [data]) {
        if (!c || (!c.persona && !c.transcript && !c.locked)) continue;
        c.id = newId();
        c.createdAt = c.createdAt || Date.now();
        if (c.status === 'processing') c.status = c.persona ? 'ready' : 'raw';
        await putCartridge(c);
        n++;
      }
    } catch (e) {}
  }
  toast(n ? `Imported ${n} cartridge${n === 1 ? '' : 's'}` : 'No cartridges in that file', !n);
}

/* ---------- list view ---------- */
let filter = 'all';
const WEEK = 7 * 864e5;
function card(c, i) {
  const [fill, stroke] = labelColors(c);
  const r = el('div', 'cart' + (i === sel ? ' sel' : ''));
  r.setAttribute('role', 'option');
  r.title = c.persona?.role ? c.persona.role.slice(0, 140) : c.name || '';
  r.innerHTML = shellSvg(fill, stroke);
  if (c.status === 'processing') { const b = el('div', 'cart-badge'); b.appendChild(el('span', 'spin')); b.appendChild(document.createTextNode('Distilling')); r.appendChild(b); }
  else if (c.status === 'error') r.appendChild(el('div', 'cart-badge err', 'Distill failed'));
  else if (c.status === 'raw') r.appendChild(el('div', 'cart-badge', 'Raw'));
  const inn = el('div', 'cart-in');
  inn.appendChild(el('div', 'cart-name', c.name || 'Untitled'));
  const pv = el('div', 'cart-prov');
  const pl = el('span', 'pl'); pl.innerHTML = provLogo(c.source?.provider); pv.appendChild(pl);
  pv.appendChild(el('span', '', c.source?.provider || 'Imported'));
  if (c.locked) { const lk = el('span', 'lk'); lk.innerHTML = ICON.lock; lk.title = 'PIN-locked'; pv.appendChild(lk); }
  inn.appendChild(pv);
  r.appendChild(inn);
  r.appendChild(el('div', 'cart-time', timeAgo(c.lastUsedAt || c.createdAt)));
  const lb = el('button', 'cart-load', 'Load');
  lb.title = 'Load into this chat';
  lb.addEventListener('click', (e) => { e.stopPropagation(); load(c); });
  r.appendChild(lb);
  r.addEventListener('mouseenter', () => { sel = i; markSel(); });
  r.addEventListener('click', () => openDetail(c));
  return r;
}
function markSel() {
  [...$('list').querySelectorAll('.cart')].forEach((r, i) => r.classList.toggle('sel', i === sel));
}
function markFilter() {
  [...$('filters').querySelectorAll('button')].forEach((b) => b.classList.toggle('on', b.dataset.f === filter));
}
function renderList() {
  const q = query.toLowerCase().trim();
  let list = all;
  if (filter === 'locked') list = list.filter((c) => c.locked);
  if (filter === 'recent') list = list.filter((c) => Date.now() - (c.lastUsedAt || c.createdAt || 0) < WEEK).sort((x, y) => (y.lastUsedAt || y.createdAt || 0) - (x.lastUsedAt || x.createdAt || 0));
  if (q) list = list.filter((c) => [c.name, c.source?.provider, c.persona?.role, c.context?.summary].join(' ').toLowerCase().includes(q));
  shown = list;
  sel = Math.min(sel, Math.max(0, shown.length - 1));
  const grid = $('list');
  const nodes = shown.map((c, i) => card(c, i));
  if (all.length && !shown.length) {
    nodes.push(el('div', 'grid-note', q ? `Nothing matches “${query}”` : filter === 'locked' ? 'No locked cartridges. Lock one from its ••• menu.' : 'Nothing used this week.'));
  }
  grid.replaceChildren(...nodes);
  $('empty').classList.toggle('hidden', all.length > 0);
  $('filters').classList.toggle('hidden', all.length === 0);
  grid.classList.toggle('hidden', all.length === 0);
  const s = grid.querySelector('.cart.sel');
  if (s) s.scrollIntoView({ block: 'nearest' });
}
function toggleSearch(on) {
  const w = $('searchWrap');
  on = on ?? w.classList.contains('hidden');
  w.classList.toggle('hidden', !on);
  $('searchBtn').classList.toggle('on', on);
  if (on) $('search').focus();
  else { $('search').value = ''; if (query) { query = ''; renderList(); } }
}

/* ---------- detail view ---------- */
function sec(title, content) {
  const s = el('div', 'sec');
  s.appendChild(el('div', 'sec-h', title));
  if (Array.isArray(content)) {
    const ul = el('ul');
    content.filter(Boolean).forEach((x) => ul.appendChild(el('li', '', x)));
    s.appendChild(ul);
  } else if (content instanceof Node) s.appendChild(content);
  else s.appendChild(el('p', '', content));
  return s;
}
function chip(text, html, color) {
  const c = el('span', 'chip');
  if (color) { const d = el('span', 'd'); d.style.setProperty('--c', color); c.appendChild(d); }
  if (html) c.insertAdjacentHTML('beforeend', html);
  c.appendChild(document.createTextNode(text));
  return c;
}
function renderDetail() {
  const c = all.find((x) => x.id === current) ;
  if (!c) return showList();
  const full = c.locked ? unlocked.get(c.id) : c;
  if (document.activeElement !== $('dName')) $('dName').value = c.name || '';
  const meta = $('dMeta');
  const msgs = c.stats?.messages ?? c.transcript?.length ?? 0;
  const chips = [chip(c.source?.provider || 'Imported', '', COLORS[c.source?.provider] || '#55555f'), chip(`${msgs} msg${msgs === 1 ? '' : 's'}`), chip(timeAgo(c.createdAt))];
  if (c.locked) chips.push(chip(full ? 'Unlocked' : 'Locked', full ? ICON.unlock : ICON.lock));
  if (c.status === 'raw') chips.push(chip('Raw transcript'));
  if (c.distilledWith && c.status === 'ready') chips.push(chip(c.distilledWith.split(' · ').pop()));
  meta.replaceChildren(...chips);

  const body = $('dBody');
  const parts = [];
  if (c.locked && !full) {
    const b = el('div', 'locked-box');
    b.innerHTML = `<div class="lock-ico">${ICON.lock}</div>`;
    b.appendChild(el('div', '', 'This cartridge is PIN-locked and encrypted.'));
    const u = el('button', 'btn', 'Unlock to view');
    u.style.marginTop = '12px';
    u.addEventListener('click', async () => { if (await getFull(c, 'to view it')) renderDetail(); });
    b.appendChild(u);
    parts.push(b);
  } else if (c.status === 'processing') {
    const s = el('div', 'sec');
    s.appendChild(el('div', 'sec-h', 'Distilling the persona'));
    for (const w of [92, 78, 85, 60]) { const k = el('div', 'skel'); k.style.width = w + '%'; s.appendChild(k); }
    parts.push(s);
  } else {
    if (c.status === 'error') parts.push(sec('Distilling failed', c.error || 'Unknown error. Try Re-distill from the menu.'));
    if (full.persona?.role) parts.push(sec('Who the assistant is', full.persona.role));
    if (full.context?.summary) parts.push(sec('Where you left off', full.context.summary));
    if (full.open_threads?.length) parts.push(sec('Still open', full.open_threads.slice(0, 5)));
    if (c.status === 'raw' && !settings.apiKey) parts.push(sec('Raw transcript', 'Loads the whole chat as-is. Add an API key in Settings to distill it into a persona.'));
  }
  if (full) {
    const md = buildMarkdown(full, settings);
    const pre = el('pre', 'md', md.length > 400000 ? md.slice(0, 200000) + '\n\n[… preview trimmed, the file has everything …]\n\n' + md.slice(-200000) : md);
    parts.push(sec(`File preview · ${fileNameFor(full)} · ${Math.max(1, Math.round(md.length / 1000))}k chars`, pre));
  }
  body.replaceChildren(...parts);
}
function openDetail(c) {
  current = c.id;
  $('menu').classList.add('hidden');
  $('listView').classList.add('hidden');
  $('detailView').classList.remove('hidden');
  renderDetail();
}
function showList() {
  current = null;
  $('detailView').classList.add('hidden');
  $('listView').classList.remove('hidden');
  renderList();
}
async function rename(v) {
  const c = all.find((x) => x.id === current);
  v = v.trim();
  if (!c || !v || v === c.name) return;
  c.name = v;
  c.customName = true;
  if (unlocked.has(c.id)) unlocked.get(c.id).name = v;
  await putCartridge(c);
}
function menuItem(label, icon, fn, cls = '') {
  const b = el('button', 'mi ' + cls);
  b.innerHTML = icon;
  b.appendChild(document.createTextNode(label));
  b.addEventListener('click', () => { $('menu').classList.add('hidden'); fn(b); });
  return b;
}
function openMenu() {
  const m = $('menu');
  if (!m.classList.contains('hidden')) return m.classList.add('hidden');
  const c = all.find((x) => x.id === current);
  if (!c) return;
  const items = [menuItem('Rename', ICON.edit, () => { $('dName').focus(); $('dName').select(); })];
  if (settings.apiKey && c.status !== 'processing') {
    items.push(menuItem(c.status === 'ready' ? 'Re-distill' : 'Distill now', ICON.spark, async () => {
      if (c.locked) return toast('Remove the lock to re-distill', true);
      chrome.runtime.sendMessage({ type: 'distill', id: c.id });
    }));
  }
  if (!c.locked) {
    items.push(menuItem('Lock with PIN', ICON.lock, async () => {
      if (c.status === 'processing') return toast('Wait for distilling to finish', true);
      const pin = await askPin({ title: 'Lock with PIN', mode: 'set' });
      if (!pin) return;
      const fresh = (await getCartridges()).find((x) => x.id === c.id) || c;
      unlocked.delete(c.id);
      await putCartridge(await lockCartridge(fresh, pin));
      toast('Locked. You’ll need the PIN to load it');
    }));
  } else {
    items.push(menuItem('Remove lock', ICON.unlock, async () => {
      const full = await getFull(c, 'to remove the lock');
      if (!full) return;
      unlocked.delete(c.id);
      await putCartridge(full);
      toast('Lock removed');
    }));
  }
  items.push(menuItem('Export .json', ICON.file, () => {
    download(fileNameFor(c).replace(/\.md$/, '.json'), JSON.stringify(c, null, 2), 'application/json');
    toast(c.locked ? 'Exported, still encrypted' : 'Exported');
  }));
  items.push(el('div', 'msep'));
  const del = el('button', 'mi danger');
  del.innerHTML = ICON.trash;
  del.appendChild(document.createTextNode('Delete'));
  del.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (c.locked) {
      $('menu').classList.add('hidden');
      const ok = await askPin({ title: 'Delete cartridge?', sub: 'Enter its PIN to delete', check: async (p) => { try { await unlockCartridge(c, p); return null; } catch (er) { return 'Wrong PIN'; } } });
      if (!ok) return;
    } else if (!del.dataset.armed) {
      del.dataset.armed = '1';
      del.lastChild.textContent = 'Click again to delete';
      del.style.color = 'var(--err)';
      return;
    }
    $('menu').classList.add('hidden');
    await deleteCartridge(c.id);
    unlocked.delete(c.id);
    toast('Deleted');
    showList();
  });
  items.push(del);
  m.replaceChildren(...items);
  m.classList.remove('hidden');
}

/* ---------- keyboard ---------- */
function onKey(e) {
  const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName);
  const inDetail = !$('detailView').classList.contains('hidden');
  if (e.key === 'Escape') {
    if (!$('menu').classList.contains('hidden')) { $('menu').classList.add('hidden'); return e.preventDefault(); }
    if (inDetail) { if (typing) document.activeElement.blur(); showList(); return e.preventDefault(); }
    if (!$('searchWrap').classList.contains('hidden')) { toggleSearch(false); return e.preventDefault(); }
    return;
  }
  if (inDetail) {
    if (e.key === 'Enter' && !typing) { const c = all.find((x) => x.id === current); if (c) load(c); e.preventDefault(); }
    if (e.key === 'Backspace' && !typing) showList();
    return;
  }
  if (e.key === '/' && !typing) { toggleSearch(true); return e.preventDefault(); }
  if ((e.key === 's' || e.key === 'S') && !typing && !e.metaKey && !e.ctrlKey) { save(); return e.preventDefault(); }
  if (!shown.length) return;
  const move = { ArrowDown: 2, ArrowUp: -2, ArrowRight: typing ? 0 : 1, ArrowLeft: typing ? 0 : -1 }[e.key];
  if (move) {
    sel = Math.max(0, Math.min(shown.length - 1, sel + move));
    markSel(); $('list').querySelector('.cart.sel')?.scrollIntoView({ block: 'nearest' }); e.preventDefault();
  }
  else if (e.key === 'Enter') { load(shown[sel]); e.preventDefault(); }
  else if (e.key === ' ' && !typing) { openDetail(shown[sel]); e.preventDefault(); }
}

/* ---------- init ---------- */
async function refresh() {
  all = await getCartridges();
  if (current) renderDetail(); else renderList();
}
async function init() {
  settings = await getSettings();
  $('keyDot').classList.toggle('hidden', !!settings.apiKey);
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (IS_PANEL) {
    // The panel stays open as you switch tabs, so keep the "current chat" row in sync.
    let t0 = null;
    const follow = async () => {
      clearTimeout(t0);
      t0 = setTimeout(async () => {
        const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (t) { tab = t; detect(); }
      }, 250);
    };
    chrome.tabs.onActivated.addListener(follow);
    chrome.tabs.onUpdated.addListener((id, info) => { if (tab && id === tab.id && (info.status === 'complete' || info.title)) follow(); });
    chrome.windows?.onFocusChanged?.addListener(follow);
  }
  $('saveBtn').addEventListener('click', save);
  $('openSettings').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', (e) => { importFiles([...e.target.files]); e.target.value = ''; });
  $('search').addEventListener('input', (e) => { query = e.target.value; sel = 0; renderList(); });
  $('searchBtn').addEventListener('click', () => toggleSearch());
  $('filters').addEventListener('click', (e) => { const f = e.target.closest('button')?.dataset.f; if (!f) return; filter = f; sel = 0; markFilter(); renderList(); });
  $('emptyCart').innerHTML = shellSvg('#ffe1d8', '#ffc9b9');
  $('backBtn').addEventListener('click', showList);
  $('moreBtn').addEventListener('click', (e) => { e.stopPropagation(); openMenu(); });
  document.addEventListener('click', (e) => { if (!$('menu').contains(e.target)) $('menu').classList.add('hidden'); });
  $('dName').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('dName').blur(); } e.stopPropagation(); if (e.key === 'Escape') { $('dName').value = all.find((x) => x.id === current)?.name || ''; $('dName').blur(); } });
  $('dName').addEventListener('blur', () => rename($('dName').value));
  $('dLoad').addEventListener('click', () => { const c = all.find((x) => x.id === current); if (c) load(c); });
  $('dCopy').addEventListener('click', () => { const c = all.find((x) => x.id === current); if (c) copyText(c); });
  $('dDownload').addEventListener('click', () => { const c = all.find((x) => x.id === current); if (c) downloadMd(c); });
  document.addEventListener('keydown', onKey);
  chrome.storage.onChanged.addListener(async (ch) => {
    if (ch.settings) { settings = await getSettings(); $('keyDot').classList.toggle('hidden', !!settings.apiKey); }
    if (ch.cartridges) refresh();
  });
  await refresh();
  detect();
}
init();
