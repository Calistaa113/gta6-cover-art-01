// Draws the multi-panel GTA-style cover: three photo panels on a dark poster board,
// a Vice City sunset grade over each photo, and a bold Anton caption on a sunset band.
//
// A cover state is { w, h, panels, caption, sub, pos, grade, glow, selected, preview }:
//   panels[i] is { img, zoom, ox, oy } — img an HTMLImageElement or null, zoom >= 1,
//   ox/oy in [-1, 1] pan the photo inside its panel. grade is 0..1, pos is "bottom"|"top",
//   selected is the panel index the editor highlights (-1 hides it), preview draws the
//   editor-only hints (empty-panel text, selection outline) that exports leave out.

export const SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square 1080 × 1080' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait 1080 × 1350' },
  '1920x1080': { w: 1920, h: 1080, label: 'Wide 1920 × 1080' },
};

/** The three panel rectangles for a cover of w by h, as fractions of the cover. */
export function panelRects(w, h) {
  if (w / h < 0.9) {
    return [
      { x: 0, y: 0, w: 1, h: 0.55 },
      { x: 0, y: 0.55, w: 0.5, h: 0.45 },
      { x: 0.5, y: 0.55, w: 0.5, h: 0.45 },
    ];
  }
  return [
    { x: 0, y: 0, w: 0.56, h: 1 },
    { x: 0.56, y: 0, w: 0.44, h: 0.5 },
    { x: 0.56, y: 0.5, w: 0.44, h: 0.5 },
  ];
}

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function coverFitRect(img, rect, zoom, ox, oy) {
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * base;
  const dh = img.naturalHeight * base;
  const overX = Math.max(0, (dw - rect.w) / 2);
  const overY = Math.max(0, (dh - rect.h) / 2);
  return {
    x: rect.x + (rect.w - dw) / 2 + ox * overX,
    y: rect.y + (rect.h - dh) / 2 + oy * overY,
    w: dw,
    h: dh,
  };
}

/** The sunset grade: a warm wash, a magenta dusk rising from the foot, and a vignette. */
function applyGrade(ctx, rect, grade) {
  if (grade <= 0) return;
  ctx.fillStyle = `rgba(255, 140, 70, ${0.1 * grade})`;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  const dusk = ctx.createLinearGradient(0, rect.y + rect.h * 0.3, 0, rect.y + rect.h);
  dusk.addColorStop(0, 'rgba(255, 90, 120, 0)');
  dusk.addColorStop(1, `rgba(214, 40, 130, ${0.42 * grade})`);
  ctx.fillStyle = dusk;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  const vig = ctx.createRadialGradient(
    rect.x + rect.w / 2, rect.y + rect.h / 2, Math.min(rect.w, rect.h) * 0.35,
    rect.x + rect.w / 2, rect.y + rect.h / 2, Math.max(rect.w, rect.h) * 0.75,
  );
  vig.addColorStop(0, 'rgba(10, 4, 20, 0)');
  vig.addColorStop(1, `rgba(10, 4, 20, ${0.3 * grade})`);
  ctx.fillStyle = vig;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

function emptyPanelFill(ctx, rect) {
  const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  g.addColorStop(0, '#3a1550');
  g.addColorStop(0.55, '#8a2470');
  g.addColorStop(1, '#e05a2a');
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
  for (let i = 1; i < 5; i++) {
    const y = rect.y + (rect.h / 5) * i;
    ctx.fillRect(rect.x, y, rect.w, Math.max(1, rect.h * 0.008));
  }
}

/** A small outrun sun with slits, drawn inside the caption band. */
function drawSun(ctx, cx, cy, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, '#ffe08a');
  g.addColorStop(0.6, '#ffb347');
  g.addColorStop(1, '#ff5e7a');
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.fillStyle = 'rgba(18, 8, 28, 0.85)';
  for (let i = 0; i < 3; i++) {
    const y = cy + r * (0.05 + i * 0.3);
    ctx.fillRect(cx - r, y, r * 2, r * (0.06 + i * 0.03));
  }
  ctx.restore();
}

function fitFont(ctx, text, maxWidth, startSize, family) {
  let size = startSize;
  ctx.font = `${size}px ${family}`;
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size = Math.max(10, size - Math.max(2, size * 0.04));
    ctx.font = `${size}px ${family}`;
  }
  return size;
}

