const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'background.js'), 'utf8').replace(/^import .*;\n/m, '');
function runtime(apiKey) {
  const requests = [];
  const cartridge = { id: 'fixture', transcript: [{role:'user',text:'Synthetic test transcript'}], source:{provider:'test', title:'Synthetic title'} };
  const context = vm.createContext({
    getSettings: async () => ({apiKey}), getCartridges: async () => [cartridge],
    putCartridge: async () => {}, transcriptText: msgs => msgs.map(m=>m.text).join('\n'),
    resolvedProvider: () => ({kind:'openai',base:'https://provider.invalid/v1',model:'test',label:'Test'}),
    fetch: async (url, options) => { requests.push({url,options}); return {ok:true,status:200,json:async()=>({choices:[{message:{content:'{"name":"Fixture"}'}}]})}; },
    chrome: {runtime:{onMessage:{addListener(){}},onInstalled:{addListener(){}},onStartup:{addListener(){}}}},
  });
  vm.runInContext(source, context);
  return {context, requests, cartridge};
}
test('without an API key, distillation keeps a raw cartridge and makes no request', async () => {
  const r=runtime(''); await vm.runInContext("distill('fixture')",r.context);
  assert.equal(r.requests.length,0); assert.equal(r.cartridge.status,'raw');
});
test('configured provider receives transcript and title, as disclosed', async () => {
  const r=runtime('synthetic-test-key'); await vm.runInContext("distill('fixture')",r.context);
  assert.equal(r.requests.length,1); const req=r.requests[0];
  assert.equal(req.url,'https://provider.invalid/v1/chat/completions');
  assert.equal(req.options.headers.authorization,'Bearer synthetic-test-key');
  const body=JSON.parse(req.options.body);
  assert.match(body.messages[1].content,/Synthetic test transcript/);
  assert.match(body.messages[1].content,/Synthetic title/);
});
test('settings explain provider transmission and local raw fallback', () => {
  const html=fs.readFileSync(path.join(root,'options.html'),'utf8');
  assert.doesNotMatch(html,/Everything stays on this device/);
  assert.match(html,/selected AI provider or custom endpoint/);
  assert.match(html,/Without a key/);
});
