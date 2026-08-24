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
    // Molded plastic nose pads: teardrop mounds on the nasal rim, inside the outline
    padWidth: 3.2, // how far the pad extends inward from the outer rim
    padHeight: 14.0, // length along the inner nasal rim
    padThickness: 1.6, // extra mound toward the face (−Z), min 1.5 mm
    padGap: 12.0, // distance between nose-facing contact walls
    padDrop: -5.0, // vertical position of pad centers (mm, + up)
    padTilt: 14.0, // inward bevel of the contact face (degrees)
    // Lens glazing groove (facet) on the inner rim wall
    facetDepth: 0.8, // radial cut into the rim from the inner hole
    facetPos: 0.0, // Z offset from rim mid-plane (+ toward front)
  };

  const PAD_MIN_THICK = 1.5;

  function cloneParams(p) {
    const out = Object.assign({}, DEFAULTS, p || {});
    out.padWidth = Math.max(PAD_MIN_THICK, out.padWidth);
    out.padThickness = Math.max(PAD_MIN_THICK, out.padThickness);
    return out;
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
    meshes.push(extrudeRimWithFacet(worldR.outer, worldR.inner, params, 'rim-R'));
    meshes.push(extrudeRimWithFacet(worldL.outer, worldL.inner, params, 'rim-L'));
    if (bridge) meshes.push(extrudePolygon(bridge.outline, params.bridgeDepth, 'bridge'));
    if (pads) {
      if (pads.R && pads.R.mesh) meshes.push(pads.R.mesh);
      if (pads.L && pads.L.mesh) meshes.push(pads.L.mesh);
    }

    const combined = mergeMeshes(meshes);

    return {
      ok: true,
      params: params,
      origins: { R: originR, L: originL },
      gap: gap,
      rims: {
        R: Object.assign({ groove: offsetRingToward(worldR.inner, worldR.outer, grooveDepth(params)) }, worldR),
        L: Object.assign({ groove: offsetRingToward(worldL.inner, worldL.outer, grooveDepth(params)) }, worldL),
      },
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
   * Acetate-style pads: teardrop mounds on the nasal rim.
   * Front of the nose-face sits on the outer contour; padGap and padTilt
   * move / bevel that contact wall. Thickness is at least 1.5 mm.
   */
  function buildNosePads(rimR, rimL, params) {
    if (params.padHeight < 2 || params.rimDepth < 0.4) {
      return null;
    }
    const padR = buildPlasticPad(rimR, 'R', params);
    const padL = buildPlasticPad(rimL, 'L', params);
    return { R: padR, L: padL, y: params.padDrop, gap: params.padGap };
  }

  function buildPlasticPad(rim, side, params) {
    const towardNose = side === 'R' ? 1 : -1;
    const yMid = params.padDrop;
    const halfH = params.padHeight / 2;
    const y0 = yMid - halfH;
    const y1 = yMid + halfH;
    const n = 16;
    const pairs = sampleNasalPairs(rim, side, y0, y1, n);
    if (pairs.length < 3) return null;

    const root = [];
    const edge = [];
    const env = [];

    for (let i = 0; i < pairs.length; i++) {
      const inn = pairs[i].inner;
      const out = pairs[i].outer;
      const bulge = padEnvelope(pairs[i].t);
      env.push(bulge);

      const spanX = inn.x - out.x;
      const spanY = inn.y - out.y;
      const span = Math.hypot(spanX, spanY) || 1;

      // Glued to the outer rim. Extra padGap only insets into the rim, never past it.
      const extraApart = Math.max(0, (params.padGap - DEFAULTS.padGap) / 2);
      let tEdge = extraApart / span;
      if (tEdge < 0) tEdge = 0;
      if (tEdge > 0.85) tEdge = 0.85;
      edge.push({
        x: out.x + spanX * tEdge,
        y: out.y + spanY * tEdge,
      });

      const maxIn = Math.max(PAD_MIN_THICK, span - 0.05);
      const inset = Math.max(PAD_MIN_THICK, Math.min(params.padWidth, maxIn) * (0.22 + 0.78 * bulge));
      let tRoot = tEdge + inset / span;
      if (tRoot < tEdge + 0.08) tRoot = tEdge + 0.08;
      if (tRoot > 0.98) tRoot = 0.98;
      root.push({
        x: out.x + spanX * tRoot,
        y: out.y + spanY * tRoot,
      });
    }

    const mesh = extrudePadOnRim(root, edge, env, params, towardNose, 'pad-' + side);
    const outline2d = root.concat(edge.slice().reverse());
    const mid = edge[Math.floor(edge.length / 2)] || edge[0];
    return {
      center: { x: mid.x, y: mid.y },
      outline2d: outline2d,
      mesh: mesh,
    };
  }

  function padEnvelope(t) {
    if (t <= 0 || t >= 1) return 0;
    const peak = 0.28;
    if (t < peak) return Math.sin((t / peak) * (Math.PI / 2));
    return Math.pow(Math.cos(((t - peak) / (1 - peak)) * (Math.PI / 2)), 1.2);
  }

  function sampleNasalPairs(rim, side, y0, y1, n) {
    const nasalA = side === 'R' ? 0 : Math.PI;
    const innerNasal = filterNasal(rim.inner, nasalA);
    const src = innerNasal.length >= 8 ? innerNasal : rim.inner;
    const pairs = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const y = y0 + t * (y1 - y0);
      const inn = closestOnRing(src, y, nasalA);
      const out = closestByAngle(rim.outer, inn.a);
      pairs.push({
        inner: { x: inn.x, y: inn.y, a: inn.a },
        outer: { x: out.x, y: out.y, a: out.a },
        t: t,
      });
    }
    return pairs;
  }

  function filterNasal(ring, nasalA) {
    const out = [];
    for (let i = 0; i < ring.length; i++) {
      if (Math.abs(angleDiff(ring[i].a, nasalA)) <= 1.15) out.push(ring[i]);
    }
    return out;
  }

  function closestOnRing(ring, y, nasalA) {
    let best = ring[0];
    let bestScore = Infinity;
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i];
      const score = Math.abs(p.y - y) + Math.abs(angleDiff(p.a, nasalA)) * 1.6;
      if (score < bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return best;
  }

  function closestByAngle(ring, a) {
    let best = ring[0];
    let bestD = Infinity;
    for (let i = 0; i < ring.length; i++) {
      const d = Math.abs(angleDiff(ring[i].a, a));
      if (d < bestD) {
        bestD = d;
        best = ring[i];
      }
    }
    return best;
  }

  /**
   * Pad prism on the rim: outer edge on the outer contour, front flush.
   */
  function extrudePadOnRim(root, edge, env, params, towardNose, name) {
    const n = Math.min(root.length, edge.length);
    if (n < 2) return emptyMesh(name);
    const zF = params.rimDepth / 2;
    const zB = -params.rimDepth / 2;
    const bulge = Math.max(PAD_MIN_THICK, params.padThickness);
    const tilt = (params.padTilt * Math.PI) / 180;
    const positions = [];
    const indices = [];

    function add(x, y, z) {
      const zz = Math.min(z, zF);
      positions.push(x, y, zz);
      return positions.length / 3 - 1;
    }

    const fRoot = [];
    const bRoot = [];
    const fEdge = [];
    const bEdge = [];
    for (let i = 0; i < n; i++) {
      const e = env && env[i] != null ? env[i] : 1;
      const backExtra = -bulge * e;
      // Tilt into the rim (toward the inner hole), never past the outer edge.
      const dx = root[i].x - edge[i].x;
      const dy = root[i].y - edge[i].y;
      const len = Math.hypot(dx, dy) || 1;
      const tiltAlong = Math.min(
        Math.tan(tilt) * (params.rimDepth + bulge) * 0.4 * e,
        len * 0.45
      );
      fRoot.push(add(root[i].x, root[i].y, zF));
      bRoot.push(add(root[i].x, root[i].y, zB));
      fEdge.push(add(edge[i].x, edge[i].y, zF));
      bEdge.push(
        add(
          edge[i].x + (dx / len) * tiltAlong,
          edge[i].y + (dy / len) * tiltAlong,
          zB + backExtra
        )
      );
    }

    const sign = edge[0].x - root[0].x >= 0 ? 1 : -1;
    function tri(a, b, c) {
      if (sign >= 0) indices.push(a, b, c);
      else indices.push(a, c, b);
    }

    for (let i = 0; i < n - 1; i++) {
      const j = i + 1;
      tri(fRoot[i], fRoot[j], fEdge[j]);
      tri(fRoot[i], fEdge[j], fEdge[i]);
      tri(bRoot[i], bEdge[i], bEdge[j]);
      tri(bRoot[i], bEdge[j], bRoot[j]);
      tri(fEdge[i], bEdge[j], bEdge[i]);
      tri(fEdge[i], fEdge[j], bEdge[j]);
      tri(fRoot[i], bRoot[i], bRoot[j]);
      tri(fRoot[i], bRoot[j], fRoot[j]);
    }
    tri(fRoot[0], fEdge[0], bEdge[0]);
    tri(fRoot[0], bEdge[0], bRoot[0]);
    const last = n - 1;
    tri(fRoot[last], bRoot[last], bEdge[last]);
    tri(fRoot[last], bEdge[last], fEdge[last]);

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

  function grooveDepth(params) {
    const maxD = Math.max(0, params.rimWidth - 0.6);
    return Math.max(0, Math.min(params.facetDepth, maxD));
  }

  function offsetRingToward(from, toward, dist) {
    const n = Math.min(from.length, toward.length);
    const out = [];
    for (let i = 0; i < n; i++) {
      const dx = toward[i].x - from[i].x;
      const dy = toward[i].y - from[i].y;
      const len = Math.hypot(dx, dy) || 1;
      const d = Math.min(dist, Math.max(0, len - 0.4));
      out.push({
        x: from[i].x + (dx / len) * d,
        y: from[i].y + (dy / len) * d,
        a: from[i].a,
      });
    }
    return out;
  }

  function facetZ(params) {
    const half = params.rimDepth / 2;
    const grooveW = Math.min(1.3, Math.max(0.7, params.rimDepth * 0.38));
    const maxPos = Math.max(0, half - grooveW / 2 - 0.22);
    let z = params.facetPos;
    if (z > maxPos) z = maxPos;
    if (z < -maxPos) z = -maxPos;
    return { z: z, halfW: grooveW / 2, z1: half, z0: -half };
  }

  /**
   * Rim annulus with a V-groove on the inner wall for the lens bevel.
   */
  function extrudeRimWithFacet(outer, inner, params, name) {
    const depthCut = grooveDepth(params);
    if (depthCut < 0.05) return extrudeRing(outer, inner, params.rimDepth, name);

    const n = Math.min(outer.length, inner.length);
    if (n < 3) return emptyMesh(name);

    const fz = facetZ(params);
    const z1 = fz.z1;
    const z0 = fz.z0;
    const zGf = fz.z + fz.halfW;
    const zGb = fz.z - fz.halfW;
    const zG = fz.z;
    const groove = offsetRingToward(inner, outer, depthCut);

    const positions = [];
    const indices = [];
    function add(x, y, z) {
      positions.push(x, y, z);
      return positions.length / 3 - 1;
    }

    const fOuter = [];
    const bOuter = [];
    const inF = [];
    const inLipF = [];
    const inBot = [];
    const inLipB = [];
    const inB = [];
    for (let i = 0; i < n; i++) {
      fOuter.push(add(outer[i].x, outer[i].y, z1));
      bOuter.push(add(outer[i].x, outer[i].y, z0));
      inF.push(add(inner[i].x, inner[i].y, z1));
      inLipF.push(add(inner[i].x, inner[i].y, zGf));
      inBot.push(add(groove[i].x, groove[i].y, zG));
      inLipB.push(add(inner[i].x, inner[i].y, zGb));
      inB.push(add(inner[i].x, inner[i].y, z0));
    }

    function strip(a, b) {
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        indices.push(a[j], b[j], b[i]);
        indices.push(a[j], b[i], a[i]);
      }
    }

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      indices.push(fOuter[i], fOuter[j], inF[j]);
      indices.push(fOuter[i], inF[j], inF[i]);
      indices.push(bOuter[j], bOuter[i], inB[i]);
      indices.push(bOuter[j], inB[i], inB[j]);
      indices.push(fOuter[i], bOuter[i], bOuter[j]);
      indices.push(fOuter[i], bOuter[j], fOuter[j]);
    }
    strip(inF, inLipF);
    strip(inLipF, inBot);
    strip(inBot, inLipB);
    strip(inLipB, inB);

    return { name: name, positions: positions, indices: indices };
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
