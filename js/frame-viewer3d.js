/**
 * Three.js frame preview with simple orbit controls (works from file://).
 */
(function (global) {
  function createFrameViewer(container) {
    if (!global.THREE) {
      return {
        ok: false,
        error: 'Three.js не загружен',
        setModel: function () {},
        resize: function () {},
        dispose: function () {},
      };
    }

    const THREE = global.THREE;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe8edf1);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 2000);
    camera.position.set(0, -120, 90);
    camera.up.set(0, 0, 1);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xffffff, 0xb0c0c8, 0.85);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 0.7);
    key.position.set(40, -60, 80);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xa8c4ff, 0.35);
    fill.position.set(-50, 40, 30);
    scene.add(fill);

    const grid = new THREE.GridHelper(160, 16, 0x9aadb8, 0xc5d3df);
    grid.rotation.x = Math.PI / 2;
    scene.add(grid);

    let frameGroup = new THREE.Group();
    // Front of the frame (+Z) faces the print bed (−Z): inner side and pads stay visible from above.
    frameGroup.rotation.x = Math.PI;
    scene.add(frameGroup);

    const orbit = {
      theta: 0.35,
      phi: 0.85,
      radius: 160,
      target: new THREE.Vector3(0, 0, 0),
    };

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let raf = 0;

    function applyOrbit() {
      const s = Math.sin(orbit.phi);
      camera.position.set(
        orbit.target.x + orbit.radius * s * Math.sin(orbit.theta),
        orbit.target.y - orbit.radius * s * Math.cos(orbit.theta),
        orbit.target.z + orbit.radius * Math.cos(orbit.phi)
      );
      camera.lookAt(orbit.target);
    }

    function onPointerDown(e) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      renderer.domElement.setPointerCapture(e.pointerId);
    }
    function onPointerUp(e) {
      dragging = false;
      try {
        renderer.domElement.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
    function onPointerMove(e) {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      orbit.theta -= dx * 0.01;
      orbit.phi = clamp(orbit.phi - dy * 0.01, 0.12, Math.PI - 0.12);
      applyOrbit();
    }
    function onWheel(e) {
      e.preventDefault();
      orbit.radius = clamp(orbit.radius * (e.deltaY > 0 ? 1.08 : 0.92), 40, 500);
      applyOrbit();
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    function resize() {
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 480;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
    }

    function clearGroup() {
      while (frameGroup.children.length > 0) {
        const ch = frameGroup.children[0];
        frameGroup.remove(ch);
        if (ch.geometry) ch.geometry.dispose();
        if (ch.material) {
          if (Array.isArray(ch.material))
            ch.material.forEach(function (m) {
              m.dispose();
            });
          else ch.material.dispose();
        }
      }
    }

    function meshFromData(data, color, opacity) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(data.positions);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setIndex(data.indices);
      geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({
        color: color,
        metalness: 0.05,
        roughness: 0.55,
        transparent: opacity < 1,
        opacity: opacity,
        side: THREE.DoubleSide,
      });
      return new THREE.Mesh(geo, mat);
    }

    function setModel(model) {
      clearGroup();
      if (!model || !model.ok) return;

      const rimMatColor = 0x1a5c58;
      const bridgeColor = 0x245a8a;

      if (model.parts) {
        model.parts.forEach(function (part) {
          if (!part.positions.length) return;
          const color =
            part.name === 'bridge' ? bridgeColor : part.name.indexOf('pad-') === 0 ? 0x2e7a72 : rimMatColor;
          frameGroup.add(meshFromData(part, color, 1));
        });
      } else if (model.mesh) {
        frameGroup.add(meshFromData(model.mesh, rimMatColor, 1));
      }

      // Lens openings as faint discs hint
      if (model.rims) {
        ['R', 'L'].forEach(function (side) {
          const rim = model.rims[side];
          if (!rim) return;
          const shape = new THREE.Shape();
          rim.inner.forEach(function (p, i) {
            if (i === 0) shape.moveTo(p.x, p.y);
            else shape.lineTo(p.x, p.y);
          });
          shape.closePath();
          const g = new THREE.ShapeGeometry(shape);
          const m = new THREE.Mesh(
            g,
            new THREE.MeshBasicMaterial({
              color: 0x9ec5c2,
              transparent: true,
              opacity: 0.22,
              side: THREE.DoubleSide,
            })
          );
          m.position.z = 0.05;
          frameGroup.add(m);
        });
      }

      // Fit camera
      const box = new THREE.Box3().setFromObject(frameGroup);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      orbit.target.copy(center);
      orbit.radius = Math.max(size.x, size.y, size.z) * 1.6 || 160;
      applyOrbit();
    }

    function tick() {
      raf = requestAnimationFrame(tick);
      renderer.render(scene, camera);
    }

    resize();
    applyOrbit();
    tick();

    return {
      ok: true,
      setModel: setModel,
      resize: resize,
      dispose: function () {
        cancelAnimationFrame(raf);
        clearGroup();
        renderer.dispose();
        container.innerHTML = '';
      },
    };
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  global.FrameViewer3D = { createFrameViewer: createFrameViewer };
})(window);
