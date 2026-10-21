import assert from 'node:assert/strict';
import { isVKLaunch, initializeVKBridge, VK_BRIDGE_URL } from '../src/platform/vk.js';

assert.equal(isVKLaunch(''), false);
assert.equal(isVKLaunch('?vk_platform=desktop_web'), false);
assert.equal(isVKLaunch('?vk_app_id=111&vk_platform=desktop_web'), false);
assert.equal(isVKLaunch('?vk_app_id=54842341&vk_platform=desktop_web'), true);
assert.equal(isVKLaunch('?vk_app_id=54842341&vk_platform=mobile_android'), true);

let requested = 0;
const win = { location: { search: '' } };
const doc = { head: { appendChild: () => { requested += 1; } } };
assert.equal(await initializeVKBridge({ win, doc }), 'browser');
assert.equal(requested, 0, 'Ordinary browser must not load VK SDK');

const commands = [];
assert.equal(await initializeVKBridge({
  win, doc, search: '?vk_app_id=54842341',
  load: async () => ({ send: async name => { commands.push(name); } }),
}), 'vk-ready');
assert.deepEqual(commands, ['VKWebAppInit']);

const bridgeWindow = { location: { search: '?vk_app_id=54842341' } };
const bridgeDoc = {
  createElement: () => ({}),
  head: { appendChild: script => {
    assert.equal(script.src, VK_BRIDGE_URL);
    bridgeWindow.vkBridge = { send: async command => commands.push(command) };
    script.onload();
  } },
};
assert.equal(await initializeVKBridge({ win: bridgeWindow, doc: bridgeDoc }), 'vk-ready');
assert.deepEqual(commands, ['VKWebAppInit', 'VKWebAppInit']);

const priorWarn = console.warn;
console.warn = () => {};
try {
  assert.equal(await initializeVKBridge({
    win, doc, search: '?vk_app_id=54842341', load: async () => { throw new Error('offline'); },
  }), 'vk-error');
} finally { console.warn = priorWarn; }
console.log('VK integration smoke: OK');
