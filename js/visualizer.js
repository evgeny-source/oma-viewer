(function (global) {
  const COLORS = {
    right: '#0b6e6a',
    left: '#1d4e89',
    rightFill: 'rgba(11, 110, 106, 0.12)',
    leftFill: 'rgba(29, 78, 137, 0.12)',
    grid: 'rgba(40, 55, 70, 0.08)',
    axis: 'rgba(40, 55, 70, 0.28)',
    bridge: 'rgba(40, 55, 70, 0.35)',
    label: '#2a3542',
    bg: '#e8edf1',
  };

  function drawFrame(canvas, model, opts) {
    opts = opts || {};
    const showPoints = !!opts.showPoints;
    const showGrid = opts.showGrid !== false;
    const showAxes = opts.showAxes !== false;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 800;
    const cssH = canvas.clientHeight || 480;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, cssW, cssH);

    const right = model.traces.find((t) => t.side === 'R' && t.points && t.points.length);
    const left = model.traces.find((t) => t.side === 'L' && t.points && t.points.length);
    const only =
      !right && !left
        ? model.traces.find((t) => t.points && t.points.length)
        : null;

    if (!right && !left && !only) {
      drawEmpty(ctx, cssW, cssH);
      return;
    }

    const layout = layoutEyes({ right: right, left: left, only: only, dbl: model.dbl });
    const pad = 48;
    const scale = fitScale(layout.bounds, cssW, cssH, pad);
    const cx =
      cssW / 2 - ((layout.bounds.minX + layout.bounds.maxX) / 2) * scale;
    const cy =
      cssH / 2 + ((layout.bounds.minY + layout.bounds.maxY) / 2) * scale;

    const worldToScreen = function (x, y) {
      return { x: cx + x * scale, y: cy - y * scale };
    };

    if (showGrid) drawGrid(ctx, cssW, cssH, worldToScreen, scale);
    if (showAxes) drawOriginCrosses(ctx, layout, worldToScreen);

    if (layout.right) {
      drawShape(ctx, layout.right.points, worldToScreen, {
        stroke: COLORS.right,
        fill: COLORS.rightFill,
        showPoints: showPoints,
        label: 'R',
        origin: layout.right.origin,
      });
    }
    if (layout.left) {
      drawShape(ctx, layout.left.points, worldToScreen, {
        stroke: COLORS.left,
        fill: COLORS.leftFill,
        showPoints: showPoints,
        label: 'L',
        origin: layout.left.origin,
      });
    }
    if (layout.only) {
      drawShape(ctx, layout.only.points, worldToScreen, {
        stroke: COLORS.right,
        fill: COLORS.rightFill,
        showPoints: showPoints,
        label: layout.only.side || '?',
        origin: layout.only.origin,
      });
    }

    if (
      layout.right &&
      layout.left &&
      model.dbl != null &&
      Number.isFinite(model.dbl)
    ) {
      drawBridgeHint(ctx, layout, worldToScreen, model.dbl);
    }

    if (opts.frameModel && opts.frameModel.ok) {
      drawFrameOverlay(ctx, opts.frameModel, worldToScreen);
    }

    drawScaleBar(ctx, cssW, cssH, scale);
  }

  function drawFrameOverlay(ctx, frameModel, worldToScreen) {
    function strokeRing(pts, color, width) {
      if (!pts || !pts.length) return;
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const s = worldToScreen(pts[i].x, pts[i].y);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      }
      ctx.closePath();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    }

    ['R', 'L'].forEach(function (side) {
      const rim = frameModel.rims && frameModel.rims[side];
      if (!rim) return;
      strokeRing(rim.outer, 'rgba(26, 36, 48, 0.75)', 2);
      strokeRing(rim.inner, 'rgba(26, 36, 48, 0.35)', 1.25);
    });

    if (frameModel.bridge && frameModel.bridge.outline) {
      const o = frameModel.bridge.outline;
      ctx.beginPath();
      for (let i = 0; i < o.length; i++) {
        const s = worldToScreen(o[i].x, o[i].y);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(29, 78, 137, 0.28)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(29, 78, 137, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (frameModel.pads) {
      ['R', 'L'].forEach(function (side) {
        const pad = frameModel.pads[side];
        if (!pad || !pad.outline2d) return;
        const o = pad.outline2d;
        ctx.beginPath();
        for (let i = 0; i < o.length; i++) {
          const s = worldToScreen(o[i].x, o[i].y);
          if (i === 0) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(11, 110, 106, 0.35)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(11, 110, 106, 0.95)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }
  }

  function layoutEyes(args) {
    const right = args.right;
    const left = args.left;
    const only = args.only;
    const dbl = args.dbl;

    if (only) {
      return {
        only: { points: only.points, origin: { x: 0, y: 0 }, side: only.side },
        bounds: boundsOf(only.points),
      };
    }

    const gap = resolveGap(right, left, dbl);
    const rightShifted = shiftPoints(right.points, -gap / 2, 0);
    const leftShifted = shiftPoints(left.points, gap / 2, 0);

    return {
      right: { points: rightShifted, origin: { x: -gap / 2, y: 0 } },
      left: { points: leftShifted, origin: { x: gap / 2, y: 0 } },
      bounds: boundsOf(rightShifted.concat(leftShifted)),
    };
  }

  function resolveGap(right, left, dbl) {
    const rHalf = right.metrics && right.metrics.a ? right.metrics.a / 2 : maxAbsX(right.points);
    const lHalf = left.metrics && left.metrics.a ? left.metrics.a / 2 : maxAbsX(left.points);
    const bridge = dbl != null && Number.isFinite(dbl) ? dbl : 16;
    return rHalf + bridge + lHalf;
  }

  function maxAbsX(points) {
    let m = 0;
    for (let i = 0; i < points.length; i++) m = Math.max(m, Math.abs(points[i].x));
    return m;
  }

  function shiftPoints(points, dx, dy) {
    return points.map(function (p) {
      return Object.assign({}, p, { x: p.x + dx, y: p.y + dy });
    });
  }

  function boundsOf(points) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    return { minX: minX, maxX: maxX, minY: minY, maxY: maxY };
  }

  function fitScale(bounds, w, h, pad) {
    const bw = Math.max(1, bounds.maxX - bounds.minX);
    const bh = Math.max(1, bounds.maxY - bounds.minY);
    return Math.min((w - pad * 2) / bw, (h - pad * 2) / bh);
  }

  function drawEmpty(ctx, w, h) {
    ctx.fillStyle = COLORS.label;
    ctx.font = '500 16px "Outfit", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Нет данных контура (TRCFMT / R)', w / 2, h / 2);
  }

  function drawGrid(ctx, w, h, worldToScreen, scale) {
    const stepMm = scale > 8 ? 5 : 10;
    const origin = worldToScreen(0, 0);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;

    for (let x = origin.x % (stepMm * scale); x < w; x += stepMm * scale) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = origin.y % (stepMm * scale); y < h; y += stepMm * scale) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  function drawOriginCrosses(ctx, layout, worldToScreen) {
    function drawCross(ox, oy, color) {
      const c = worldToScreen(ox, oy);
      const s = 10;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(c.x - s, c.y);
      ctx.lineTo(c.x + s, c.y);
      ctx.moveTo(c.x, c.y - s);
      ctx.lineTo(c.x, c.y + s);
      ctx.stroke();
    }
    if (layout.right) drawCross(layout.right.origin.x, layout.right.origin.y, COLORS.right);
    if (layout.left) drawCross(layout.left.origin.x, layout.left.origin.y, COLORS.left);
    if (layout.only) drawCross(0, 0, COLORS.right);
  }

  function drawShape(ctx, points, worldToScreen, style) {
    if (!points.length) return;

    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const s = worldToScreen(points[i].x, points[i].y);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
    ctx.fillStyle = style.fill;
    ctx.fill();
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = 2.25;
    ctx.lineJoin = 'round';
    ctx.stroke();

    if (style.showPoints) {
      ctx.fillStyle = style.stroke;
      for (let i = 0; i < points.length; i++) {
        const s = worldToScreen(points[i].x, points[i].y);
        ctx.beginPath();
        ctx.arc(s.x, s.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (style.label && style.origin) {
      const c = worldToScreen(style.origin.x, style.origin.y);
      ctx.fillStyle = style.stroke;
      ctx.font = '700 13px "Outfit", "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(style.label, c.x, c.y - 18);
    }
  }

  function drawBridgeHint(ctx, layout, worldToScreen, dbl) {
    const a = worldToScreen(layout.right.origin.x, 0);
    const b = worldToScreen(layout.left.origin.x, 0);
    const midY = Math.max(a.y, b.y) + 28;
    ctx.strokeStyle = COLORS.bridge;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(a.x, midY);
    ctx.lineTo(b.x, midY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.label;
    ctx.font = '12px "Outfit", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DBL ' + Number(dbl).toFixed(2) + ' mm', (a.x + b.x) / 2, midY + 14);
  }

  function drawScaleBar(ctx, w, h, scale) {
    const mm = scale >= 6 ? 10 : 20;
    const px = mm * scale;
    const x = 24;
    const y = h - 24;
    ctx.strokeStyle = COLORS.axis;
    ctx.fillStyle = COLORS.label;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + px, y);
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x, y + 5);
    ctx.moveTo(x + px, y - 5);
    ctx.lineTo(x + px, y + 5);
    ctx.stroke();
    ctx.font = '12px "Outfit", "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(mm + ' mm', x, y - 10);
  }

  global.OmaVisualizer = { drawFrame: drawFrame };
})(window);
