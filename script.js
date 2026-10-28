(() => {
'use strict';
const root = document.documentElement;
const scenes = Array.from(document.querySelectorAll('.scene'));
const scrollScenes = scenes.filter(scene => ['up', 'down'].includes(scene.dataset.drive));
const chapters = Array.from(document.querySelectorAll('#story section[id]'));
const chapterLinks = Array.from(document.querySelectorAll('.chapter-nav a'));
const progress = document.getElementById('reading-progress');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const svgNS = 'http://www.w3.org/2000/svg';
root.classList.add('js');

function mulberry(seed) {
  return () => {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

// Fixed seeds keep the illustrated windows identical between visits.
document.querySelectorAll('[data-windows]').forEach(group => {
  const d = group.dataset;
  const random = mulberry(Number(d.seed));
  const fragment = document.createDocumentFragment();
  for (let row = 0; row < Number(d.rows); row++) {
    for (let col = 0; col < Number(d.cols); col++) {
      const windowShape = document.createElementNS(svgNS, 'rect');
      windowShape.setAttribute('x', String(Number(d.x) + col * Number(d.dx)));
      windowShape.setAttribute('y', String(Number(d.y) + row * Number(d.dy)));
      windowShape.setAttribute('width', d.width);
      windowShape.setAttribute('height', d.height);
      windowShape.setAttribute('rx', '1');
      windowShape.setAttribute('class', 'glow-window');
      windowShape.dataset.threshold = String(.08 + random() * .8);
      fragment.appendChild(windowShape);
    }
  }
  group.appendChild(fragment);
});

const windowCache = new Map(scenes.map(scene => [scene, Array.from(scene.querySelectorAll('.glow-window'))]));
function setLevel(scene, value) {
  if (!scene) return;
  const level = clamp(value);
  scene.style.setProperty('--level', level.toFixed(3));
  (windowCache.get(scene) || []).forEach(windowShape => {
    const threshold = Number(windowShape.dataset.threshold);
    const strength = clamp((level - threshold) * 5);
    windowShape.style.opacity = String(.07 + strength * .93);
  });
}
scenes.forEach(scene => {
  const level = Number(scene.style.getPropertyValue('--level')) || .4;
  setLevel(scene, level);
});

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => entry.target.classList.toggle('is-visible', entry.isIntersecting));
  }, { threshold: 0, rootMargin: '40px 0px' });
  scenes.forEach(scene => observer.observe(scene));
} else {
  scenes.forEach(scene => scene.classList.add('is-visible'));
}

let scheduled = false;
function renderScroll() {
  scheduled = false;
  const height = window.innerHeight;
  const pageHeight = Math.max(1, root.scrollHeight - height);
  progress.style.transform = `scaleX(${clamp(window.scrollY / pageHeight)})`;
  scrollScenes.forEach(scene => {
    const chapter = scene.closest('section');
    const rect = chapter.getBoundingClientRect();
    const position = clamp((height - rect.top) / (height + rect.height));
    const eased = position * position * (3 - 2 * position);
    const start = Number(scene.dataset.from);
    const end = Number(scene.dataset.to);
    setLevel(scene, start + (end - start) * eased);
  });
  let current = chapters[0];
  const readingLine = height * .4;
  chapters.forEach(chapter => {
    if (chapter.getBoundingClientRect().top <= readingLine) current = chapter;
  });
  chapterLinks.forEach(link => {
    if (link.getAttribute('href') === `#${current.id}`) link.setAttribute('aria-current', 'step');
    else link.removeAttribute('aria-current');
  });
}
function requestRender() {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(renderScroll);
}
window.addEventListener('scroll', requestRender, { passive: true });
window.addEventListener('resize', requestRender, { passive: true });
window.addEventListener('pageshow', requestRender);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(requestRender);
renderScroll();

const hero = document.querySelector('.hero-scene');
hero.addEventListener('pointermove', event => {
  if (reducedMotion.matches || !finePointer.matches) return;
  const rect = hero.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width - .5;
  const y = (event.clientY - rect.top) / rect.height - .5;
  hero.style.setProperty('--px', `${(x * 9).toFixed(2)}px`);
  hero.style.setProperty('--py', `${(y * 6).toFixed(2)}px`);
});
function resetDepth() {
  hero.style.setProperty('--px', '0px');
  hero.style.setProperty('--py', '0px');
}
hero.addEventListener('pointerleave', resetDepth);
if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', resetDepth);

const windowControl = document.getElementById('window-control');
const windowScene = document.querySelector('[data-drive="window"]');
const windowValue = document.getElementById('window-value');
const windowResponse = document.getElementById('window-response');
function updateWindow() {
  const value = Number(windowControl.value);
  setLevel(windowScene, value / 100);
  let label;
  let response;
  if (value < 25) {
    label = 'خيط من الضوء';
    response = 'حتى الفتحة الصغيرة تترك للضوء طريقاً.';
  } else if (value < 65) {
    label = 'مساحة للتنفّس';
    response = 'دخل بعض الضوء. اترك له مكاناً.';
  } else {
    label = 'أفق أوسع';
    response = 'بقي الجدار، واتّسع ما تستطيع رؤيته من خلاله.';
  }
  windowValue.textContent = label;
  windowResponse.textContent = response;
  windowControl.setAttribute('aria-valuetext', label);
}
windowControl.addEventListener('input', updateWindow);
updateWindow();

const tabs = Array.from(document.querySelectorAll('[data-view]'));
const roadScene = document.querySelector('[data-drive="road"]');
function activateTab(tab, moveFocus = false) {
  tabs.forEach(item => {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
  });
  setLevel(roadScene, tab.dataset.view === 'near' ? .32 : .88);
  if (moveFocus) tab.focus();
  requestRender();
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activateTab(tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowLeft') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowRight') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      activateTab(tabs[next], true);
    }
  });
});
activateTab(tabs[0]);

const reflections = Array.from(document.querySelectorAll('.reflection-list details'));
const lampScene = document.querySelector('[data-drive="lamp"]');
function updateLamp() {
  const count = reflections.filter(detail => detail.open).length;
  setLevel(lampScene, .24 + count * .36);
  requestRender();
}
reflections.forEach(detail => detail.addEventListener('toggle', updateLamp));
updateLamp();

const choices = Array.from(document.querySelectorAll('input[name="step"]'));
const choiceStatus = document.getElementById('choice-status');
const resetButton = document.getElementById('reset-choices');
const dawnScene = document.querySelector('[data-drive="choices"]');
function updateChoices() {
  const count = choices.filter(choice => choice.checked).length;
  setLevel(dawnScene, .22 + count * .26);
  const messages = [
    'اختر خطوة، وشاهد الضوء يصل إلى نافذة أخرى.',
    'اخترت خطوة واحدة. يمكنك أن تبدأ منها.',
    'اخترت خطوتين. خذهما على مهل، واحدة بعد أخرى.',
    'أضأت النوافذ كلها في الرسم. ابدأ بخطوة واحدة في يومك.'
  ];
  choiceStatus.textContent = messages[count];
  resetButton.disabled = count === 0;
}
choices.forEach(choice => choice.addEventListener('change', updateChoices));
resetButton.addEventListener('click', () => {
  choices.forEach(choice => { choice.checked = false; });
  updateChoices();
  choices[0].focus();
});
updateChoices();
})();