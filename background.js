// Service worker: turns a transcript into a persona cartridge with the user's own API key.
// Runs here (not in the popup) so the work finishes even if the popup closes.
import { getSettings, resolvedProvider, putCartridge, getCartridges, transcriptText } from './shared.js';

const SYSTEM = `You convert an AI chat transcript into a portable "persona cartridge" so the conversation can continue on a different AI provider.
Return ONLY a JSON object, no prose, with exactly these keys:
{
  "name": "short descriptive title, max 6 words",
  "persona": {
    "role": "2-4 sentences, in second person ('You are...'), describing the role, expertise and behavior the ASSISTANT had in this chat, including any persona the user asked it to play",
    "tone": "one line on voice, style, formatting and length habits",
    "rules": ["explicit instructions or constraints the user gave the assistant that still apply"]
  },
  "user": {
    "facts": ["facts the user shared about themselves or their situation"],
    "preferences": ["how the user likes answers, things they liked or rejected"]
  },
  "context": {
    "summary": "3-6 sentences on what the conversation was about and where it ended",
    "goals": ["what the user is trying to achieve"],
    "decisions": ["conclusions or choices already settled"],
    "key_facts": ["important specifics: names, numbers, versions, constraints"]
  },
  "artifacts": [{ "label": "short name", "content": "verbatim code, text or data the user will still need (keep code exact; latest version only)" }],
  "open_threads": ["unanswered questions or next steps"]
}
Be faithful: never invent facts. Use [] for empty lists. Keep artifacts verbatim but drop superseded versions. If the transcript is one unlabeled block of page text, infer who said what.`;

function parseJSON(text) {
  let t = (text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch (e) {}
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error('The AI did not return valid JSON.');
}

async function readError(res) {
  let body = '';
  try { body = await res.text(); } catch (e) {}
  let msg = body;
  try { const j = JSON.parse(body); msg = j.error?.message || j.message || body; } catch (e) {}
  return `${res.status}: ${String(msg).slice(0, 240)}`;
}

async function callLLM(settings, system, user) {
  const p = resolvedProvider(settings);
  if (!settings.apiKey) throw new Error('No API key set.');
  if (p.kind === 'anthropic') {
    const res = await fetch(`${p.base}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({ model: p.model, max_tokens: 8000, temperature: 0.2, system, messages: [{ role: 'user', content: user }] })
    });
    if (!res.ok) throw new Error(await readError(res));
    const j = await res.json();
    return (j.content || []).map((c) => c.text || '').join('');
  }
  if (p.kind === 'gemini') {
    const res = await fetch(`${p.base}/models/${encodeURIComponent(p.model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': settings.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
      })
    });
    if (!res.ok) throw new Error(await readError(res));
    const j = await res.json();
    return (j.candidates?.[0]?.content?.parts || []).map((x) => x.text || '').join('');
  }
  // OpenAI and OpenAI-compatible (DeepSeek, custom)
  const body = { model: p.model, temperature: 0.2, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
  const send = (b) => fetch(`${p.base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${settings.apiKey}` },
    body: JSON.stringify(b)
  });
  let res = await send({ ...body, response_format: { type: 'json_object' } });
  if (res.status === 400) res = await send(body); // some endpoints reject response_format
  if (!res.ok) throw new Error(await readError(res));
  const j = await res.json();
  return j.choices?.[0]?.message?.content || '';
}

async function distill(id) {
  const settings = await getSettings();
  const all = await getCartridges();
  const c = all.find((x) => x.id === id);
  if (!c || c.locked) return;
  if (!settings.apiKey) {
    c.status = 'raw';
    c.note = 'Saved as raw transcript. Add an API key in Settings for a distilled persona.';
    await putCartridge(c);
    return;
  }
  c.status = 'processing';
  c.error = '';
  await putCartridge(c);
  try {
    const user = `Source: ${c.source?.provider || 'unknown'}${c.source?.title ? ` (chat title: "${c.source.title}")` : ''}\n\nTRANSCRIPT:\n\n${transcriptText(c.transcript, settings.maxChars)}`;
    const raw = await callLLM(settings, SYSTEM, user);
    const d = parseJSON(raw);
    const fresh = (await getCartridges()).find((x) => x.id === id);
    if (!fresh || fresh.locked) return;
    Object.assign(fresh, {
      name: fresh.customName ? fresh.name : (d.name || fresh.name),
      persona: d.persona || {},
      user: d.user || {},
      context: d.context || {},
      artifacts: Array.isArray(d.artifacts) ? d.artifacts.filter((a) => a && a.content) : [],
      open_threads: d.open_threads || [],
      status: 'ready',
      distilledWith: `${resolvedProvider(settings).label} · ${resolvedProvider(settings).model}`,
      error: ''
    });
    await putCartridge(fresh);
  } catch (e) {
    const fresh = (await getCartridges()).find((x) => x.id === id);
    if (!fresh || fresh.locked) return;
    fresh.status = 'error';
    fresh.error = String(e.message || e);
    await putCartridge(fresh);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'distill') {
    distill(msg.id);
    sendResponse({ ok: true });
  }
  if (msg?.type === 'testKey') {
    getSettings()
      .then((s) => callLLM({ ...s, ...msg.settings }, 'Reply with the JSON {"ok":true} only.', 'ping'))
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e.message || e) }));
    return true;
  }
  return false;
});

// Clicking the toolbar icon opens the side panel (next to the chat) instead of a popup.
function panelOnClick() {
  if (chrome.sidePanel?.setPanelBehavior) chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}
chrome.runtime.onInstalled.addListener(panelOnClick);
chrome.runtime.onStartup.addListener(panelOnClick);
panelOnClick();