/** The caption band: sunset strip, neon hairline, bold Anton caption, small spaced line. */
function drawCaptionBand(ctx, state) {
  const { w, h } = state;
  const bandH = h * 0.17;
  const top = state.pos === 'top' ? 0 : h - bandH;
  const g = ctx.createLinearGradient(0, top, 0, top + bandH);
  if (state.pos === 'top') {
    g.addColorStop(0, 'rgba(255, 94, 58, 0.96)');
    g.addColorStop(0.55, 'rgba(255, 46, 136, 0.92)');
    g.addColorStop(1, 'rgba(123, 47, 247, 0.88)');
  } else {
    g.addColorStop(0, 'rgba(123, 47, 247, 0.88)');
    g.addColorStop(0.45, 'rgba(255, 46, 136, 0.92)');
    g.addColorStop(1, 'rgba(255, 94, 58, 0.96)');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, top, w, bandH);
  ctx.fillStyle = '#7ee7ff';
  ctx.fillRect(0, state.pos === 'top' ? top + bandH - Math.max(2, h * 0.004) : top, w, Math.max(2, h * 0.004));

  // The sun sits behind the lettering, never over it: a long caption paints over the
  // sun instead of the sun punching through the words.
  drawSun(ctx, w * 0.93, top + bandH * 0.5, bandH * 0.38);

  const text = (state.caption || '').trim().toUpperCase();
  const sub = (state.sub || '').trim().toUpperCase();
  const cx = w / 2;
  if (text) {
    const size = fitFont(ctx, text, w * 0.86, bandH * 0.58, 'Anton, "Arial Black", sans-serif');
    const ty = top + bandH * (sub ? 0.46 : 0.62);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.font = `${size}px Anton, "Arial Black", sans-serif`;
    if (state.glow) {
      ctx.shadowColor = '#ff2e88';
      ctx.shadowBlur = size * 0.35;
    }
    ctx.fillStyle = '#ff2e88';
    ctx.fillText(text, cx + size * 0.045, ty + size * 0.045);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(18, 8, 28, 0.92)';
    ctx.lineWidth = Math.max(2, size * 0.09);
    ctx.strokeText(text, cx, ty);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, cx, ty);
    ctx.shadowBlur = 0;
  }
  if (sub) {
    // Set the letter spacing before measuring: the fit must count the spacing, or a
    // wide small line runs off the right edge once the spacing is applied.
    const spacing = Math.max(1, Math.round(bandH * 0.2 * 0.14));
    try { ctx.letterSpacing = `${spacing}px`; } catch { /* older canvas */ }
    const subSize = fitFont(ctx, sub, w * 0.8, bandH * 0.2, 'Anton, "Arial Black", sans-serif');
    ctx.font = `${subSize}px Anton, "Arial Black", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe08a';
    ctx.fillText(sub, cx, top + bandH * 0.82);
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  }
}

/** Draws the cover described by `state` onto `canvas` (the canvas's own size). */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#12081c';
  ctx.fillRect(0, 0, w, h);
  const gap = Math.max(6, Math.round(w * 0.008));
  const rects = panelRects(w, h);
  rects.forEach((frac, i) => {
    const rect = {
      x: frac.x * w + gap / 2,
      y: frac.y * h + gap / 2,
      w: frac.w * w - gap,
      h: frac.h * h - gap,
    };
    const panel = state.panels[i];
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    if (panel && panel.img) {
      const d = coverFitRect(panel.img, rect, panel.zoom || 1, panel.ox || 0, panel.oy || 0);
      ctx.drawImage(panel.img, d.x, d.y, d.w, d.h);
    } else {
      emptyPanelFill(ctx, rect);
      if (state.preview) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.font = `bold ${Math.max(13, Math.round(rect.w * 0.035))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Panel ${i + 1} — add a photo`, rect.x + rect.w / 2, rect.y + rect.h / 2);
      }
    }
    applyGrade(ctx, rect, state.grade ?? 0.7);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = Math.max(1, w * 0.0015);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    if (state.preview && state.selected === i) {
      ctx.strokeStyle = '#ff2e88';
      ctx.lineWidth = Math.max(2, w * 0.005);
      ctx.strokeRect(rect.x - 2, rect.y - 2, rect.w + 4, rect.h + 4);
    }
  });
  drawCaptionBand(ctx, state);
}

/** Renders the cover at its exact export size and returns the canvas. */
export function renderCover(state, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawCover(canvas, { ...state, w, h, selected: -1, preview: false });
  return canvas;
}
