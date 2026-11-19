// Wires the page: pick photos per panel, crop and position each, write the caption,
// pick a size and export the cover as a PNG. Photos are read on the user's own machine
// (FileReader / object URLs) and never leave it. A `?shot=` query sets up a fixed scene
// for a screenshot instead (./shots.js).
import { drawCover, renderCover, loadImage, panelRects, SIZES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('preview');
const status = document.getElementById('status');
const captionInput = document.getElementById('caption');
const subInput = document.getElementById('subcaption');

const SAMPLES = ['skyline', 'boulevard', 'pier'];

function blankPanel() {
  return { img: null, name: '', zoom: 1, ox: 0, oy: 0 };
}

const state = {
  size: '1080x1080',
  panels: [blankPanel(), blankPanel(), blankPanel()],
  caption: captionInput.value,
  sub: subInput.value,
  pos: 'bottom',
  grade: 0.7,
  glow: true,
  selected: 0,
  preview: true,
};

function previewSize() {
  const { w, h } = SIZES[state.size];
  const scale = Math.min(720 / w, 720 / h);
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

function redraw() {
  const { w, h } = previewSize();
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  drawCover(canvas, { ...state, w, h });
  document.querySelectorAll('.panel-card').forEach((card) => {
    card.classList.toggle('selected', Number(card.dataset.panel) === state.selected);
  });
}

function say(text) {
  status.textContent = text;
}

/** Puts `img` into panel i and refreshes its sliders to match. */
export function setPanelPhoto(i, img, name) {
  const p = state.panels[i];
  p.img = img;
  p.name = name;
  p.zoom = 1;
  p.ox = 0;
  p.oy = 0;
  document.getElementById(`zoom${i}`).value = '1';
  document.getElementById(`ox${i}`).value = '0';
  document.getElementById(`oy${i}`).value = '0';
  document.querySelectorAll(`.sample[data-panel="${i}"]`).forEach((b) => {
    b.classList.toggle('active', b.dataset.sample === name);
  });
  state.selected = i;
  redraw();
}

async function loadSample(i, name) {
  const img = await loadImage(`./samples/${name}.jpg`);
  setPanelPhoto(i, img, name);
  say(`Panel ${i + 1}: sample “${name}” loaded.`);
}

async function loadDemo() {
  for (let i = 0; i < 3; i++) {
    state.panels[i].img = await loadImage(`./samples/${SAMPLES[i]}.jpg`);
    state.panels[i].name = SAMPLES[i];
    state.panels[i].zoom = 1;
    state.panels[i].ox = 0;
    state.panels[i].oy = 0;
    document.querySelectorAll(`.sample[data-panel="${i}"]`).forEach((b) => {
      b.classList.toggle('active', b.dataset.sample === SAMPLES[i]);
    });
  }
  state.selected = 0;
  // The boulevard photo is portrait: in the wide right-hand panel cover-fit crops its
  // top, cutting the subject's head. Nudge it down so the face stays in frame.
  state.panels[1].oy = 0.4;
  document.getElementById('oy1').value = '0.4';
  redraw();
  say('Three sample photos loaded — one per panel.');
}

function readFileIntoPanel(i, file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const img = await loadImage(reader.result);
    setPanelPhoto(i, img, file.name);
    say(`Panel ${i + 1}: “${file.name}” loaded from your machine.`);
  };
  reader.readAsDataURL(file);
}

function exportSize(key) {
  const { w, h } = SIZES[key];
  const out = renderCover(state, w, h);
  out.toBlob((blob) => {
    if (!blob) {
      say('Export failed — try again.');
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-cover-${w}x${h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    say(`Saved vice-cover-${w}x${h}.png`);
  }, 'image/png');
}

// --- size ---
document.querySelectorAll('input[name="size"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    state.size = radio.value;
    redraw();
  });
});

