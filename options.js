import { PROVIDERS, getSettings, saveSettings } from './shared.js';

const $ = (id) => document.getElementById(id);

function status(msg, cls = '') {
  $('status').textContent = msg;
  $('status').className = 'status ' + cls;
}

function syncProviderUI() {
  const p = PROVIDERS[$('provider').value];
  $('model').placeholder = p.model || 'model name';
  $('baseUrl').placeholder = p.base || 'https://openrouter.ai/api/v1';
  $('baseWrap').style.display = $('provider').value === 'custom' ? '' : 'none';
}

function collect() {
  return {
    provider: $('provider').value,
    apiKey: $('apiKey').value.trim(),
    model: $('model').value.trim(),
    baseUrl: $('provider').value === 'custom' ? $('baseUrl').value.trim() : '',
    maxChars: Math.max(5000, Number($('maxChars').value) || 120000),
    includeTranscript: $('includeTranscript').checked,
    loadMode: $('loadMode').dataset.v || 'file',
    transcriptTurns: Math.min(40, Math.max(1, Number($('transcriptTurns').value) || 6))
  };
}

async function ensurePermission(s) {
  if (s.provider !== 'custom' || !s.baseUrl) return true;
  try {
    const origin = new URL(s.baseUrl).origin + '/*';
    return await chrome.permissions.request({ origins: [origin] });
  } catch (e) {
    return false;
  }
}

async function init() {
  for (const [id, p] of Object.entries(PROVIDERS)) {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = p.label;
    $('provider').appendChild(o);
  }
  const s = await getSettings();
  $('provider').value = s.provider;
  $('apiKey').value = s.apiKey;
  $('model').value = s.model;
  $('baseUrl').value = s.baseUrl;
  $('maxChars').value = s.maxChars;
  $('includeTranscript').checked = s.includeTranscript;
  $('transcriptTurns').value = s.transcriptTurns;
  const setMode = (v) => { $('loadMode').dataset.v = v; [...$('loadMode').children].forEach((b) => b.classList.toggle('on', b.dataset.v === v)); };
  setMode(s.loadMode || 'file');
  $('loadMode').addEventListener('click', (e) => { const v = e.target.dataset?.v; if (v) setMode(v); });
  syncProviderUI();

  $('provider').addEventListener('change', () => { $('model').value = ''; syncProviderUI(); });
  $('toggleKey').addEventListener('click', () => {
    const k = $('apiKey');
    k.type = k.type === 'password' ? 'text' : 'password';
    $('toggleKey').textContent = k.type === 'password' ? 'Show' : 'Hide';
  });
  $('saveBtn').addEventListener('click', async () => {
    const s = collect();
    if (!(await ensurePermission(s))) return status('Permission for that URL was denied.', 'err');
    await saveSettings(s);
    status('Saved', 'ok');
  });
  $('testBtn').addEventListener('click', async () => {
    const s = collect();
    if (!s.apiKey) return status('Paste a key first.', 'err');
    if (!(await ensurePermission(s))) return status('Permission for that URL was denied.', 'err');
    status('Testing…');
    const r = await chrome.runtime.sendMessage({ type: 'testKey', settings: s });
    status(r?.ok ? 'Key works' : 'Failed: ' + (r?.error || 'unknown error'), r?.ok ? 'ok' : 'err');
  });
}

init();
