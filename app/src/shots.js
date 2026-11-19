// Fixed scenes for screenshots: ?shot=editor shows the page with photos loaded;
// ?shot=cover shows the cover alone, at its export size. Query picks the samples and
// the words: photo1/photo2/photo3 are sample names, caption/sub the text, size one of
// 1080x1080, 1080x1350, 1920x1080, pos top|bottom, grade 0..100.
// window.__shotReady is set once the scene is painted.
import { SIZES, drawCover } from './cover.js';

const DEFAULT_PHOTOS = ['skyline', 'boulevard', 'pier'];

async function loadPhotos(query, state, helpers) {
  for (let i = 0; i < 3; i++) {
    const name = query.get(`photo${i + 1}`) ?? DEFAULT_PHOTOS[i];
    const img = await helpers.loadImage(`./samples/${name}.jpg`);
    helpers.setPanelPhoto(i, img, name);
  }
  // Same framing as the editor's demo load: the portrait boulevard photo needs a
  // downward nudge in panel 2 or cover-fit crops the subject's head in wide covers.
  if (state.panels[1].name === 'boulevard') {
    state.panels[1].oy = 0.4;
    const slider = document.getElementById('oy1');
    if (slider) slider.value = '0.4';
  }
}

function applyWords(query, state) {
  state.caption = query.get('caption') ?? state.caption;
  state.sub = query.get('sub') ?? state.sub;
  state.pos = query.get('pos') ?? state.pos;
  const grade = Number(query.get('grade'));
  if (Number.isFinite(grade)) state.grade = Math.max(0, Math.min(100, grade)) / 100;
  const captionInput = document.getElementById('caption');
  const subInput = document.getElementById('subcaption');
  if (captionInput) captionInput.value = state.caption;
  if (subInput) subInput.value = state.sub;
  const pos = document.getElementById('captionPos');
  if (pos) pos.value = state.pos;
  const gradeInput = document.getElementById('grade');
  if (gradeInput) gradeInput.value = String(Math.round(state.grade * 100));
}

function applySize(query, state) {
  const size = query.get('size');
  if (size && SIZES[size]) {
    state.size = size;
    document.querySelectorAll('input[name="size"]').forEach((radio) => {
      radio.checked = radio.value === size;
    });
  }
}

function whenReady() {
  const done = () => {
    requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
  };
  if (document.fonts && document.fonts.ready) {
    document.fonts.load('16px Anton').then(done).catch(done);
  } else {
    done();
  }
}

export async function runShot(shot, query, state, helpers) {
  applySize(query, state);
  applyWords(query, state);
  await loadPhotos(query, state, helpers);
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const { w, h } = SIZES[state.size];
    const canvas = document.getElementById('preview');
    state.preview = false;
    state.selected = -1;
    // Draw at the exact export size, not the editor's preview size.
    canvas.width = w;
    canvas.height = h;
    drawCover(canvas, { ...state, w, h, preview: false, selected: -1 });
  } else {
    state.preview = true;
    helpers.redraw();
  }
  whenReady();
}
