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
Cartridges and your key live only in `chrome.storage.local` on this device. The transcript is sent only to the AI provider you chose.

## What's new in 1.1
- **Load attaches a .md file** to the chat (ChatGPT, Claude, Gemini, DeepSeek, most others) and types a one-line note. If a site blocks it, the .md downloads so you can drag it in. Switch to text paste in Settings.
- **Full chats, first message included.** ChatGPT and others remove older messages from the page as you scroll, so Save now walks the chat top to bottom and stitches every message together.
- **Role detection without labels:** if a site has no message attributes, user vs assistant is worked out from bubble position.
- **PIN locks:** open a cartridge, ••• → Lock with PIN. It's encrypted (AES-256, key derived from your PIN), so loading, copying, previewing or deleting needs the PIN. 5 wrong tries pauses it for 30s. A forgotten PIN can't be recovered.
- **v1.2 design:** light cartridge shelf. Each persona is a cartridge with a pastel label (color by provider), All · Locked · Recent filters, coral Save this chat slot. Keys: `S` save, `/` search, arrows move around the grid, `Enter` load, `Space` open, `Esc` / `Backspace` back.
