/**
 * Parametric spectacle front from OMA traces.
 * All linear units: millimetres. L/R share the same parameters (symmetric).
 */
(function (global) {
  const DEFAULTS = {
    rimWidth: 3.0, // radial outward from scan
    rimDepth: 4.0, // Z thickness
    seatInset: 0.4, // hole smaller than scan (lens seat)
    dbl: 18.0, // distance between lens boxes (bridge gap)
    bridgeHeight: 4.0, // vertical thickness of bridge bar
    bridgeDepth: 4.0, // Z of bridge (often = rimDepth)
    bridgeDrop: 0, // vertical offset of bridge center (mm, + up)
    bridgeReach: 2.0, // how far bridge overlaps into each rim (mm)
    // Nose pads (symmetric L/R)
    padWidth: 7.0, // ellipse width (along face, mostly horizontal)
    padHeight: 10.0, // ellipse height (vertical)
    padThickness: 2.0, // pad body thickness
    padGap: 16.0, // distance between pad centers
    padDrop: -6.0, // vertical position of pad centers (mm, + up)
    padReach: 8.0, // how far pads sit behind the rim toward the face
    padTilt: 18.0, // inward face tilt (degrees)
    padStem: 2.0, // stem cross-section size
  };

  function cloneParams(p) {
    return Object.assign({}, DEFAULTS, p || {});
  }

  /**
   * @param {object} doc parsed OMA
   * @param {object} params
   */
  function buildFrameModel(doc, params) {
    params = cloneParams(params);
    const right = pickTrace(doc, 'R');
    const left = pickTrace(doc, 'L');

    let rPts = right && right.points && right.points.length ? right.points : null;
    let lPts = left && left.points && left.points.length ? left.points : null;

    // Mirror missing side so we always get a full front when one eye exists
    if (rPts && !lPts) lPts = mirrorPointsX(rPts);
    if (lPts && !rPts) rPts = mirrorPointsX(lPts);

    if (!rPts || !lPts) {
      return { ok: false, error: 'Нужен хотя бы один контур R или L', params: params };
    }

    const rHalf = halfWidth(rPts);
    const lHalf = halfWidth(lPts);
    const gap = rHalf + params.dbl + lHalf;
    const originR = { x: -gap / 2, y: 0 };
    const originL = { x: gap / 2, y: 0 };

    const rimR = buildRimLocal(rPts, params);
    const rimL = buildRimLocal(lPts, params);

    const worldR = transformRim(rimR, originR);
    const worldL = transformRim(rimL, originL);

    const bridge = buildBridge(worldR, worldL, params);
    const pads = buildNosePads(worldR, worldL, params);

    const meshes = [];
    meshes.push(extrudeRing(worldR.outer, worldR.inner, params.rimDepth, 'rim-R'));
    meshes.push(extrudeRing(worldL.outer, worldL.inner, params.rimDepth, 'rim-L'));
    if (bridge) meshes.push(extrudePolygon(bridge.outline, params.bridgeDepth, 'bridge'));
    if (pads) {
      if (pads.R) {
        meshes.push(pads.R.stem);
        meshes.push(pads.R.pad);
      }
      if (pads.L) {
        meshes.push(pads.L.stem);
        meshes.push(pads.L.pad);
      }
    }

    const combined = mergeMeshes(meshes);

    return {
      ok: true,
      params: params,
      origins: { R: originR, L: originL },
      gap: gap,
      rims: { R: worldR, L: worldL },
      bridge: bridge,
      pads: pads,
      mesh: combined,
      parts: meshes,
    };
  }

  function pickTrace(doc, side) {
    if (!doc || !doc.traces) return null;
    return (
      doc.traces.find(function (t) {
        return t.side === side && t.points && t.points.length;
      }) || null
    );
  }

  function mirrorPointsX(points) {
    return points.map(function (p) {
      return {
        angle: Math.PI - p.angle,
        r: p.r,
        x: -p.x,
        y: p.y,
        z: p.z,
      };
    });
  }

  function halfWidth(points) {
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < points.length; i++) {
      minX = Math.min(minX, points[i].x);
      maxX = Math.max(maxX, points[i].x);
    }
    return (maxX - minX) / 2;
  }

  /** Polar offset: inner/outer rings in local eye coordinates */
  function buildRimLocal(points, params) {
    const outer = [];
    const inner = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const a = p.angle != null ? p.angle : Math.atan2(p.y, p.x);
      const r = p.r != null ? p.r : Math.hypot(p.x, p.y);
      const ro = Math.max(0.5, r + params.rimWidth);
      const ri = Math.max(0.2, r - params.seatInset);
      outer.push({ x: ro * Math.cos(a), y: ro * Math.sin(a), a: a, r: ro });
      inner.push({ x: ri * Math.cos(a), y: ri * Math.sin(a), a: a, r: ri });
    }
    return { outer: outer, inner: inner };
  }

  function transformRim(rim, origin) {
    return {
      outer: rim.outer.map(function (p) {
        return { x: p.x + origin.x, y: p.y + origin.y, a: p.a, r: p.r };
      }),
      inner: rim.inner.map(function (p) {
        return { x: p.x + origin.x, y: p.y + origin.y, a: p.a, r: p.r };
      }),
      origin: origin,
    };
  }

  /**
   * Bridge between nasal sides.
   * R nasal ≈ local +X (angle 0); L nasal ≈ local −X (angle π).
   */
  function buildBridge(rimR, rimL, params) {
    const nR = sampleNearAngle(rimR.outer, 0, 0.35);
    const nL = sampleNearAngle(rimL.outer, Math.PI, 0.35);
    if (!nR.length || !nL.length) return null;

    const yR = averageY(nR);
    const yL = averageY(nL);
    const yMid = (yR + yL) / 2 + params.bridgeDrop;
    const halfH = params.bridgeHeight / 2;

    // Inner nasal edges (toward center) with slight overlap into rims
    const xRight = Math.max.apply(
      null,
      nR.map(function (p) {
        return p.x;
      })
    );
    const xLeft = Math.min.apply(
      null,
      nL.map(function (p) {
        return p.x;
      })
    );

    const reach = params.bridgeReach;
    const x0 = xRight - reach;
    const x1 = xLeft + reach;
    if (x1 <= x0 + 0.5) {
      // Eyes too close — still emit a thin bridge
    }

    const y0 = yMid - halfH;
    const y1 = yMid + halfH;

    return {
      outline: [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
      ],
      yMid: yMid,
    };
  }

  /**
   * Symmetric nose pads behind the rims, toward the face (−Z).
   * Pads sit at ±padGap/2, padDrop on Y; stems connect from nasal rim.
   */
  function buildNosePads(rimR, rimL, params) {
    if (params.padWidth < 0.5 || params.padHeight < 0.5 || params.padThickness < 0.2) {
      return null;
    }

    const halfGap = params.padGap / 2;
    const y = params.padDrop;
    const zBack = -params.rimDepth / 2;
    // Pad centers: behind rim back face by padReach (toward wearer)
    const zPad = zBack - params.padReach;
    const tilt = (params.padTilt * Math.PI) / 180;

    const padR = makePadAssembly({
      side: 'R',
      rim: rimR,
      center: { x: -halfGap, y: y, z: zPad },
      tilt: tilt,
      params: params,
    });
    const padL = makePadAssembly({
      side: 'L',
      rim: rimL,
      center: { x: halfGap, y: y, z: zPad },
      tilt: tilt,
      params: params,
    });

    return { R: padR, L: padL, y: y, gap: params.padGap };
  }

  function makePadAssembly(args) {
    const side = args.side;
    const rim = args.rim;
    const center = args.center;
    const tilt = args.tilt;
    const params = args.params;
    const towardCenter = side === 'R' ? 1 : -1;

    // Contact normal: toward midline (+X for R) and toward face (−Z)
    const ez = normalize3(
      towardCenter * Math.sin(tilt),
      0,
      -Math.cos(tilt)
    );
    let ey = { x: 0, y: 1, z: 0 };
    // Orthonormalize ey against ez
    ey = normalize3(
      ey.x - ez.x * dot3(ey, ez),
      ey.y - ez.y * dot3(ey, ez),
      ey.z - ez.z * dot3(ey, ez)
    );
    const ex = cross3(ey, ez);

    const halfW = params.padWidth / 2;
    const halfH = params.padHeight / 2;
    const halfT = params.padThickness / 2;

    const pad = extrudeEllipse(center, ex, ey, ez, halfW, halfH, halfT, 28, 'pad-' + side);

    // Attach stem from nasal rim (near pad Y) to pad mount (back of pad)
    const attach = findNasalAttach(rim.outer, side, center.y);
    const mount = {
      x: center.x - ez.x * halfT,
      y: center.y - ez.y * halfT,
      z: center.z - ez.z * halfT,
    };
    // Prefer attach slightly behind rim mid-depth so stem meets solid rim
    const attach3 = {
      x: attach.x,
      y: attach.y,
      z: -params.rimDepth * 0.15,
    };
    const stem = extrudeStem(attach3, mount, params.padStem, 'pad-stem-' + side);

    // 2D outline (ellipse in XY for overlay) — approximate projected oval
    const outline2d = [];
    const segs = 24;
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const lx = Math.cos(a) * halfW;
      const ly = Math.sin(a) * halfH;
      outline2d.push({
        x: center.x + ex.x * lx + ey.x * ly,
        y: center.y + ex.y * lx + ey.y * ly,
      });
    }

    return {
      center: center,
      attach: attach3,
      mount: mount,
      outline2d: outline2d,
      pad: pad,
      stem: stem,
    };
  }

  function findNasalAttach(ring, side, targetY) {
    // R nasal ≈ angle 0; L nasal ≈ π. Prefer lower-nasal for pads.
    const targetA = side === 'R' ? -0.55 : Math.PI + 0.55;
    let best = ring[0];
    let bestScore = Infinity;
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i];
      const dy = p.y - targetY;
      const da = Math.abs(angleDiff(p.a, targetA));
      const score = dy * dy + da * da * 40;
      if (score < bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return best;
  }

  function normalize3(x, y, z) {
    const len = Math.hypot(x, y, z) || 1;
    return { x: x / len, y: y / len, z: z / len };
  }

  function dot3(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  function cross3(a, b) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  }

  /** Elliptical slab in local basis (ex, ey) extruded ±halfT along ez */
  function extrudeEllipse(center, ex, ey, ez, halfW, halfH, halfT, segs, name) {
    const positions = [];
    const indices = [];

    function addLocal(lx, ly, lz) {
      positions.push(
        center.x + ex.x * lx + ey.x * ly + ez.x * lz,
        center.y + ex.y * lx + ey.y * ly + ez.y * lz,
        center.z + ex.z * lx + ey.z * ly + ez.z * lz
      );
      return positions.length / 3 - 1;
    }

    const front = [];
    const back = [];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const lx = Math.cos(a) * halfW;
      const ly = Math.sin(a) * halfH;
      front.push(addLocal(lx, ly, halfT));
      back.push(addLocal(lx, ly, -halfT));
    }

    // Caps (fan)
    const frontC = addLocal(0, 0, halfT);
    const backC = addLocal(0, 0, -halfT);
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % segs;
      indices.push(frontC, front[i], front[j]);
      indices.push(backC, back[j], back[i]);
      indices.push(front[i], back[i], back[j]);
      indices.push(front[i], back[j], front[j]);
    }

    return { name: name, positions: positions, indices: indices };
  }

  /** Square-ish prism between two 3D points */
  function extrudeStem(a, b, size, name) {
    const dir = normalize3(b.x - a.x, b.y - a.y, b.z - a.z);
    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (len < 0.2) return emptyMesh(name);

    // Build orthonormal frame
    let ref = Math.abs(dir.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    let u = cross3(dir, ref);
    u = normalize3(u.x, u.y, u.z);
    let v = cross3(dir, u);
    v = normalize3(v.x, v.y, v.z);
    const h = size / 2;

    const cornersA = [
      { x: a.x + (-u.x - v.x) * h, y: a.y + (-u.y - v.y) * h, z: a.z + (-u.z - v.z) * h },
      { x: a.x + (u.x - v.x) * h, y: a.y + (u.y - v.y) * h, z: a.z + (u.z - v.z) * h },
      { x: a.x + (u.x + v.x) * h, y: a.y + (u.y + v.y) * h, z: a.z + (u.z + v.z) * h },
      { x: a.x + (-u.x + v.x) * h, y: a.y + (-u.y + v.y) * h, z: a.z + (-u.z + v.z) * h },
    ];
    const cornersB = [
      { x: b.x + (-u.x - v.x) * h, y: b.y + (-u.y - v.y) * h, z: b.z + (-u.z - v.z) * h },
      { x: b.x + (u.x - v.x) * h, y: b.y + (u.y - v.y) * h, z: b.z + (u.z - v.z) * h },
      { x: b.x + (u.x + v.x) * h, y: b.y + (u.y + v.y) * h, z: b.z + (u.z + v.z) * h },
      { x: b.x + (-u.x + v.x) * h, y: b.y + (-u.y + v.y) * h, z: b.z + (-u.z + v.z) * h },
    ];

    const positions = [];
    const indices = [];
    function add(p) {
      positions.push(p.x, p.y, p.z);
      return positions.length / 3 - 1;
    }
    const ia = cornersA.map(add);
    const ib = cornersB.map(add);

    // Cap A (outward = −dir), Cap B (+dir)
    indices.push(ia[0], ia[2], ia[1], ia[0], ia[3], ia[2]);
    indices.push(ib[0], ib[1], ib[2], ib[0], ib[2], ib[3]);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      indices.push(ia[i], ib[i], ib[j]);
      indices.push(ia[i], ib[j], ia[j]);
    }

    return { name: name, positions: positions, indices: indices };
  }

  function sampleNearAngle(ring, target, tol) {
    const out = [];
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i];
      let d = Math.abs(angleDiff(p.a, target));
      if (d <= tol) out.push(p);
    }
    if (out.length) return out;
    // fallback: closest point
    let best = ring[0];
    let bestD = Infinity;
    for (let i = 0; i < ring.length; i++) {
      const d = Math.abs(angleDiff(ring[i].a, target));
      if (d < bestD) {
        bestD = d;
        best = ring[i];
      }
    }
    return [best];
  }

  function angleDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function averageY(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) s += pts[i].y;
    return s / pts.length;
  }

  /** Annular prism: outer CCW, inner CW for correct normals */
  function extrudeRing(outer, inner, depth, name) {
    const z0 = -depth / 2;
    const z1 = depth / 2;
    const positions = [];
    const indices = [];

    const no = outer.length;
    const ni = inner.length;
    if (no < 3 || ni < 3) return emptyMesh(name);

    function add(x, y, z) {
      positions.push(x, y, z);
      return positions.length / 3 - 1;
    }

    // Front ring (z1): outer then inner
    const frontOuter = [];
    const frontInner = [];
    for (let i = 0; i < no; i++) frontOuter.push(add(outer[i].x, outer[i].y, z1));
    for (let i = 0; i < ni; i++) frontInner.push(add(inner[i].x, inner[i].y, z1));

    const backOuter = [];
    const backInner = [];
    for (let i = 0; i < no; i++) backOuter.push(add(outer[i].x, outer[i].y, z0));
    for (let i = 0; i < ni; i++) backInner.push(add(inner[i].x, inner[i].y, z0));

    // Front face quads (outer[i] -> outer[i+1] -> inner[i+1] -> inner[i])
    // Assume same count; resample if needed
    const n = Math.min(no, ni);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      // front
      indices.push(frontOuter[i], frontOuter[j], frontInner[j]);
      indices.push(frontOuter[i], frontInner[j], frontInner[i]);
      // back (reversed)
      indices.push(backOuter[j], backOuter[i], backInner[i]);
      indices.push(backOuter[j], backInner[i], backInner[j]);
      // outer wall
      indices.push(frontOuter[i], backOuter[i], backOuter[j]);
      indices.push(frontOuter[i], backOuter[j], frontOuter[j]);
      // inner wall
      indices.push(frontInner[j], backInner[j], backInner[i]);
      indices.push(frontInner[j], backInner[i], frontInner[i]);
    }

    return { name: name, positions: positions, indices: indices };
  }

  function extrudePolygon(outline, depth, name) {
    if (!outline || outline.length < 3) return emptyMesh(name);
    const z0 = -depth / 2;
    const z1 = depth / 2;
    const positions = [];
    const indices = [];
    const n = outline.length;

    function add(x, y, z) {
      positions.push(x, y, z);
      return positions.length / 3 - 1;
    }

    const top = [];
    const bot = [];
    for (let i = 0; i < n; i++) {
      top.push(add(outline[i].x, outline[i].y, z1));
      bot.push(add(outline[i].x, outline[i].y, z0));
    }

    // Fan triangulate top/bottom (convex bridge rect is fine)
    for (let i = 1; i < n - 1; i++) {
      indices.push(top[0], top[i], top[i + 1]);
      indices.push(bot[0], bot[i + 1], bot[i]);
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      indices.push(top[i], bot[i], bot[j]);
      indices.push(top[i], bot[j], top[j]);
    }

    return { name: name, positions: positions, indices: indices };
  }

  function emptyMesh(name) {
    return { name: name, positions: [], indices: [] };
  }

  function mergeMeshes(meshes) {
    const positions = [];
    const indices = [];
    let base = 0;
    for (let m = 0; m < meshes.length; m++) {
      const mesh = meshes[m];
      for (let i = 0; i < mesh.positions.length; i++) positions.push(mesh.positions[i]);
      for (let i = 0; i < mesh.indices.length; i++) indices.push(mesh.indices[i] + base);
      base += mesh.positions.length / 3;
    }
    return { name: 'frame', positions: positions, indices: indices };
  }

  /** ASCII STL, mm units */
  function meshToSTL(mesh, solidName) {
    solidName = solidName || 'oma_frame';
    const pos = mesh.positions;
    const idx = mesh.indices;
    let out = 'solid ' + solidName + '\n';
    for (let t = 0; t < idx.length; t += 3) {
      const i0 = idx[t] * 3;
      const i1 = idx[t + 1] * 3;
      const i2 = idx[t + 2] * 3;
      const ax = pos[i0];
      const ay = pos[i0 + 1];
      const az = pos[i0 + 2];
      const bx = pos[i1];
      const by = pos[i1 + 1];
      const bz = pos[i1 + 2];
      const cx = pos[i2];
      const cy = pos[i2 + 1];
      const cz = pos[i2 + 2];
      const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
      const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      const len = Math.hypot(nx, ny, nz) || 1;
      out += ' facet normal ' + nx / len + ' ' + ny / len + ' ' + nz / len + '\n';
      out += '  outer loop\n';
      out += '   vertex ' + ax + ' ' + ay + ' ' + az + '\n';
      out += '   vertex ' + bx + ' ' + by + ' ' + bz + '\n';
      out += '   vertex ' + cx + ' ' + cy + ' ' + cz + '\n';
      out += '  endloop\n';
      out += ' endfacet\n';
    }
    out += 'endsolid ' + solidName + '\n';
    return out;
  }

  function downloadSTL(mesh, filename) {
    const stl = meshToSTL(mesh, 'oma_frame');
    const blob = new Blob([stl], { type: 'model/stl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'oma-frame.stl';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 2000);
  }

  global.FrameModel = {
    DEFAULTS: DEFAULTS,
    cloneParams: cloneParams,
    buildFrameModel: buildFrameModel,
    meshToSTL: meshToSTL,
    downloadSTL: downloadSTL,
  };
})(window);
