import { useEffect, useRef, useState } from "react";

// A scientific line-art atom on a transparent canvas: hairline Bohr orbits,
// a small nucleus of protons and neutrons, and a cloud of points sampled from
// the hydrogen 2p orbital density, |ψ|² ∝ z² e^(−r) (in Bohr radii). One amber
// electron, two pale ones.
//
// three.js starts on the first interaction so it never blocks the page. Until
// then, and when WebGL is unavailable, an SVG drawing of the same atom shows.
// `scrollRef` (optional) points at an element; the atom turns as the page
// scrolls past it. Scroll is read inside the render loop, not in a listener.

const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function webgl() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

// Rejection-sample the 2p_z density. Max of z² e^(−r) is 4/e² at z = r = 2.
function sample2p(n, rand = Math.random) {
  const out = new Float32Array(n * 3);
  const R = 10, max = 4 * Math.exp(-2);
  let k = 0;
  while (k < n) {
    const x = (rand() * 2 - 1) * R, y = (rand() * 2 - 1) * R, z = (rand() * 2 - 1) * R;
    const r = Math.hypot(x, y, z);
    if (rand() * max < z * z * Math.exp(-r)) { out[k * 3] = x; out[k * 3 + 1] = y; out[k * 3 + 2] = z; k++; }
  }
  return out;
}

// Static stand-in: the same atom as a drawing.
function Poster() {
  return (
    <svg className="atom3d__poster" viewBox="-120 -120 240 240" aria-hidden="true" focusable="false">
      <g className="atom3d__orbits">
        <ellipse rx="96" ry="30" transform="rotate(-24)" />
        <ellipse rx="96" ry="30" transform="rotate(36)" />
        <ellipse rx="96" ry="30" transform="rotate(96)" />
      </g>
      <g className="atom3d__nucleus">
        <circle cx="-4" cy="-3" r="5.5" /><circle cx="5" cy="-2" r="5.5" className="n" /><circle cx="0" cy="5" r="5.5" />
        <circle cx="-6" cy="5" r="5.5" className="n" /><circle cx="6" cy="6" r="5.5" />
      </g>
      <circle className="atom3d__e atom3d__e--amber" cx="88" cy="-37" r="3.6" />
      <circle className="atom3d__e" cx="-28" cy="-86" r="2.4" />
      <circle className="atom3d__e" cx="-60" cy="78" r="2.4" />
    </svg>
  );
}

