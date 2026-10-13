import { useEffect, useRef, useState } from "react";

// A real-time glass atom on a transparent canvas: a matte violet core inside a
// clear glass nucleus, three brushed-steel orbits, one amber electron (the
// signal colour) and two pale ones. three.js loads after first paint so the
// page is never blocked: it starts on the first interaction. Until then, and
// when WebGL is unavailable, the photographed cut-out stands in.
//
// `scrollRef` (optional) points at an element; the atom turns and grows as the
// page scrolls past it. Scroll is read inside the render loop, not in a listener.

const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function webgl() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

export default function Atom3D({ className = "", scrollRef, label = "A glass atom with a violet core and three orbits", poster = true, compact = false }) {
  const host = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!host.current || !webgl()) return;
    let disposed = false;
    let cleanup = () => {};

    const start = async () => {
      const THREE = await import("three");
      const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
      if (disposed || !host.current) return;

      const el = host.current;
      const small = window.innerWidth < 760;
      const renderer = new THREE.WebGLRenderer({ antialias: !small, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.domElement.setAttribute("aria-hidden", "true");
      el.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;

      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
      camera.position.set(0, 0, compact ? 9 : 10);

      const seg = small ? 48 : 96;
      const atom = new THREE.Group();
      scene.add(atom);

      // Nucleus: violet core inside clear glass
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, seg, seg),
        new THREE.MeshPhysicalMaterial({ color: 0x5b3bea, roughness: 0.55, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.6, sheen: 0.6, sheenColor: new THREE.Color(0xae9cff) })
      );
      const glass = new THREE.Mesh(
        new THREE.SphereGeometry(0.82, seg, seg),
        new THREE.MeshPhysicalMaterial({
          color: 0xffffff, roughness: 0.02, metalness: 0, transmission: 1, thickness: 0.45, ior: 1.22,
          attenuationColor: new THREE.Color(0xf1edff), attenuationDistance: 12,
          clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1, envMapIntensity: 1.6,
          iridescence: 0.15, iridescenceIOR: 1.3, iridescenceThicknessRange: [120, 420],
        })
      );
      atom.add(core, glass);

      // Orbits and electrons
      const steel = new THREE.MeshStandardMaterial({ color: 0xbdb7d4, metalness: 1, roughness: 0.35, envMapIntensity: 0.9 });
      const ringGeo = new THREE.TorusGeometry(2.25, 0.008, 8, small ? 160 : 260);
      const electronGeo = new THREE.SphereGeometry(0.09, 32, 32);
      const amber = new THREE.MeshPhysicalMaterial({ color: 0xf2b04a, roughness: 0.08, transmission: 0.55, thickness: 0.4, ior: 1.5, clearcoat: 1, attenuationColor: new THREE.Color(0xc56a00), attenuationDistance: 0.4 });
      const pale = new THREE.MeshPhysicalMaterial({ color: 0xece8ff, roughness: 0.15, metalness: 0.1, clearcoat: 1 });
      const tilts = [
        [Math.PI / 2.15, 0.25, 0],
        [Math.PI / 2.4, -0.95, 0.5],
        [Math.PI / 2.0, 1.05, -0.45],
      ];
      const orbits = tilts.map(([x, y, z], i) => {
        const g = new THREE.Group();
        g.rotation.set(x, y, z);
        g.add(new THREE.Mesh(ringGeo, steel));
        // Minimal: one amber electron; the other orbits stay empty.
        const e = new THREE.Mesh(electronGeo, i === 0 ? amber : pale);
        e.visible = i === 0;
        g.add(e);
        atom.add(g);
        return { g, e, speed: [0.32, -0.24, 0.2][i], phase: [0.4, 2.2, 4.1][i] };
      });

      // Light: env carries most of it; a key from upper left and a violet rim
      const key = new THREE.DirectionalLight(0xffffff, 1.6);
      key.position.set(-4, 5, 6);
      const rim = new THREE.PointLight(0x8f74ff, 30, 20);
      rim.position.set(4, -2, -3);
      scene.add(key, rim, new THREE.AmbientLight(0x6b5ccc, 0.25));

      // Size
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

      // Pointer parallax
      const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
      const onPointer = (e) => {
        tilt.tx = (e.clientX / window.innerWidth - 0.5) * 0.5;
        tilt.ty = (e.clientY / window.innerHeight - 0.5) * 0.35;
      };
      window.addEventListener("pointermove", onPointer, { passive: true });

      // Render only while on screen
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
        atom.rotation.y = t * 0.1 + tilt.x + p * 1.6;
        atom.rotation.x = 0.18 + tilt.y + p * 0.6;
        const sc = 1 + p * 0.35;
        atom.scale.setScalar(sc);
        atom.position.y = p * -0.6;

        orbits.forEach(({ e, speed, phase }) => {
          const a = phase + t * speed * 2.2;
          e.position.set(Math.cos(a) * 2.25, Math.sin(a) * 2.25, 0);
        });
        core.rotation.y = -t * 0.3;

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
        scene.traverse((o) => { o.geometry?.dispose?.(); });
        [core.material, glass.material, steel, amber, pale].forEach((m) => m.dispose());
        envTex.dispose();
        pmrem.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    };

    // Start on the first sign of a person: pointer, touch, scroll or key. Until
    // then (and on low-power or data-saver devices) the photographed atom shows.
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
      {poster && (
        <img className="atom3d__poster" src="/objects/cut-atom-720.webp" srcSet="/objects/cut-atom-360.webp 360w, /objects/cut-atom-720.webp 720w" sizes="(max-width: 760px) 80vw, 560px" width="720" height="720" alt="" decoding="async" fetchpriority="low" />
      )}
    </div>
  );
}
