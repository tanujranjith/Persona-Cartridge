# Persona Cartridges

Save any AI chat, even a temporary one, as a portable "persona cartridge" and load it into ChatGPT, Claude, Gemini, DeepSeek or any other chat site.

## Install (Chrome, Edge, Brave, Arc)
1. Unzip this folder.
2. Go to `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the `persona-cartridges` folder.
4. Pin the extension. Shortcut: **Alt+Shift+S** opens it.
5. Click the gear, pick a provider, paste your API key, hit **Test key**, then **Save settings**.

## Use
- **Save:** open a chat (temp chats work), click the icon, hit **Save chat as cartridge**. It scrolls up to load the whole chat, reads every message off the page, then your chosen AI distills it into a persona in the background (you can close the popup).
- **Load:** open any chat site, click the icon, hit **Load** on a cartridge. The primer is typed into the chat box and copied to your clipboard. Press send.
- **Preview / Copy / Export / Import / Rename / Re-distill / Delete** are on each card (••• for more).
- No key? It saves a raw cartridge with the full transcript, which still loads anywhere.

## How text is read
| Site | User | AI |
|---|---|---|
| ChatGPT | `article[data-turn="user"]` (fallback `[data-message-author-role]`) | `article[data-turn="assistant"]` |
| Claude | `[data-testid="user-message"]` | `.font-claude-response` (fallback `div[data-is-streaming]`) |
| Gemini | `<user-query>` | `<model-response>` (skips `<model-thoughts>`) |
| DeepSeek | `.ds-message` without `.ds-markdown` | `.ds-markdown` (skips `.ds-think-content`) |
| Anything else | role attributes, then your highlighted text, then the main page text |

If a site's reader finds nothing, it falls back to the generic reader, so a save never comes back empty when there's text on screen. Readers also look inside shadow DOM and every frame of the tab, keep KaTeX math as TeX, and the popup shows **Copy debug info** when a fallback was used.

All selectors live in `SITES` at the top of `page-scripts.js`. If a site changes its layout and the popup shows 0 messages, update that one entry.

## Files
- `manifest.json` (MV3)
- `popup.html/.css/.js` (the mini UI)
- `page-scripts.js` (reads the chat, writes into the chat box)
- `background.js` (calls your AI with your key, builds the cartridge)
- `shared.js` (storage, primer builder, provider list)
- `options.html/.js` (settings)

## Privacy
Cartridges, settings and the API key are stored in `chrome.storage.local` in this browser profile. The API key is not encrypted by a cartridge PIN.

- **Save / Re-distill with a key:** transcript text (bounded by the configured character limit), source provider and chat title are sent to the selected AI provider or custom endpoint. Its own privacy and retention terms apply. Saving with a key starts distillation automatically.
- **Save without a key:** a raw transcript is saved locally; no distillation request is made.
- **Test key:** sends a small test prompt and your key to the configured provider/endpoint, not a saved chat transcript.
- **Load / Copy / Export:** cartridge content may be placed in a destination chat or attachment, copied to the clipboard, or written to a downloaded file. Those copies are outside extension storage; a destination site may process text or attachments before you press Send.
- **PIN locks:** encrypt the locked cartridge, not your API key or copies previously exported, copied or sent to a provider. A forgotten PIN cannot be recovered.

Do not commit personal cartridge exports, transcripts, provider keys or browser profiles. The repository ignore rules are a precaution, not a secret scanner; review staged files before committing.

Run the offline privacy-contract checks with `node --test tests/privacy-contract.test.cjs`.

## What's new in 1.1
- **Load attaches a .md file** to the chat (ChatGPT, Claude, Gemini, DeepSeek, most others) and types a one-line note. If a site blocks it, the .md downloads so you can drag it in. Switch to text paste in Settings.
- **Full chats, first message included.** ChatGPT and others remove older messages from the page as you scroll, so Save now walks the chat top to bottom and stitches every message together.
- **Role detection without labels:** if a site has no message attributes, user vs assistant is worked out from bubble position.
- **PIN locks:** open a cartridge, ••• → Lock with PIN. It's encrypted (AES-256, key derived from your PIN), so loading, copying, previewing or deleting needs the PIN. 5 wrong tries pauses it for 30s. A forgotten PIN can't be recovered.
- **v1.2 design:** light cartridge shelf. Each persona is a cartridge with a pastel label (color by provider), All · Locked · Recent filters, coral Save this chat slot. Keys: `S` save, `/` search, arrows move around the grid, `Enter` load, `Space` open, `Esc` / `Backspace` back.


## v1.3.0
- Opens as a Chrome side panel next to the chat (click the toolbar icon or Alt+Shift+S). The panel follows the tab you switch to.
- Readers for Hark, Copilot, Perplexity, Grok, Mistral Le Chat, Poe, Kimi, Qwen, HuggingChat, plus Meta AI, Pi and Character.AI through the layout reader. ChatGPT, Claude, Gemini and DeepSeek are unchanged.
- Expands "Show more" and collapsed sections before reading.
- Better stitching: no orphan blocks at the top, no duplicated messages, and drops timestamp lines.
- On sites without built-in access, Save asks Chrome once for permission to read that site.