export default function Atom3D({ className = "", scrollRef, label = "A diagram of an atom: a nucleus, three orbits and an electron cloud", compact = false }) {
  const host = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!host.current || !webgl()) return;
    let disposed = false;
    let cleanup = () => {};

    const start = async () => {
      const THREE = await import("three");
      if (disposed || !host.current) return;

      const el = host.current;
      const small = window.innerWidth < 760;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.setAttribute("aria-hidden", "true");
      el.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      camera.position.set(0, 0, compact ? 10.5 : 11);

      const atom = new THREE.Group();
      scene.add(atom);
      const disposables = [];
      const keep = (o) => (disposables.push(o), o);

      // Nucleus: three protons (violet), three neutrons (pale), packed tight
      const nucleon = keep(new THREE.SphereGeometry(0.17, 32, 32));
      const proton = keep(new THREE.MeshStandardMaterial({ color: 0x7b5cff, roughness: 0.45, metalness: 0.05 }));
      const neutron = keep(new THREE.MeshStandardMaterial({ color: 0xd9d4ec, roughness: 0.55, metalness: 0.05 }));
      const nucleus = new THREE.Group();
      [[0.1, 0.12, 0.05, 1], [-0.14, 0.04, 0.08, 0], [0.04, -0.14, 0.1, 1], [-0.05, 0.02, -0.16, 0], [0.16, -0.06, -0.08, 0], [-0.1, -0.12, -0.04, 1]]
        .forEach(([x, y, z, p]) => { const m = new THREE.Mesh(nucleon, p ? proton : neutron); m.position.set(x, y, z); nucleus.add(m); });
      atom.add(nucleus);

      // Electron cloud: 2p orbital, sampled
      const N = small ? 1400 : 2600;
      const cloudGeo = keep(new THREE.BufferGeometry());
      cloudGeo.setAttribute("position", new THREE.BufferAttribute(sample2p(N), 3));
      const cloudMat = keep(new THREE.PointsMaterial({ color: 0xae9cff, size: 0.026, sizeAttenuation: true, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
      const cloud = new THREE.Points(cloudGeo, cloudMat);
      cloud.scale.setScalar(0.19);
      cloud.rotation.set(0.5, 0, 0.35);
      atom.add(cloud);

      // Bohr orbits: hairlines
      const R = 2.35;
      const ringPts = Array.from({ length: 257 }, (_, i) => { const a = (i / 256) * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0); });
      const ringGeo = keep(new THREE.BufferGeometry().setFromPoints(ringPts));
      const ringMat = keep(new THREE.LineBasicMaterial({ color: 0xc9c3e6, transparent: true, opacity: 0.55 }));
      const eGeo = keep(new THREE.SphereGeometry(0.055, 20, 20));
      const amber = keep(new THREE.MeshBasicMaterial({ color: 0xf2b04a }));
      const pale = keep(new THREE.MeshBasicMaterial({ color: 0xf4f2fb }));
      const tilts = [[Math.PI / 2.2, 0.2, 0], [Math.PI / 2.3, -1.05, 0.45], [Math.PI / 2.05, 1.1, -0.4]];
      const orbits = tilts.map(([x, y, z], i) => {
        const g = new THREE.Group();
        g.rotation.set(x, y, z);
        g.add(new THREE.Line(ringGeo, ringMat));
        const e = new THREE.Mesh(eGeo, i === 0 ? amber : pale);
        if (i === 0) e.scale.setScalar(1.45);
        g.add(e);
        atom.add(g);
        return { e, speed: [0.3, -0.22, 0.18][i], phase: [0.4, 2.2, 4.1][i] };
      });

      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const key = new THREE.DirectionalLight(0xffffff, 1.6);
      key.position.set(-3, 4, 5);
      scene.add(key);

      const resize = () => {
        const w = el.clientWidth || 1, h = el.clientHeight || 1;
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(el);

      const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
      const onPointer = (e) => {
        tilt.tx = (e.clientX / window.innerWidth - 0.5) * 0.4;
        tilt.ty = (e.clientY / window.innerHeight - 0.5) * 0.3;
      };
      window.addEventListener("pointermove", onPointer, { passive: true });

      let visible = true;
      const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) loop(); }, { rootMargin: "120px" });
      io.observe(el);

      const still = reduced();
      const clock = new THREE.Clock();
      let raf = 0, t = 0;
      const frame = () => {
        const dt = Math.min(clock.getDelta(), 0.05);
        if (!still) t += dt;
        let p = 0;
        const s = scrollRef?.current;
        if (s) {
          const r = s.getBoundingClientRect();
          p = Math.min(Math.max(-r.top / Math.max(r.height, 1), 0), 1);
        }
        tilt.x += (tilt.tx - tilt.x) * 0.06;
        tilt.y += (tilt.ty - tilt.y) * 0.06;
        atom.rotation.y = t * 0.08 + tilt.x + p * 1.4;
        atom.rotation.x = 0.15 + tilt.y + p * 0.4;
        cloud.rotation.z = 0.35 + t * 0.05;
        nucleus.rotation.y = t * 0.3;
        orbits.forEach(({ e, speed, phase }) => {
          const a = phase + t * speed * 2.2;
          e.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
        });
        renderer.render(scene, camera);
      };
      const loop = () => {
        cancelAnimationFrame(raf);
        const tick = () => {
          if (!visible || document.hidden) return;
          frame();
          raf = requestAnimationFrame(tick);
        };
        tick();
      };
      const onVis = () => { if (!document.hidden) loop(); };
      document.addEventListener("visibilitychange", onVis);

      frame();
      setReady(true);
      if (!still) loop();

      cleanup = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        ro.disconnect();
        window.removeEventListener("pointermove", onPointer);
        document.removeEventListener("visibilitychange", onVis);
        disposables.forEach((d) => d.dispose());
        renderer.dispose();
        renderer.domElement.remove();
      };
    };

    // Start on the first sign of a person: pointer, touch, scroll or key.
    const conn = navigator.connection;
    const lowPower = conn?.saveData || (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4);
    const EVENTS = ["pointermove", "pointerdown", "touchstart", "scroll", "keydown", "wheel"];
    let started = false;
    const kick = () => {
      if (started || disposed) return;
      started = true;
      EVENTS.forEach((ev) => window.removeEventListener(ev, kick));
      const idle = window.requestIdleCallback || ((f) => setTimeout(f, 60));
      idle(() => { if (!disposed) start().catch(() => {}); }, { timeout: 600 });
    };
    if (!lowPower) EVENTS.forEach((ev) => window.addEventListener(ev, kick, { passive: true, once: true }));

    return () => { disposed = true; cleanup(); EVENTS.forEach((ev) => window.removeEventListener(ev, kick)); };
  }, [scrollRef, compact]);

  return (
    <div ref={host} className={`atom3d ${ready ? "is-ready" : ""} ${className}`} role="img" aria-label={label}>
      <Poster />
    </div>
  );
}
