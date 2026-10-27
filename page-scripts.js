// Functions injected into the chat tab with chrome.scripting.executeScript.
// Each one must be fully self-contained (no outside variables).
// All site selectors live in SITES inside extractChat, so a layout change is a one-place fix.

export async function extractChat(opts) {
  opts = opts || {};
  const SITES = [
    {
      name: 'ChatGPT',
      match: /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/,
      strategies: [
        { sel: 'article[data-turn], section[data-turn]', role: (e) => e.getAttribute('data-turn'), content: '[data-message-author-role] .markdown, [data-message-author-role] .whitespace-pre-wrap, .markdown, .whitespace-pre-wrap' },
        { sel: '[data-message-author-role]', role: (e) => e.getAttribute('data-message-author-role'), content: '.markdown, .whitespace-pre-wrap' },
        { sel: '[data-testid^="conversation-turn"]', role: (e) => e.getAttribute('data-turn') || e.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role') || (e.querySelector('[data-message-author-role="user"], .user-message-bubble-color') ? 'user' : 'assistant'), content: '.markdown, .whitespace-pre-wrap' },
        { sel: '[data-turn]', role: (e) => e.getAttribute('data-turn'), content: '.markdown, .whitespace-pre-wrap' },
        { sel: '[data-message-id]', role: (e) => e.getAttribute('data-message-author-role') || e.closest('[data-turn]')?.getAttribute('data-turn') || (e.querySelector('.markdown') ? 'assistant' : 'user'), content: '.markdown, .whitespace-pre-wrap' }
      ],
      busy: () => !!document.querySelector('button[data-testid="stop-button"], button[aria-label*="Stop"]'),
      scroller: () => document.querySelector('main [class*="overflow-y-auto"]') || document.querySelector('main')
    },
    {
      name: 'Claude',
      match: /(^|\.)claude\.ai$/,
      strategies: [
        { sel: '[data-testid="user-message"], .font-claude-response', role: (e) => (e.matches('[data-testid="user-message"]') ? 'user' : 'assistant'), content: null },
        { sel: '[data-testid="user-message"], div[data-is-streaming]', role: (e) => (e.matches('[data-testid="user-message"]') ? 'user' : 'assistant'), content: '.standard-markdown, .font-claude-response' }
      ],
      busy: () => !!document.querySelector('[data-is-streaming="true"]'),
      scroller: () => document.querySelector('[data-testid="chat-scroll-container"]') || document.querySelector('main .overflow-y-auto') || document.querySelector('main')
    },
    {
      name: 'Gemini',
      match: /(^|\.)gemini\.google\.com$/,
      strategies: [
        { sel: 'user-query, model-response', role: (e) => (e.tagName.toLowerCase() === 'user-query' ? 'user' : 'assistant'), content: '.query-text, message-content, .markdown' }
      ],
      busy: () => !!document.querySelector('button[aria-label*="Stop"]'),
      scroller: () => document.querySelector('infinite-scroller') || document.querySelector('#chat-history') || document.querySelector('main')
    },
    {
      name: 'DeepSeek',
      match: /(^|\.)deepseek\.com$/,
      strategies: [
        { sel: '.ds-message', role: (e) => (e.querySelector('.ds-markdown') ? 'assistant' : 'user'), content: null, assistantContent: '.ds-markdown:not(.ds-think-content .ds-markdown):not(.ds-think-content)' }
      ],
      busy: () => false,
      scroller: () => document.querySelector('.ds-scroll-area') || document.querySelector('main')
    },
    {
      name: 'Hark',
      match: /(^|\.)hark\.com$/,
      strategies: [
        { sel: '[data-message-role], [data-role="user"], [data-role="assistant"], [data-sender], [data-author]', role: (e) => e.getAttribute('data-message-role') || e.getAttribute('data-role') || e.getAttribute('data-sender') || e.getAttribute('data-author'), content: null }
      ],
      busy: () => !!document.querySelector('button[aria-label*="Stop" i]'),
      scroller: () => null
    },
    {
      name: 'Copilot',
      match: /(^|\.)copilot\.microsoft\.com$|(^|\.)m365\.cloud\.microsoft$/,
      strategies: [
        { sel: '[data-content="user-message"], [data-content="ai-message"]', role: (e) => (e.getAttribute('data-content') === 'user-message' ? 'user' : 'assistant'), content: null },
        { sel: '[class*="user-message"], [class*="ai-message"]', role: (e) => (/user-message/.test(e.className) ? 'user' : 'assistant'), content: null }
      ],
      busy: () => !!document.querySelector('button[aria-label*="Stop" i]'),
      scroller: () => null
    },
    {
      name: 'Perplexity',
      match: /(^|\.)perplexity\.ai$/,
      strategies: [
        { sel: '[class*="group/query"], [id^="markdown-content"]', role: (e) => (e.matches('[id^="markdown-content"]') ? 'assistant' : 'user'), content: null },
        { sel: 'h1[class*="query"], .prose', role: (e) => (e.matches('.prose') ? 'assistant' : 'user'), content: null }
      ],
      busy: () => !!document.querySelector('button[aria-label*="Stop" i]'),
      scroller: () => null
    },
    {
      name: 'Grok',
      match: /(^|\.)grok\.com$/,
      strategies: [
        { sel: '.message-bubble', role: (e) => (e.closest('.items-end') ? 'user' : 'assistant'), content: null }
      ],
      busy: () => !!document.querySelector('button[aria-label*="Stop" i]'),
      scroller: () => null
    },
    {
      name: 'Mistral',
      match: /(^|\.)chat\.mistral\.ai$/,
      strategies: [
        { sel: '[data-message-author-role]', role: (e) => e.getAttribute('data-message-author-role'), content: null }
      ],
      busy: () => false,
      scroller: () => null
    },
    {
      name: 'Poe',
      match: /(^|\.)poe\.com$/,
      strategies: [
        { sel: '[class*="Message_humanMessageBubble"], [class*="Message_botMessageBubble"]', role: (e) => (/humanMessage/.test(e.className) ? 'user' : 'assistant'), content: '[class*="Markdown_markdownContainer"]' }
      ],
      busy: () => false,
      scroller: () => null
    },
    {
      name: 'Kimi',
      match: /(^|\.)kimi\.(com|ai)$|(^|\.)moonshot\.cn$/,
      strategies: [
        { sel: '.chat-content-item-user, .chat-content-item-assistant', role: (e) => (e.classList.contains('chat-content-item-user') ? 'user' : 'assistant'), content: null }
      ],
      busy: () => false,
      scroller: () => null
    },
    {
      name: 'Qwen',
      match: /(^|\.)chat\.qwen\.ai$|(^|\.)qwen\.ai$/,
      strategies: [
        { sel: '.user-message, .response-message-content, [class*="chat-user-message"], [class*="chat-response-message"]', role: (e) => (/user/.test(e.className) ? 'user' : 'assistant'), content: null }
      ],
      busy: () => false,
      scroller: () => null
    },
    {
      name: 'HuggingChat',
      match: /(^|\.)huggingface\.co$/,
      strategies: [
        { sel: '[data-message-role], [data-message-type]', role: (e) => e.getAttribute('data-message-role') || e.getAttribute('data-message-type'), content: null }
      ],
      busy: () => false,
      scroller: () => null
    },
    {
      name: 'Meta AI',
      match: /(^|\.)meta\.ai$/,
      strategies: [],
      busy: () => false,
      scroller: () => null
    },
    {
      name: 'Pi',
      match: /(^|\.)pi\.ai$/,
      strategies: [],
      busy: () => false,
      scroller: () => null
    },
    {
      name: 'Character.AI',
      match: /(^|\.)character\.ai$/,
      strategies: [],
      busy: () => false,
      scroller: () => null
    }
  ];

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const host = location.hostname;
  const site = SITES.find((s) => s.match.test(host));

  // querySelectorAll that also looks inside open shadow roots.
  function deepAll(sel, root) {
    root = root || document;
    const out = [];
    const visit = (r) => {
      r.querySelectorAll(sel).forEach((e) => out.push(e));
      r.querySelectorAll('*').forEach((e) => { if (e.shadowRoot) visit(e.shadowRoot); });
    };
    visit(root);
    return [...new Set(out)];
  }

  // The element that actually scrolls the conversation: the biggest scrollable box on the page.
  function findScroller(hint) {
    if (hint && hint.scrollHeight > hint.clientHeight + 40) return hint;
    let best = null, bestH = 0;
    for (const e of deepAll('div, main, section, infinite-scroller')) {
      if (e.scrollHeight <= e.clientHeight + 40 || e.clientHeight < 200) continue;
      const oy = getComputedStyle(e).overflowY;
      if (oy !== 'auto' && oy !== 'scroll') continue;
      if (e.closest('nav, aside')) continue;
      if (e.clientHeight * e.clientWidth > bestH) { best = e; bestH = e.clientHeight * e.clientWidth; }
    }
    return best || document.scrollingElement;
  }

  function diagnostics() {
    const probe = ['article', '[data-turn]', '[data-message-author-role]', '[data-message-id]', '[data-testid^="conversation-turn"]', '.markdown', 'user-query', '[data-testid="user-message"]', '.ds-message', 'main', 'iframe'];
    const counts = {};
    for (const p of probe) counts[p] = deepAll(p).length;
    let shadowHosts = 0;
    document.querySelectorAll('*').forEach((e) => { if (e.shadowRoot) shadowHosts++; });
    const testids = {};
    deepAll('[data-testid]').forEach((e) => { const t = e.getAttribute('data-testid').replace(/\d+/g, 'N'); testids[t] = (testids[t] || 0) + 1; });
    return { url: location.href.split('?')[0], frame: window === window.top ? 'top' : 'child', counts, shadowHosts, testids: Object.entries(testids).sort((a, b) => b[1] - a[1]).slice(0, 15), bodyText: (document.body?.innerText || '').length };
  }

  const NOISE = /^(copy|copy code|retry|edit|share|regenerate|you said:?|chatgpt said:?|show thinking|thought for .*|thinking\.{0,3}|searching.*|analyzing.*|like|dislike|read aloud|good response|bad response|more actions|chatgpt can make mistakes.*|(today|yesterday)( at)? \d{1,2}:\d{2}( ?[ap]m)?|edit message|share|open in canvas|\d{1,2}:\d{2}\s?[ap]\.?m\.?|[a-z]{3,9}\.? ?\d{1,2},? ?\d{1,2}:\d{2}\s?[ap]\.?m\.?|(monday|tuesday|wednesday|thursday|friday|saturday|sunday), [a-z]+ \d{1,2}(, \d{4})?|(today|yesterday)|show more|show less|see more|read more)$/i;

  // Convert a message node into clean text without touching the page.
  // Keeps code blocks as fenced code, lists as bullets, skips buttons and hidden thinking.
  const SKIP = 'button, svg, style, script, noscript, template, [hidden], [aria-hidden="true"], .sr-only, model-thoughts, .ds-think-content, [data-testid="action-bar-copy"], [role="toolbar"], nav, aside, textarea, [contenteditable="true"], [role="navigation"], .katex-mathml';
  const BLOCK = /^(P|DIV|SECTION|ARTICLE|UL|OL|TABLE|THEAD|TBODY|TR|BLOCKQUOTE|H[1-6]|HR|FIGURE|DETAILS|SUMMARY|MAIN|HEADER|FOOTER)$/;
  function walk(n) {
    if (n.nodeType === 3) return n.nodeValue.replace(/\s+/g, ' ');
    if (n.nodeType !== 1) return '';
    if (n.matches(SKIP)) return '';
    const tag = n.tagName;
    if (tag === 'BR') return '\n';
    if (tag === 'PRE') {
      const code = n.querySelector('code') || n;
      const cls = (code.className || '') + ' ' + (n.className || '');
      const m = cls.match(/language-([\w+#.-]+)/);
      let label = m ? m[1] : '';
      if (!label) {
        const head = n.parentElement && n.parentElement.querySelector('[class*="lang"], .code-block-decoration span');
        if (head && head.textContent.trim().length < 20) label = head.textContent.trim().toLowerCase();
      }
      return '\n```' + label + '\n' + code.textContent.replace(/\n$/, '') + '\n```\n';
    }
    if (tag === 'CODE') return '`' + n.textContent + '`';
    if (n.classList.contains('katex') || n.classList.contains('katex-display')) {
      const tex = n.querySelector('annotation[encoding="application/x-tex"]');
      if (tex) return n.classList.contains('katex-display') || n.closest('.katex-display') ? '\n$$' + tex.textContent.trim() + '$$\n' : '$' + tex.textContent.trim() + '$';
    }
    let inner = '';
    const kids = n.shadowRoot ? n.shadowRoot.childNodes : n.childNodes;
    for (const c of kids) inner += walk(c);
    if (tag === 'LI') return '\n- ' + inner.trim() + '\n';
    if (/^H[1-6]$/.test(tag)) return '\n' + '#'.repeat(+tag[1]) + ' ' + inner.trim() + '\n';
    if (tag === 'TD' || tag === 'TH') return inner.trim() + ' | ';
    if (tag === 'TR') return '\n| ' + inner + '\n';
    if (tag === 'IMG') return n.alt ? '[image: ' + n.alt + ']' : '';
    if (BLOCK.test(tag)) return '\n' + inner + '\n';
    return inner;
  }
  function nodeToText(root) {
    return walk(root)
      .split('\n')
      .map((l) => l.replace(/[ \t]+$/g, '').replace(/^ (?=\S)/, ''))
      .filter((l) => !NOISE.test(l.trim()))
      .join('\n')
      .replace(/\u00a0/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\n\n(?=- )/g, '\n')
      .trim();
  }

  function topLevel(els) {
    return els.filter((e) => !els.some((o) => o !== e && o.contains(e)));
  }

  function normRole(r) {
    r = (r || '').toLowerCase();
    if (/user|human|you/.test(r)) return 'user';
    if (/assistant|model|ai|bot|system/.test(r)) return 'assistant';
    return 'assistant';
  }

  function runStrategy(st, given) {
    const els = given || topLevel(deepAll(st.sel));
    const out = [];
    for (const el of els) {
      const role = normRole(st.role(el));
      let node = el;
      const contentSel = role === 'assistant' && st.assistantContent ? st.assistantContent : st.content;
      if (contentSel) {
        const parts = deepAll(contentSel, el);
        const tops = topLevel(parts);
        if (tops.length) {
          const text = tops.map(nodeToText).filter(Boolean).join('\n\n');
          if (text) out.push({ role, text });
          continue;
        }
      }
      const text = nodeToText(node);
      if (text) out.push({ role, text });
    }
    return out;
  }

  function merge(msgs) {
    const out = [];
    for (const m of msgs) {
      const last = out[out.length - 1];
      if (last && last.role === m.role) {
        if (last.text !== m.text) last.text += '\n\n' + m.text;
      } else out.push({ ...m });
    }
    return out;
  }

  function genericExtract() {
    const roleEls = topLevel(deepAll('[data-message-author-role], [data-message-role], [data-turn], [data-role="user"], [data-role="assistant"], [data-author], [data-sender]'));
    if (roleEls.length >= 2) {
      return {
        method: 'role-attributes',
        messages: roleEls
          .map((e) => ({ role: normRole(e.getAttribute('data-message-author-role') || e.getAttribute('data-message-role') || e.getAttribute('data-turn') || e.getAttribute('data-role') || e.getAttribute('data-author') || e.getAttribute('data-sender')), text: nodeToText(e) }))
          .filter((m) => m.text)
      };
    }
    const sel = String(window.getSelection ? window.getSelection() : '').trim();
    if (sel.length > 40) return { method: 'selection', messages: [{ role: 'transcript', text: sel }] };
    const main = deepAll('main, [role="main"]').sort((a, b) => (b.textContent || '').length - (a.textContent || '').length)[0] || document.body;
    const text = nodeToText(main);
    return { method: 'page-text', messages: text ? [{ role: 'transcript', text }] : [] };
  }

  // Generic "layout" reader for UIs with no useful attributes: finds the repeating list of turns
  // inside the scroller and tells user from assistant by position (user bubbles sit to the right).
  function layoutExtract(sc) {
    const root = sc && sc !== document.scrollingElement ? sc : (deepAll('main, [role="main"]')[0] || document.body);
    const meaningful = (e) => {
      if (e.matches(SKIP)) return false;
      const t = (e.innerText ?? e.textContent ?? '').trim();
      return t.length > 0 && !NOISE.test(t);
    };
    let best = null, bestN = 1;
    const cands = [root, ...root.querySelectorAll('div, ol, ul, section, article')];
    for (const e of cands) {
      if (e.children.length < 2 || e.closest('nav, aside, form, footer')) continue;
      let n = 0;
      for (const k of e.children) if (meaningful(k)) n++;
      if (n > bestN || (n === bestN && best && best.contains(e))) { best = e; bestN = n; }
    }
    if (!best || bestN < 2) return [];
    const box = best.getBoundingClientRect();
    const out = [];
    for (const k of best.children) {
      if (!meaningful(k) || k.querySelector('textarea, [contenteditable="true"]')) continue;
      const text = nodeToText(k);
      if (!text) continue;
      // Where the text actually sits: a right-hand bubble is the user. Use the text's own extent,
      // not the wrapper (which is usually full width).
      let r = null;
      try { const rg = document.createRange(); rg.selectNodeContents(k); r = rg.getBoundingClientRect(); } catch (e) {}
      if (!r || !r.width) r = k.getBoundingClientRect();
      let role = 'assistant';
      if (r && r.width && box.width) {
        const left = r.left - box.left, right = r.right - box.left;
        if (left > box.width * 0.25 && right > box.width * 0.55 && r.width < box.width * 0.8) role = 'user';
      }
      out.push({ role, text });
    }
    const users = out.filter((m) => m.role === 'user').length;
    return users && users < out.length ? out : out.map((m) => ({ ...m, role: 'transcript' }));
  }

  function keyFor(el, m) {
    const id = el && (el.getAttribute?.('data-message-id') || el.getAttribute?.('data-turn-id') || el.querySelector?.('[data-message-id]')?.getAttribute('data-message-id'));
    if (id) return 'id:' + id;
    return m.role + ':' + m.text.replace(/\s+/g, ' ').slice(0, 160);
  }

  // What is mounted on the page right now, best reader first.
  function snapshot(sc) {
    if (site) {
      for (const st of site.strategies) {
        const els = topLevel(deepAll(st.sel));
        if (!els.length) continue;
        const msgs = [];
        for (const el of els) {
          const one = runStrategy({ ...st, sel: null }, [el]);
          for (const m of one) msgs.push({ ...m, key: keyFor(el, m) });
        }
        if (msgs.length) return { method: 'site-reader', messages: msgs };
      }
    }
    const roleEls = topLevel(deepAll('[data-message-author-role], [data-message-role], [data-turn], [data-role="user"], [data-role="assistant"], [data-author], [data-sender]'));
    if (roleEls.length >= 2) {
      const msgs = roleEls
        .map((e) => ({ role: normRole(e.getAttribute('data-message-author-role') || e.getAttribute('data-message-role') || e.getAttribute('data-turn') || e.getAttribute('data-role') || e.getAttribute('data-author') || e.getAttribute('data-sender')), text: nodeToText(e), el: e }))
        .filter((m) => m.text)
        .map((m) => ({ role: m.role, text: m.text, key: keyFor(m.el, m) }));
      if (msgs.length) return { method: 'role-attributes', messages: msgs };
    }
    const lay = layoutExtract(sc);
    if (lay.length >= 2) return { method: 'layout', messages: lay.map((m) => ({ ...m, key: keyFor(null, m) })) };
    const g = genericExtract();
    return { method: g.method, messages: g.messages.map((m) => ({ ...m, key: keyFor(null, m) })) };
  }

  // Ordered merge of snapshots taken while scrolling down. Chats unmount off-screen
  // messages, so no single snapshot has everything.
  function mergeInto(acc, index, snap) {
    const flat = (t) => t.replace(/\s+/g, ' ').trim();
    // Same message seen again with slightly different text (a timestamp, a half-rendered card)?
    const near = (m) => {
      const f = flat(m.text);
      if (f.length < 24) return null;
      for (const it of acc) {
        if (it.role !== m.role && it.role !== 'transcript' && m.role !== 'transcript') continue;
        const g = flat(it.text);
        if (g.includes(f) || (f.includes(g) && g.length >= 24)) return it;
      }
      return null;
    };
    let pos = -1, matchedAny = false;
    const pending = [];
    const place = (item) => { acc.splice(pos + 1, 0, item); pos++; };
    const seen = {};
    for (const m of snap) {
      seen[m.key] = (seen[m.key] || 0) + 1;
      const k = m.key + '#' + seen[m.key];
      let hit = index[k] || near(m);
      if (hit) {
        index[k] = hit;
        pos = acc.indexOf(hit);
        if (m.text.length > hit.text.length) hit.text = m.text;
        if (!matchedAny) {
          // Items before the first match belong just before it, not at the top of the chat.
          matchedAny = true;
          let at = pos;
          for (const it of pending) { acc.splice(at, 0, it); at++; }
          pos = acc.indexOf(hit);
          pending.length = 0;
        }
        continue;
      }
      const item = { role: m.role, text: m.text };
      index[k] = item;
      if (!matchedAny && acc.length) pending.push(item);
      else place(item);
    }
    // Nothing in this snapshot matched what we had: it continues after the end.
    for (const it of pending) acc.push(it);
  }

  // Page text has no stable pieces, so stitch successive captures by their overlapping lines.
  function stitchText(a, b) {
    if (!a) return b;
    if (!b || a.includes(b)) return a;
    if (b.includes(a)) return b;
    const la = a.split('\n'), lb = b.split('\n');
    const A = [], B = [];
    la.forEach((x, i) => { const t = x.trim(); if (t) A.push({ t, i }); });
    lb.forEach((x, i) => { const t = x.trim(); if (t) B.push({ t, i }); });
    if (!B.length) return a;
    // Try anchoring each of B's first few lines on every spot in A; keep the longest run.
    let best = null;
    for (let bs = 0; bs < Math.min(6, B.length); bs++) {
      for (let i = 0; i < A.length; i++) {
        if (A[i].t !== B[bs].t) continue;
        let L = 0;
        while (i + L < A.length && bs + L < B.length && A[i + L].t === B[bs + L].t) L++;
        const reachesEnd = i + L >= A.length;
        const score = L + (reachesEnd ? 3 : 0);
        if (L >= 2 || reachesEnd) if (!best || score > best.score || (score === best.score && i > best.i)) best = { i, bs, L, score, reachesEnd };
      }
    }
    if (!best) return a.replace(/\s+$/, '') + '\n\n' + b;            // a real gap: keep both, in order
    const bEnd = best.bs + best.L;
    if (bEnd >= B.length) return a;                                    // b adds nothing new
    const aKeep = la.slice(0, A[best.i + best.L - 1].i + 1).join('\n');  // a up to the overlap
    const tailA = A.slice(best.i + best.L).map((x) => x.t);
    let rest = lb.slice(B[bEnd].i);
    // a ran on past the overlap (a different render of the same lines): b's version wins,
    // but keep any of a's lines b never shows.
    if (!best.reachesEnd && tailA.length) {
      const bSet = new Set(B.map((x) => x.t));
      const extra = tailA.filter((t) => !bSet.has(t));
      if (extra.length > tailA.length / 2) return a.replace(/\s+$/, '') + '\n' + rest.join('\n');
    }
    return aKeep.replace(/\s+$/, '') + '\n' + rest.join('\n');
  }

  // Open "Show more" style toggles inside the chat so collapsed text is in the page.
  const opened = new WeakSet();
  function expandCollapsed(sc) {
    const root = sc && sc !== document.scrollingElement ? sc : (document.querySelector('main') || document.body);
    let n = 0;
    for (const b of root.querySelectorAll('button, [role="button"], summary')) {
      if (opened.has(b) || b.closest('nav, aside, form, a[href]')) continue;
      const t = (b.innerText || b.textContent || b.getAttribute('aria-label') || '').trim();
      const isToggle = /^(show|see|read|view) (more|all|full)( text)?$|^expand( message)?$|^more$|^…$/i.test(t);
      const isDetails = b.tagName === 'SUMMARY' && b.parentElement && !b.parentElement.open;
      if (!isToggle && !isDetails) continue;
      opened.add(b);
      try { b.click(); n++; } catch (e) {}
      if (n > 40) break;
    }
    return n;
  }

  // Detect-only mode: quick count for the popup header, no scrolling.
  if (opts.detectOnly) {
    const sel = String(window.getSelection ? window.getSelection() : '').trim();
    const snap = snapshot(findScroller(site && site.scroller()));
    const real = snap.method === 'site-reader' || snap.method === 'role-attributes' || snap.method === 'layout';
    const t = document.querySelector('[data-testid="conversation-title"], .conversation-title.selected, conversation-actions .conversation-title');
    let title = (t && t.textContent.trim()) || document.title.replace(/\s*[-|]\s*(ChatGPT|Claude|Gemini|DeepSeek|Hark|Copilot|Perplexity|Grok|Mistral|Le Chat|Poe|Kimi|Qwen|HuggingChat|Meta AI).*$/i, '').trim();
    if (/^(chatgpt|claude|gemini|deepseek|hark|copilot|perplexity|grok|le chat|poe|kimi|qwen|huggingchat|meta ai|new chat|chat)$/i.test(title)) title = '';
    return { provider: site ? site.name : host.replace(/^www\./, ''), title, count: real ? snap.messages.length : 0, supported: !!site, method: snap.method, hasSelection: sel.length > 40 };
  }

  const selText = String(window.getSelection ? window.getSelection() : '').trim();
  if (selText.length > 40 && opts.useSelection !== false && !site) {
    return { provider: host.replace(/^www\./, ''), url: location.href, title: document.title, method: 'selection', messages: [{ role: 'transcript', text: selText }], diag: diagnostics() };
  }

  if (site) for (let i = 0; i < 40 && site.busy(); i++) await sleep(500);

  const sc = findScroller(site && site.scroller());
  const acc = [], index = {};
  let method = null;
  const take = () => {
    if (opts.expand !== false) expandCollapsed(sc);
    const s = snapshot(sc);
    if (!method || s.method === 'site-reader') method = s.method;
    if (s.method === 'page-text' || s.method === 'selection') {
      const txt = s.messages[0]?.text || '';
      if (!txt) return;
      if (!acc.length) acc.push({ role: s.messages[0].role, text: txt });
      else acc[0].text = stitchText(acc[0].text, txt);
      return;
    }
    mergeInto(acc, index, s.messages);
  };

  if (opts.loadAll !== false && sc && sc.scrollHeight > sc.clientHeight + 40) {
    const start = sc.scrollTop;
    // 1. Go to the very top, waiting for older messages to load in.
    let lastH = -1, still = 0;
    for (let i = 0; i < 60 && still < 2; i++) {
      sc.scrollTop = 0;
      await sleep(500);
      if (sc.scrollHeight === lastH) still++; else still = 0;
      lastH = sc.scrollHeight;
    }
    // 2. Walk down a screen at a time, capturing what is mounted at each stop.
    take();
    const step = Math.max(200, Math.floor(sc.clientHeight * 0.7));
    for (let i = 0; i < 600; i++) {
      const before = sc.scrollTop;
      sc.scrollTop = before + step;
      await sleep(260);
      take();
      if (sc.scrollTop <= before + 2) break;
      if (opts.onProgressKey) try { window[opts.onProgressKey] = acc.length; } catch (e) {}
    }
    // 3. Settle at the very bottom: the last turns often mount (or grow) a moment late.
    let lastBottom = -1, calm = 0;
    for (let i = 0; i < 12 && calm < 2; i++) {
      sc.scrollTop = sc.scrollHeight;
      await sleep(400);
      take();
      if (sc.scrollHeight === lastBottom) calm++; else calm = 0;
      lastBottom = sc.scrollHeight;
    }
    if (site) for (let i = 0; i < 20 && site.busy(); i++) await sleep(500);
    take();
    sc.scrollTop = start || sc.scrollHeight;
  } else {
    take();
  }

  let messages = acc.filter((m) => m.text);
  if (method === 'layout' && !messages.some((m) => m.role === 'user')) messages = messages.map((m) => ({ ...m, role: 'transcript' }));
  const t = document.querySelector('[data-testid="conversation-title"], .conversation-title.selected, conversation-actions .conversation-title');
  let title = (t && t.textContent.trim()) || document.title.replace(/\s*[-|]\s*(ChatGPT|Claude|Gemini|DeepSeek|Hark|Copilot|Perplexity|Grok|Mistral|Le Chat|Poe|Kimi|Qwen|HuggingChat|Meta AI).*$/i, '').trim();
  if (/^(chatgpt|claude|gemini|deepseek|hark|copilot|perplexity|grok|le chat|poe|kimi|qwen|huggingchat|meta ai|new chat|chat)$/i.test(title)) title = '';
  return { provider: site ? site.name : host.replace(/^www\./, ''), url: location.href, title, method: method || 'page-text', messages: merge(messages), diag: method === 'site-reader' ? null : diagnostics() };
}

export function injectPrimer(text) {
  const visible = (e) => e && e.offsetParent !== null && !e.disabled && !e.readOnly;
  const SELS = [
    '#prompt-textarea',
    'div.ProseMirror[contenteditable="true"]',
    'rich-textarea .ql-editor',
    '.ql-editor[contenteditable="true"]',
    'textarea#chat-input',
    'textarea[placeholder*="essage" i]',
    'textarea[placeholder*="sk" i]',
    'div[contenteditable="true"][role="textbox"]',
    'textarea',
    'div[contenteditable="true"]'
  ];
  let el = null;
  const a = document.activeElement;
  if (a && (a.tagName === 'TEXTAREA' || a.isContentEditable) && visible(a)) el = a;
  if (!el) {
    for (const s of SELS) {
      const c = [...document.querySelectorAll(s)].find(visible);
      if (c) { el = c; break; }
    }
  }
  if (!el) return { ok: false };
  el.focus();
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, (el.value ? el.value + '\n\n' : '') + text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true };
  }
  const probe = text.slice(0, 30);
  let ok = false;
  try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
  if (!ok || !el.innerText.includes(probe)) {
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }
  if (!el.innerText.includes(probe)) {
    el.innerText = text;
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }
  return { ok: el.innerText.includes(probe) };
}

// Attach a generated .md file to the chat composer, then type a short note.
// Tries the paths each site accepts: paste (Claude, Gemini, most editors), the hidden
// file input (ChatGPT), then drop. Checks a chip with the file name appeared before moving on.
export async function attachFile(fileName, content, note) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const host = location.hostname;
  const visible = (e) => e && e.offsetParent !== null && !e.disabled && !e.readOnly;
  const SELS = ['#prompt-textarea', 'div.ProseMirror[contenteditable="true"]', 'rich-textarea .ql-editor', '.ql-editor[contenteditable="true"]', 'textarea#chat-input', 'textarea[placeholder*="essage" i]', 'div[contenteditable="true"][role="textbox"]', 'textarea', 'div[contenteditable="true"]'];
  let box = null;
  for (const s of SELS) { const c = [...document.querySelectorAll(s)].find(visible); if (c) { box = c; break; } }
  if (!box) return { ok: false, reason: 'no-composer' };

  const stem = fileName.replace(/\.md$/, '').slice(0, 12);
  const count = () => (document.body.innerText || document.body.textContent || '').split(stem).length - 1;
  const base = count();
  const makeDT = () => {
    const dt = new DataTransfer();
    dt.items.add(new File([content], fileName, { type: /gemini\.google/.test(host) ? 'text/plain' : 'text/markdown', lastModified: Date.now() }));
    return dt;
  };
  const appeared = async (ms) => {
    for (let t = 0; t < ms; t += 150) { await sleep(150); if (count() > base) return true; }
    return false;
  };

  const viaInput = async () => {
    const inputs = [...document.querySelectorAll('input[type="file"]')];
    const inp = inputs.find((i) => !/^image\//.test(i.accept || '') && (i.accept === '' || /md|text|\*|\.txt|plain/.test(i.accept))) || inputs.find((i) => !/^image\//.test(i.accept || '')) || inputs[0];
    if (!inp) return false;
    try { inp.files = makeDT().files; } catch (e) { return false; }
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return appeared(3500);
  };
  const viaPaste = async () => {
    box.focus();
    box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: makeDT(), bubbles: true, cancelable: true }));
    return appeared(2500);
  };
  const viaDrop = async () => {
    const dt = makeDT();
    const target = box.closest('form') || box;
    for (const type of ['dragenter', 'dragover', 'drop']) target.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
    return appeared(2500);
  };

  const order = /chatgpt\.com|openai\.com/.test(host) ? [viaInput, viaPaste, viaDrop] : [viaPaste, viaInput, viaDrop];
  let method = null;
  for (const f of order) { if (await f()) { method = f.name; break; } }
  if (!method) return { ok: false, reason: 'not-accepted' };

  if (note) {
    box.focus();
    let ok = false;
    try { ok = document.execCommand('insertText', false, note); } catch (e) {}
    if (!ok && (box.tagName === 'TEXTAREA')) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(box, note);
      box.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  return { ok: true, method };
}
