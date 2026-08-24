(function () {
  const parseOma = window.OmaParser.parseOma;
  const TRACE_TYPES = window.OmaParser.TRACE_TYPES;
  const drawFrame = window.OmaVisualizer.drawFrame;
  const FrameModel = window.FrameModel;
  const createFrameViewer = window.FrameViewer3D.createFrameViewer;

  const SAMPLE_OMA = `JOB=SAMPLE-WECO-T6
DBL=18.00
HBOX=52.40;52.40
VBOX=35.20;35.20
TRCFMT=1;360;E;R;F
R=2643;2656;2669;2682;2694;2706;2719;2731;2744;2757
R=2770;2784;2797;2811;2825;2838;2851;2864;2872;2880
R=2887;2890;2894;2896;2897;2899;2895;2889;2883;2868
R=2852;2835;2814;2794;2773;2752;2731;2709;2686;2663
R=2637;2610;2583;2555;2527;2498;2470;2442;2415;2389
R=2364;2339;2316;2293;2271;2248;2226;2205;2184;2163
R=2145;2127;2110;2094;2078;2062;2046;2030;2016;2003
R=1990;1980;1971;1961;1953;1945;1937;1930;1922;1916
R=1911;1907;1904;1904;1903;1903;1903;1904;1904;1905
R=1905;1906;1906;1907;1908;1909;1910;1911;1912;1915
R=1919;1922;1928;1935;1942;1949;1957;1965;1974;1983
R=1992;2003;2014;2027;2041;2055;2070;2085;2100;2116
R=2133;2149;2168;2188;2208;2230;2253;2275;2298;2320
R=2344;2368;2392;2418;2445;2471;2499;2526;2553;2580
R=2607;2632;2655;2677;2697;2714;2732;2749;2766;2784
R=2797;2810;2821;2825;2828;2829;2827;2825;2823;2820
R=2817;2814;2811;2807;2802;2797;2792;2787;2781;2776
R=2771;2766;2763;2762;2760;2760;2760;2760;2759;2759
R=2758;2758;2757;2756;2755;2754;2753;2752;2751;2752
R=2753;2754;2757;2760;2763;2766;2768;2771;2774;2776
R=2779;2781;2783;2786;2787;2789;2789;2788;2787;2778
R=2767;2757;2741;2725;2709;2693;2676;2659;2639;2620
R=2597;2572;2547;2520;2492;2465;2438;2411;2384;2360
R=2336;2314;2293;2272;2251;2231;2211;2191;2172;2152
R=2134;2117;2100;2086;2071;2056;2042;2028;2015;2003
R=1992;1982;1972;1963;1954;1946;1938;1931;1923;1916
R=1911;1906;1903;1901;1900;1899;1898;1897;1896;1896
R=1895;1894;1894;1894;1894;1893;1893;1894;1894;1895
R=1898;1900;1905;1910;1916;1923;1930;1936;1944;1951
R=1959;1968;1977;1988;1999;2010;2022;2034;2047;2059
R=2072;2084;2099;2113;2127;2143;2159;2175;2191;2207
R=2222;2236;2250;2262;2272;2283;2292;2301;2310;2319
R=2328;2336;2343;2350;2356;2361;2366;2371;2375;2380
R=2385;2390;2395;2400;2406;2412;2417;2423;2429;2435
R=2441;2448;2456;2464;2473;2483;2493;2502;2512;2521
R=2532;2542;2552;2564;2575;2586;2597;2609;2620;2632
TRCFMT=1;360;E;L;F
R=2758;2759;2759;2760;2760;2760;2760;2762;2763;2766
R=2771;2776;2781;2787;2792;2797;2802;2807;2811;2814
R=2817;2820;2823;2825;2827;2829;2828;2825;2821;2810
R=2797;2784;2766;2749;2732;2714;2697;2677;2655;2632
R=2607;2580;2553;2526;2499;2471;2445;2418;2392;2368
R=2344;2320;2298;2275;2253;2230;2208;2188;2168;2149
R=2133;2116;2100;2085;2070;2055;2041;2027;2014;2003
R=1992;1983;1974;1965;1957;1949;1942;1935;1928;1922
R=1919;1915;1912;1911;1910;1909;1908;1907;1906;1906
R=1905;1905;1904;1904;1903;1903;1903;1904;1904;1907
R=1911;1916;1922;1930;1937;1945;1953;1961;1971;1980
R=1990;2003;2016;2030;2046;2062;2078;2094;2110;2127
R=2145;2163;2184;2205;2226;2248;2271;2293;2316;2339
R=2364;2389;2415;2442;2470;2498;2527;2555;2583;2610
R=2637;2663;2686;2709;2731;2752;2773;2794;2814;2835
R=2852;2868;2883;2889;2895;2899;2897;2896;2894;2890
R=2887;2880;2872;2864;2851;2838;2825;2811;2797;2784
R=2770;2757;2744;2731;2719;2706;2694;2682;2669;2656
R=2643;2632;2620;2609;2597;2586;2575;2564;2552;2542
R=2532;2521;2512;2502;2493;2483;2473;2464;2456;2448
R=2441;2435;2429;2423;2417;2412;2406;2400;2395;2390
R=2385;2380;2375;2371;2366;2361;2356;2350;2343;2336
R=2328;2319;2310;2301;2292;2283;2272;2262;2250;2236
R=2222;2207;2191;2175;2159;2143;2127;2113;2099;2084
R=2072;2059;2047;2034;2022;2010;1999;1988;1977;1968
R=1959;1951;1944;1936;1930;1923;1916;1910;1905;1900
R=1898;1895;1894;1894;1893;1893;1894;1894;1894;1894
R=1895;1896;1896;1897;1898;1899;1900;1901;1903;1906
R=1911;1916;1923;1931;1938;1946;1954;1963;1972;1982
R=1992;2003;2015;2028;2042;2056;2071;2086;2100;2117
R=2134;2152;2172;2191;2211;2231;2251;2272;2293;2314
R=2336;2360;2384;2411;2438;2465;2492;2520;2547;2572
R=2597;2620;2639;2659;2676;2693;2709;2725;2741;2757
R=2767;2778;2787;2788;2789;2789;2787;2786;2783;2781
R=2779;2776;2774;2771;2768;2766;2763;2760;2757;2754
R=2753;2752;2751;2752;2753;2754;2755;2756;2757;2758
`;

  const PARAM_KEYS = [
    'rimWidth',
    'rimDepth',
    'seatInset',
    'dbl',
    'bridgeHeight',
    'bridgeDepth',
    'bridgeDrop',
    'bridgeReach',
    'facetPos',
    'facetDepth',
    'padWidth',
    'padHeight',
    'padThickness',
    'padGap',
    'padDrop',
    'padTilt',
  ];

  const els = {
    fileInput: document.getElementById('fileInput'),
    sampleBtn: document.getElementById('sampleBtn'),
    clearBtn: document.getElementById('clearBtn'),
    exportStlBtn: document.getElementById('exportStlBtn'),
    resetParamsBtn: document.getElementById('resetParamsBtn'),
    dropzone: document.getElementById('dropzone'),
    canvas: document.getElementById('canvas'),
    emptyState: document.getElementById('emptyState'),
    empty3d: document.getElementById('empty3d'),
    view3d: document.getElementById('view3d'),
    fileMeta: document.getElementById('fileMeta'),
    metrics: document.getElementById('metrics'),
    records: document.getElementById('records'),
    warnPanel: document.getElementById('warnPanel'),
    warnings: document.getElementById('warnings'),
    togPoints: document.getElementById('togPoints'),
    togGrid: document.getElementById('togGrid'),
    togAxes: document.getElementById('togAxes'),
    togFrame2d: document.getElementById('togFrame2d'),
    tabScan: document.getElementById('tabScan'),
    tabFrame: document.getElementById('tabFrame'),
    panelScan: document.getElementById('panelScan'),
    panelFrame: document.getElementById('panelFrame'),
  };

  let state = null;
  let frameParams = FrameModel.cloneParams();
  let frameModel = null;
  let viewer3d = null;
  let activeTab = 'scan';

  els.fileInput.addEventListener('change', function (e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      loadDocument(String(reader.result || ''), file.name);
    };
    reader.readAsText(file);
    els.fileInput.value = '';
  });

  els.sampleBtn.addEventListener('click', function () {
    loadDocument(SAMPLE_OMA, 'sample.oma');
  });

  els.clearBtn.addEventListener('click', function () {
    state = null;
    frameModel = null;
    if (viewer3d) viewer3d.setModel(null);
    render();
  });

  els.exportStlBtn.addEventListener('click', function () {
    if (!frameModel || !frameModel.ok) return;
    const base = (state && state.name ? state.name.replace(/\.[^.]+$/, '') : 'oma') + '-frame';
    FrameModel.downloadSTL(frameModel.mesh, base + '.stl');
  });

  els.resetParamsBtn.addEventListener('click', function () {
    initParamsFromDoc(state && state.doc);
    syncParamInputs();
    rebuildFrame();
    renderViews();
  });

  ['togPoints', 'togGrid', 'togAxes', 'togFrame2d'].forEach(function (id) {
    els[id].addEventListener('change', renderCanvas);
  });

  PARAM_KEYS.forEach(function (key) {
    const input = document.getElementById('p-' + key);
    if (!input) return;
    input.addEventListener('input', function () {
      frameParams[key] = parseFloat(input.value);
      const digits = key === 'padTilt' ? 0 : 1;
      document.getElementById('val-' + key).textContent = frameParams[key].toFixed(digits);
      rebuildFrame();
      renderViews();
    });
  });

  document.querySelectorAll('.tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setTab(btn.getAttribute('data-tab'));
    });
  });

  setupDropzone(els.dropzone);
  window.addEventListener('resize', function () {
    renderCanvas();
    if (viewer3d) viewer3d.resize();
  });

  syncParamInputs();

  function setTab(name) {
    activeTab = name;
    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === name);
    });
    document.querySelectorAll('.tab-panel').forEach(function (p) {
      p.classList.toggle('active', p.getAttribute('data-panel') === name);
    });
    if (name === 'frame') {
      ensureViewer3d();
      if (viewer3d) {
        viewer3d.resize();
        viewer3d.setModel(frameModel);
      }
    }
  }

  function ensureViewer3d() {
    if (viewer3d) return;
    viewer3d = createFrameViewer(els.view3d);
    if (frameModel) viewer3d.setModel(frameModel);
  }

  function setupDropzone(zone) {
    ['dragenter', 'dragover'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) {
        e.preventDefault();
        zone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) {
        e.preventDefault();
        zone.classList.remove('dragover');
      });
    });
    zone.addEventListener('drop', function (e) {
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        loadDocument(String(reader.result || ''), file.name);
      };
      reader.readAsText(file);
    });
  }

  function loadDocument(text, name) {
    try {
      const doc = parseOma(text);
      state = { doc: doc, name: name };
      initParamsFromDoc(doc);
      syncParamInputs();
      rebuildFrame();
      render();
    } catch (err) {
      console.error(err);
      alert('РћС€РёР±РєР° СЂР°Р·Р±РѕСЂР° OMA: ' + (err && err.message ? err.message : err));
    }
  }

  function initParamsFromDoc(doc) {
    frameParams = FrameModel.cloneParams();
    if (doc && doc.meta && doc.meta.DBL != null && Number.isFinite(doc.meta.DBL)) {
      frameParams.dbl = doc.meta.DBL;
    }
  }

  function syncParamInputs() {
    PARAM_KEYS.forEach(function (key) {
      const input = document.getElementById('p-' + key);
      const label = document.getElementById('val-' + key);
      if (!input) return;
      input.value = String(frameParams[key]);
      if (label) {
        const digits = key === 'padTilt' ? 0 : 1;
        label.textContent = Number(frameParams[key]).toFixed(digits);
      }
    });
  }

  function rebuildFrame() {
    if (!state) {
      frameModel = null;
      return;
    }
    frameModel = FrameModel.buildFrameModel(state.doc, frameParams);
  }

  function render() {
    const has = !!state;
    els.emptyState.classList.toggle('hidden', has);
    els.empty3d.classList.toggle('hidden', has && frameModel && frameModel.ok);
    els.clearBtn.disabled = !has;
    els.resetParamsBtn.disabled = !has;
    els.exportStlBtn.disabled = !(frameModel && frameModel.ok);

    document.querySelectorAll('#frameControls input, #frameControls button').forEach(function (el) {
      if (el.id === 'resetParamsBtn') return;
      el.disabled = !has;
    });

    if (!has) {
      els.fileMeta.innerHTML = '<div><dt>РРјСЏ</dt><dd>вЂ”</dd></div>';
      els.metrics.innerHTML =
        '<p class="muted">Р—Р°РіСЂСѓР·РёС‚Рµ СЃРєР°РЅ, С‡С‚РѕР±С‹ СѓРІРёРґРµС‚СЊ A / B / ED / CIRC</p>';
      els.records.textContent = 'вЂ”';
      els.records.classList.add('muted');
      els.warnPanel.classList.add('hidden');
      clearCanvas();
      if (viewer3d) viewer3d.setModel(null);
      return;
    }

    renderFileMeta(state.name, state.doc);
    renderMetrics(state.doc);
    renderRecords(state.doc);
    renderWarnings(state.doc);
    renderViews();
  }

  function renderViews() {
    renderCanvas();
    if (viewer3d) viewer3d.setModel(frameModel);
    els.exportStlBtn.disabled = !(frameModel && frameModel.ok);
    els.empty3d.classList.toggle('hidden', !!(frameModel && frameModel.ok));
  }

  function clearCanvas() {
    const ctx = els.canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = els.canvas.clientWidth || 800;
    const h = els.canvas.clientHeight || 520;
    els.canvas.width = w * dpr;
    els.canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#e8edf1';
    ctx.fillRect(0, 0, w, h);
  }

  function renderCanvas() {
    if (!state) return;
    drawFrame(
      els.canvas,
      { traces: state.doc.traces, dbl: frameParams.dbl },
      {
        showPoints: els.togPoints.checked,
        showGrid: els.togGrid.checked,
        showAxes: els.togAxes.checked,
        frameModel: els.togFrame2d.checked ? frameModel : null,
      }
    );
  }

  function renderFileMeta(name, doc) {
    const sides = doc.traces
      .map(function (t) {
        return t.side;
      })
      .filter(Boolean)
      .join(', ');
    const rows = [
      ['РРјСЏ', name],
      ['JOB', doc.meta.JOB || 'вЂ”'],
      ['DBL С„Р°Р№Р»Р°', doc.meta.DBL != null ? doc.meta.DBL + ' mm' : 'вЂ”'],
      ['DBL СЂР°РјРєРё', frameParams.dbl.toFixed(1) + ' mm'],
      ['РЎС‚РѕСЂРѕРЅС‹', sides || 'вЂ”'],
    ];
    els.fileMeta.innerHTML = rows
      .map(function (row) {
        return (
          '<div><dt>' +
          escapeHtml(row[0]) +
          '</dt><dd>' +
          escapeHtml(String(row[1])) +
          '</dd></div>'
        );
      })
      .join('');
  }

  function renderMetrics(doc) {
    if (!doc.traces.length) {
      els.metrics.innerHTML = '<p class="muted">РљРѕРЅС‚СѓСЂ РЅРµ РЅР°Р№РґРµРЅ</p>';
      return;
    }

    els.metrics.innerHTML = doc.traces
      .map(function (t) {
        const m = t.metrics || {};
        const type = TRACE_TYPES[t.traced] || t.traced || 'вЂ”';
        const sideClass = t.side === 'L' ? 'l' : 'r';
        return (
          '<article class="eye-card">' +
          '<h3><span class="dot ' +
          sideClass +
          '"></span> ' +
          escapeHtml(t.side) +
          ' В· ' +
          escapeHtml(type) +
          ' В· ' +
          t.radiiHundredths.length +
          ' pts</h3>' +
          '<div class="stat-grid">' +
          '<div class="stat"><span>A (С€РёСЂ.)</span><strong>' +
          fmt(m.a) +
          ' mm</strong></div>' +
          '<div class="stat"><span>B (РІС‹СЃ.)</span><strong>' +
          fmt(m.b) +
          ' mm</strong></div>' +
          '<div class="stat"><span>ED</span><strong>' +
          fmt(m.ed) +
          ' mm</strong></div>' +
          '<div class="stat"><span>CIRC</span><strong>' +
          fmt(m.circ) +
          ' mm</strong></div>' +
          '</div></article>'
        );
      })
      .join('');
  }

  function renderRecords(doc) {
    const skip = { R: 1, A: 1, Z: 1, ZA: 1 };
    const lines = [];
    Object.keys(doc.records).forEach(function (key) {
      if (skip[key]) return;
      doc.records[key].forEach(function (v) {
        lines.push(key + '=' + v);
      });
    });
    doc.traces.forEach(function (t) {
      lines.push(
        '# ' +
          t.side +
          ': TRCFMT=' +
          t.format +
          ';' +
          t.pointCount +
          ';' +
          t.angular +
          ';' +
          t.side +
          ';' +
          t.traced +
          ' в†’ ' +
          t.radiiHundredths.length +
          ' R'
      );
    });
    els.records.textContent = lines.length ? lines.join('\n') : 'вЂ”';
    els.records.classList.toggle('muted', !lines.length);
  }

  function renderWarnings(doc) {
    const warnings = [];
    doc.traces.forEach(function (t) {
      if (t.warning) warnings.push(t.warning);
    });
    if (frameModel && !frameModel.ok && frameModel.error) warnings.push(frameModel.error);
    if (!warnings.length) {
      els.warnPanel.classList.add('hidden');
      return;
    }
    els.warnPanel.classList.remove('hidden');
    els.warnings.innerHTML = warnings
      .map(function (w) {
        return '<li>' + escapeHtml(w) + '</li>';
      })
      .join('');
  }

  function fmt(n) {
    if (n == null || !Number.isFinite(n)) return 'вЂ”';
    return n.toFixed(2);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();

