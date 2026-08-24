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

    const meshes = [];
    meshes.push(extrudeRing(worldR.outer, worldR.inner, params.rimDepth, 'rim-R'));
    meshes.push(extrudeRing(worldL.outer, worldL.inner, params.rimDepth, 'rim-L'));
    if (bridge) meshes.push(extrudePolygon(bridge.outline, params.bridgeDepth, 'bridge'));

    const combined = mergeMeshes(meshes);

    return {
      ok: true,
      params: params,
      origins: { R: originR, L: originL },
      gap: gap,
      rims: { R: worldR, L: worldL },
      bridge: bridge,
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
