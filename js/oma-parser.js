/**
 * OMA / VCA Data Communication Standard parser (ASCII format 1).
 * Radii are in 0.01 mm. First radius is at 0° (3 o'clock), anti-clockwise.
 */
(function (global) {
  const TRACE_TYPES = {
    F: 'Frame',
    P: 'Pattern',
    E: 'Demo / edged',
    U: 'Uncut',
    C: 'Calibration',
  };

  function parseNumberList(raw) {
    if (!raw || !String(raw).trim()) return [];
    return String(raw)
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => parseInt(s, 10))
      .filter((n) => Number.isFinite(n));
  }

  function parseChiral(raw) {
    const parts = String(raw ?? '').split(';');
    return {
      R: parts[0]?.trim() || null,
      L: parts[1]?.trim() || null,
      raw: String(raw ?? ''),
    };
  }

  function toMm(hundredths) {
    return hundredths / 100;
  }

  function parseOma(text) {
    const normalized = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));

    const records = {};
    for (const line of lines) {
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim().toUpperCase();
      const value = line.slice(eq + 1);
      if (!records[key]) records[key] = [];
      records[key].push(value);
    }

    const traces = extractTraces(lines);
    const meta = extractMeta(records);

    return { records, meta, traces, rawText: text };
  }

  function extractMeta(records) {
    const first = (key) => records[key]?.[0] ?? null;
    const chiralKeys = [
      'HBOX',
      'VBOX',
      'CIRC',
      'CIRC3D',
      'FED',
      'FCRV',
      'ZTILT',
      'IPD',
      'NPD',
      'MPD',
      'SPH',
      'CYL',
      'AX',
      'ADD',
    ];

    const meta = {
      JOB: first('JOB'),
      DO: first('DO'),
      DBL: first('DBL') != null ? parseFloat(first('DBL')) : null,
      _UTC: first('_UTC'),
      _SERIAL: first('_SERIAL') || first('SERIAL'),
      DEVICE: first('_DEVICE') || first('DEV'),
    };

    for (const key of chiralKeys) {
      if (records[key]) meta[key] = parseChiral(records[key][0]);
    }

    return meta;
  }

  function extractTraces(lines) {
    const traces = [];
    let current = null;

    const flush = () => {
      if (!current) return;
      finalizeTrace(current);
      traces.push(current);
      current = null;
    };

    const keepWithTrace = new Set(['R', 'A', 'Z', 'ZA', 'ZFMT']);

    for (const line of lines) {
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim().toUpperCase();
      const value = line.slice(eq + 1);

      if (key === 'TRCFMT') {
        flush();
        const parts = value.split(';').map((p) => p.trim());
        const format = parts[0] || '0';
        if (format === '0') {
          current = null;
          continue;
        }
        current = {
          format,
          pointCount: parseInt(parts[1] || '0', 10) || 0,
          angular: (parts[2] || 'E').toUpperCase(),
          side: (parts[3] || '?').toUpperCase(),
          traced: (parts[4] || '').toUpperCase(),
          radiiHundredths: [],
          anglesHundredths: [],
          zHundredths: [],
          points: [],
          metrics: null,
          warning: null,
        };
        if (format !== '1') {
          current.warning =
            'Формат TRCFMT=' +
            format +
            ' (бинарный) не поддерживается — нужен ASCII (1).';
        }
        continue;
      }

      if (!current) continue;

      if (key === 'R') {
        current.radiiHundredths.push(...parseNumberList(value));
      } else if (key === 'A') {
        current.anglesHundredths.push(...parseNumberList(value));
      } else if (key === 'Z') {
        current.zHundredths.push(...parseNumberList(value));
      } else if (!keepWithTrace.has(key)) {
        flush();
      }
    }
    flush();
    return traces;
  }

  function finalizeTrace(trace) {
    const n = trace.radiiHundredths.length;
    if (n === 0 || trace.format !== '1') {
      trace.points = [];
      trace.metrics = emptyMetrics();
      return;
    }

    if (trace.pointCount && n !== trace.pointCount) {
      trace.warning = [trace.warning, 'Ожидалось ' + trace.pointCount + ' точек, получено ' + n + '.']
        .filter(Boolean)
        .join(' ');
    }

    const radiiMm = trace.radiiHundredths.map(toMm);
    let anglesRad;

    if (trace.angular === 'U' && trace.anglesHundredths.length === n) {
      anglesRad = trace.anglesHundredths.map((a) => (a / 100) * (Math.PI / 180));
    } else {
      anglesRad = radiiMm.map((_, i) => (i * 2 * Math.PI) / n);
    }

    trace.points = radiiMm.map((r, i) => {
      const a = anglesRad[i];
      const z =
        trace.zHundredths.length === n ? toMm(trace.zHundredths[i]) : null;
      return {
        angle: a,
        r,
        x: r * Math.cos(a),
        y: r * Math.sin(a),
        z,
      };
    });

    trace.metrics = computeMetrics(trace.points);
  }

  function emptyMetrics() {
    return { a: 0, b: 0, ed: 0, circ: 0, minR: 0, maxR: 0, width: 0, height: 0 };
  }

  function computeMetrics(points) {
    if (!points.length) return emptyMetrics();
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minR = Infinity;
    let maxR = -Infinity;
    let circ = 0;

    for (const p of points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
      minR = Math.min(minR, p.r);
      maxR = Math.max(maxR, p.r);
    }

    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      circ += Math.hypot(b.x - a.x, b.y - a.y);
    }

    const width = maxX - minX;
    const height = maxY - minY;

    return {
      a: round2(width),
      b: round2(height),
      ed: round2(maxR * 2),
      circ: round2(circ),
      minR: round2(minR),
      maxR: round2(maxR),
      width: round2(width),
      height: round2(height),
      minX: round2(minX),
      maxX: round2(maxX),
      minY: round2(minY),
      maxY: round2(maxY),
    };
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  global.OmaParser = { parseOma, TRACE_TYPES, toMm };
})(window);
