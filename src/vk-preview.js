// VK viewport preview: isolated test harness, not included in the published game.
const frame = document.querySelector('#game-frame');
const device = document.querySelector('#device');
const readout = document.querySelector('#size');
const audit = document.querySelector('#audit');
const styleToggle = document.querySelector('#with-styles');
const presets = [...document.querySelectorAll('[data-width][data-height]')];
const inputs = { width: document.querySelector('#custom-width'), height: document.querySelector('#custom-height') };
let selected = { width: 390, height: 780 };
let resizeWatch = null;

function setSize(width, height) {
  const w = Number(width), h = Number(height);
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 240 || w > 1920 || h < 300 || h > 1600) {
    audit.textContent = 'Введите ширину 240–1920 и высоту 300–1600 пикселей.';
    return;
  }
  selected = { width: w, height: h };
  device.style.width = w + 'px';
  device.style.height = h + 'px';
  inputs.width.value = w;
  inputs.height.value = h;
  readout.textContent = w + ' × ' + h;
  presets.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.width) === w && Number(button.dataset.height) === h)));
  checkLayout();
}

function injectStyles() {
  try {
    const doc = frame.contentDocument;
    if (!doc) throw new Error('Нет доступа к содержимому iframe');
    let link = doc.getElementById('vk-preview-responsive');
    if (styleToggle.checked && !link) {
      link = doc.createElement('link');
      link.id = 'vk-preview-responsive';
      link.rel = 'stylesheet';
      link.href = new URL('./styles/vk-responsive.css', location.href).href;
      link.addEventListener('load', checkLayout);
      link.addEventListener('error', () => { audit.textContent = 'Не удалось загрузить адаптивные стили.'; });
      doc.head.appendChild(link);
    } else if (!styleToggle.checked && link) {
      link.remove();
    }
    requestAnimationFrame(checkLayout);
  } catch (error) {
    audit.textContent = 'Проверка недоступна: откройте стенд через локальный HTTP-сервер (не file://).';
  }
}

function checkLayout() {
  try {
    const doc = frame.contentDocument;
    if (!doc || doc.readyState !== 'complete') {
      audit.textContent = 'Загрузка игры…';
      return;
    }
    const root = doc.documentElement;
    const body = doc.body;
    const viewport = root.clientWidth;
    const documentWidth = Math.max(root.scrollWidth, body?.scrollWidth || 0);
    const overflow = Math.max(0, documentWidth - viewport);
    audit.textContent = overflow > 1
      ? 'Есть горизонтальное переполнение: +' + overflow + ' px.'
      : 'Горизонтального переполнения страницы нет.';
    audit.dataset.state = overflow > 1 ? 'warning' : 'ok';
  } catch {
    audit.textContent = 'Автопроверка недоступна; проверьте окно вручную.';
  }
}

presets.forEach(button => button.addEventListener('click', () => setSize(button.dataset.width, button.dataset.height)));
document.querySelector('#apply-size').addEventListener('click', () => setSize(inputs.width.value, inputs.height.value));
styleToggle.addEventListener('change', injectStyles);
frame.addEventListener('load', () => {
  if (resizeWatch) resizeWatch.disconnect();
  injectStyles();
  try {
    resizeWatch = new ResizeObserver(checkLayout);
    resizeWatch.observe(frame.contentDocument.documentElement);
  } catch { /* A manual check remains available below. */ }
});
document.querySelector('#check-layout').addEventListener('click', checkLayout);
window.addEventListener('resize', checkLayout);
setSize(390, 780);