// --- per-panel controls ---
for (let i = 0; i < 3; i++) {
  document.getElementById(`file${i}`).addEventListener('change', (e) => {
    readFileIntoPanel(i, e.target.files[0]);
  });
  document.getElementById(`zoom${i}`).addEventListener('input', (e) => {
    state.panels[i].zoom = Number(e.target.value);
    redraw();
  });
  document.getElementById(`ox${i}`).addEventListener('input', (e) => {
    state.panels[i].ox = Number(e.target.value);
    redraw();
  });
  document.getElementById(`oy${i}`).addEventListener('input', (e) => {
    state.panels[i].oy = Number(e.target.value);
    redraw();
  });
  document.querySelector(`.panel-card[data-panel="${i}"]`).addEventListener('click', () => {
    state.selected = i;
    redraw();
  });
}

document.querySelectorAll('.sample').forEach((button) => {
  button.addEventListener('click', () => {
    loadSample(Number(button.dataset.panel), button.dataset.sample).catch(() => {
      say('Could not load that sample photo.');
    });
  });
});

document.querySelectorAll('.fill-all').forEach((button) => {
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    const from = Number(button.dataset.panel);
    const source = state.panels[from];
    if (!source.img) {
      say(`Panel ${from + 1} has no photo yet — add one first.`);
      return;
    }
    for (let i = 0; i < 3; i++) {
      state.panels[i].img = source.img;
      state.panels[i].name = source.name;
      state.panels[i].zoom = source.zoom;
      state.panels[i].ox = source.ox;
      state.panels[i].oy = source.oy;
    }
    redraw();
    say(`All three panels now use the Panel ${from + 1} photo.`);
  });
});

document.getElementById('demo').addEventListener('click', () => {
  loadDemo().catch(() => say('Could not load the sample photos.'));
});

// --- caption & grade ---
captionInput.addEventListener('input', () => { state.caption = captionInput.value; redraw(); });
subInput.addEventListener('input', () => { state.sub = subInput.value; redraw(); });
document.getElementById('captionPos').addEventListener('change', (e) => {
  state.pos = e.target.value;
  redraw();
});
document.getElementById('grade').addEventListener('input', (e) => {
  state.grade = Number(e.target.value) / 100;
  redraw();
});
document.getElementById('glow').addEventListener('change', (e) => {
  state.glow = e.target.checked;
  redraw();
});

// --- canvas: click to select a panel, drag to pan its photo, wheel to zoom ---
let drag = null;

function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function hitPanel(p) {
  const { w, h } = canvas;
  const rects = panelRects(w, h);
  for (let i = 0; i < 3; i++) {
    const r = rects[i];
    if (p.x >= r.x * w && p.x < (r.x + r.w) * w && p.y >= r.y * h && p.y < (r.y + r.h) * h) return i;
  }
  return 0;
}

canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  state.selected = hitPanel(p);
  drag = { x: p.x, y: p.y, ox: state.panels[state.selected].ox, oy: state.panels[state.selected].oy };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const panel = state.panels[state.selected];
  if (!panel.img) return;
  const spanX = Math.max(1, canvas.width * 0.2);
  const spanY = Math.max(1, canvas.height * 0.2);
  panel.ox = Math.max(-1, Math.min(1, drag.ox + (p.x - drag.x) / spanX));
  panel.oy = Math.max(-1, Math.min(1, drag.oy + (p.y - drag.y) / spanY));
  document.getElementById(`ox${state.selected}`).value = String(panel.ox);
  document.getElementById(`oy${state.selected}`).value = String(panel.oy);
  redraw();
});

canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointercancel', () => { drag = null; });

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = state.panels[state.selected];
  panel.zoom = Math.max(1, Math.min(2.5, panel.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
  document.getElementById(`zoom${state.selected}`).value = String(panel.zoom);
  redraw();
}, { passive: false });

// --- export ---
document.getElementById('exportSquare').addEventListener('click', () => exportSize('1080x1080'));
document.getElementById('exportPortrait').addEventListener('click', () => exportSize('1080x1350'));
document.getElementById('exportWide').addEventListener('click', () => exportSize('1920x1080'));

// --- screenshots ---
const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), state, { loadImage, loadDemo, redraw, setPanelPhoto });
} else {
  loadDemo().catch(() => redraw());
}

if (document.fonts && document.fonts.ready) {
  document.fonts.load('16px Anton').then(redraw).catch(() => {});
  document.fonts.ready.then(redraw).catch(() => {});
}
