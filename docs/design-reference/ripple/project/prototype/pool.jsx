/* ─────────────────────────────────────────────────────────────────────
   Pool — the home-page centerpiece.
   A circular pool of water seen from a slight 3/4 perspective, on which
   the orb floats. Three layers compose the effect:

     1. Caustic shimmer — slow drifting noise field that brightens where
        wave crests coincide. Gives the pool depth and "lit-from-below".
     2. Ripple field — concentric wave packets emanating outward from the
        orb (and from cursor disturbances). Each packet evaluates the
        damped Gaussian × cosine wave equation:

           z(r, t) = A · e^(-α τ) · e^(-(r - vτ)² / σ(τ)²) · cos(k(r - vτ))

        Multiple packets coexist; they pass through each other and sum.
     3. Crest highlight — luminous arcs at z > threshold, with caustic
        shimmer brightening on top. This is what makes it feel ALIVE.

   The orb's bob clock (window.__rippleClock) emits a packet on every
   downward zero-crossing — so each bob seeds a ring. Cursor movement
   inside the pool emits smaller packets continuously. forceSplash() seeds
   a much larger packet for search-submit.
   ───────────────────────────────────────────────────────────────────── */

function Pool({ listening, submitting }) {
  const canvasRef = React.useRef(null);
  const wrapRef   = React.useRef(null);
  const listeningRef  = React.useRef(listening);
  const submittingRef = React.useRef(submitting);
  React.useEffect(() => { listeningRef.current = listening; }, [listening]);
  React.useEffect(() => { submittingRef.current = submitting; }, [submitting]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const wrap   = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d", { alpha: true });

    // ── Setup geometry & DPR ──────────────────────────────────────
    let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    let W = 0, H = 0, cx = 0, cy = 0, poolR = 220, perspY = 0.55; // perspY < 1 = looking down at it
    function resize() {
      const r = wrap.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width  = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width  = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W / 2;
      cy = H / 2 + 6;          // pool center sits a hair below orb center
      poolR = Math.min(W, H) * 0.46;   // pool radius
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // ── Cursor-driven splashes ────────────────────────────────────
    // Inside the pool, the cursor leaves micro-disturbances (small packets)
    // every ~80ms while moving, scaled by speed. Hovering still emits at
    // a slow rate so the pool always responds to attention.
    let lastCursor = { x: 0, y: 0, t: 0, has: false };
    let lastEmit   = 0;
    function onMove(e) {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const dx = x - cx, dy = (y - cy) / perspY;
      const d  = Math.hypot(dx, dy);
      if (d > poolR * 1.1) { lastCursor.has = false; return; }   // outside pool
      const now = performance.now() / 1000;
      const dt  = lastCursor.has ? Math.max(0.001, now - lastCursor.t) : 0.05;
      const speed = lastCursor.has ? Math.hypot(x - lastCursor.x, y - lastCursor.y) / dt : 0;
      lastCursor = { x, y, t: now, has: true };
      // Emit a small packet at most every ~80ms, scaled by speed.
      if (now - lastEmit > 0.08) {
        const amp = Math.max(0.06, Math.min(0.45, speed / 1800));
        if (amp > 0.06) {
          packets.push({ x, y, t0: now, amp, kind: "cursor" });
          lastEmit = now;
        }
      }
    }
    function onLeave() { lastCursor.has = false; }
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);

    // ── Packet store ─────────────────────────────────────────────
    // Each packet has origin (px), birth time, amplitude, kind.
    const packets = [];
    const MAX = 24;

    // Hook into the global ripple clock — every natural splash from the
    // orb adds a packet at the orb's center. We track t0 values we've
    // already seen so we don't double-add.
    const seen = new Set();
    const unsub = window.__rippleClock.subscribe(({ splashes, t }) => {
      for (const s of splashes) {
        if (seen.has(s.t0)) continue;
        seen.add(s.t0);
        packets.push({ x: cx, y: cy, t0: s.t0, amp: 0.7 * s.amp, kind: "orb" });
        if (packets.length > MAX) packets.shift();
      }
      // Prune the seen-set so it doesn't grow unbounded
      if (seen.size > 50) {
        const cutoff = t - 6;
        for (const v of seen) if (v < cutoff) seen.delete(v);
      }
    });

    // ── Caustic noise — value-noise lookup with two scrolling layers ──
    // We bake a small noise tile and sample it at scroll-shifted coords.
    const NOISE_SIZE = 64;
    const noiseCanvas = document.createElement("canvas");
    noiseCanvas.width = noiseCanvas.height = NOISE_SIZE;
    const ncx = noiseCanvas.getContext("2d");
    const nimg = ncx.createImageData(NOISE_SIZE, NOISE_SIZE);
    // Smooth value noise via averaging neighbors
    {
      const raw = new Float32Array(NOISE_SIZE * NOISE_SIZE);
      for (let i = 0; i < raw.length; i++) raw[i] = Math.random();
      const smooth = new Float32Array(raw.length);
      const N = NOISE_SIZE;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        let sum = 0, cnt = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          sum += raw[((y + dy + N) % N) * N + ((x + dx + N) % N)]; cnt++;
        }
        smooth[y * N + x] = sum / cnt;
      }
      for (let i = 0; i < smooth.length; i++) {
        const v = Math.round(smooth[i] * 255);
        nimg.data[i*4]   = v;
        nimg.data[i*4+1] = v;
        nimg.data[i*4+2] = v;
        nimg.data[i*4+3] = 255;
      }
      ncx.putImageData(nimg, 0, 0);
    }

    // ── Mood color helper ─────────────────────────────────────────
    function moodColor() {
      const mood = document.documentElement.getAttribute("data-mood") || "default";
      // Returns { base, crest, glow } in oklch-ish RGB tuples
      switch (mood) {
        case "liminal":   return { base: [200,165,255], crest: [225,200,255], glow: [180,140,255] };
        case "aurora":    return { base: [120,200,180], crest: [180,255,220], glow: [120,200,180] };
        case "editorial": return { base: [120,160,230], crest: [200,220,255], glow: [120,160,230] };
        default:          return { base: [167,139,250], crest: [220,200,255], glow: [167,139,250] };
      }
    }

    // ── Render loop ───────────────────────────────────────────────
    // Wave parameters (tuned for visual punch on a ~440px pool):
    const v        = 220;     // wave speed (px/s)
    const k        = 0.082;   // wave number (rad/px) — λ ≈ 76px
    const sigma0   = 28;
    const sigmaGrow = 24;
    const alpha    = 1.1;     // global decay
    const POOL_PAD = 2;       // shrink mask a touch to avoid hard edge

    let raf = 0;
    function frame(now) {
      const t = now / 1000;
      const col = moodColor();

      ctx.clearRect(0, 0, W, H);

      // ── Pool footprint ─────────────────────────────────────────
      // Just a faint mood-tinted glow, not a dark disc — the CSS mask
      // already fades the canvas at the edges.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, perspY);
      const sheen = ctx.createRadialGradient(0, 0, 0, 0, 0, poolR);
      sheen.addColorStop(0,   `rgba(${col.glow.join(",")},0.10)`);
      sheen.addColorStop(0.6, `rgba(${col.glow.join(",")},0.04)`);
      sheen.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.fillStyle = sheen;
      ctx.beginPath(); ctx.arc(0, 0, poolR, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Prune packets
      while (packets.length && t - packets[0].t0 > 4) packets.shift();

      // ── Crest field render ──────────────────────────────────────
      // For each packet, draw a series of luminous concentric arcs
      // following the cosine peaks inside the Gaussian envelope.
      // We discretize r over [vτ - 2σ, vτ + 2σ] and find local maxima
      // of |cos|, drawing a stroked ellipse at each.

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, perspY);
      // Clip to pool
      ctx.beginPath();
      ctx.arc(0, 0, poolR - POOL_PAD, 0, Math.PI * 2);
      ctx.clip();

      // Background subtle radial sheen (lit center)
      // (already drawn outside the clipped block above; nothing to do here)

      // Ambient slow rings — always-on, give the pool life between splashes.
      ctx.globalCompositeOperation = "screen";
      const ambientCount = 4;
      const ambientPeriod = 6;
      for (let i = 0; i < ambientCount; i++) {
        const phase = ((t / ambientPeriod) + i / ambientCount) % 1;
        const r = phase * poolR;
        if (r < 12) continue;
        const fade = Math.min(1, phase / 0.12) * Math.min(1, (1 - phase) / 0.30);
        const a = 0.22 * fade;
        ctx.lineWidth = 0.9;
        ctx.strokeStyle = `rgba(${col.crest.join(",")},${a.toFixed(3)})`;
        ctx.shadowColor = `rgba(${col.glow.join(",")},${(a*0.9).toFixed(3)})`;
        ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "source-over";

      // ── Caustic shimmer pass ──────────────────────────────────
      // Removed — was adding visual noise without payoff. Now the pool
      // reads as pure light + rings, which is the signature.

      // Center breath — a subtle radial pulse synced to the orb's bob.
      // The orb's bob phase (cos for top, sin for crossing) tells us when
      // to brighten the centre. Also gets a quick flash on every splash.
      const bobPhase = (t / (5.2)) * Math.PI * 2;     // matches clock period at pace=1
      const breath = 0.5 + 0.5 * Math.sin(bobPhase);  // 0..1
      // splash flash — find youngest packet, use its age
      let flash = 0;
      for (const p of packets) {
        const tau = t - p.t0;
        if (tau >= 0 && tau < 0.6 && p.kind === "orb") {
          flash = Math.max(flash, (1 - tau / 0.6) * 0.8 * p.amp);
        }
      }
      const centreA = 0.10 + 0.06 * breath + flash * 0.55;
      const centre = ctx.createRadialGradient(0, 0, 0, 0, 0, poolR * 0.55);
      centre.addColorStop(0,   `rgba(${col.crest.join(",")},${centreA.toFixed(3)})`);
      centre.addColorStop(0.4, `rgba(${col.glow.join(",")},${(centreA*0.5).toFixed(3)})`);
      centre.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.fillStyle = centre;
      ctx.fillRect(-poolR, -poolR, poolR*2, poolR*2);

      // Wave packets — each emits 3-5 luminous arcs.
      ctx.globalCompositeOperation = "screen";
      for (const p of packets) {
        const tau = t - p.t0;
        if (tau < 0 || tau > 4) continue;

        // Translate so this packet's origin is at (0,0) in the
        // ALREADY-perspective-scaled space. Origin is in screen coords,
        // so we need to undo the (cx,cy)+scale to get local coords.
        // Local origin within the perspective space:
        const px = p.x - cx;
        const py = (p.y - cy) / perspY;

        const r0   = v * tau;
        const sig  = sigma0 + sigmaGrow * tau;
        const damp = Math.exp(-alpha * tau);
        const attack = 1 - Math.exp(-tau * 16);
        const ampScale = (p.kind === "cursor" ? 0.5 : 1.0) * (submittingRef.current ? 1.3 : 1.0);
        const A = p.amp * damp * attack * ampScale;
        if (A < 0.015) continue;

        // Find cosine peaks inside the envelope window.
        // cos(k·dr) = 1 when k·dr = 2πn → dr = 2πn/k = λn
        const lambda = (Math.PI * 2) / k;
        const rmin = Math.max(0, r0 - 2.2 * sig);
        const rmax = r0 + 2.2 * sig;
        const nMin = Math.ceil(rmin / lambda - r0 / lambda);
        const nMax = Math.floor(rmax / lambda - r0 / lambda);

        for (let n = nMin; n <= nMax; n++) {
          const dr = n * lambda;     // offset from peak radius
          const r  = r0 + dr;
          if (r < 6) continue;
          const env = Math.exp(-(dr * dr) / (sig * sig));
          const intensity = A * env;     // 0..~1
          if (intensity < 0.02) continue;

          // Crest arc — width and glow scale with intensity
          const lineW = 0.6 + intensity * 2.4;
          const a     = Math.min(0.85, intensity * 1.6);
          ctx.lineWidth = lineW;
          ctx.strokeStyle = `rgba(${col.crest.join(",")},${a.toFixed(3)})`;
          ctx.shadowColor = `rgba(${col.glow.join(",")},${(a*0.9).toFixed(3)})`;
          ctx.shadowBlur  = 12 + intensity * 14;
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "source-over";

      // (rim removed — CSS mask handles the soft fade-out)
      ctx.restore();

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      unsub();
    };
  }, []);

  return (
    <div ref={wrapRef} className="pool-wrap" aria-hidden="true">
      <canvas ref={canvasRef} className="pool-canvas"/>
    </div>
  );
}

// ─── Caustic shimmer drawer ─────────────────────────────────────────
// Two slow-scrolling, contrast-mapped noise layers blended additively.
// Drawn as soft luminous flecks rather than a flat texture.
function drawCaustic(ctx, t, poolR, col, alpha, noiseCanvas) {
  const N = noiseCanvas.width;
  // Layer 1 — primary shimmer
  ctx.save();
  ctx.globalAlpha = alpha * 0.55;
  ctx.filter = "blur(2px) contrast(1.6) brightness(1.05)";
  ctx.fillStyle = ctx.createPattern(noiseCanvas, "repeat");
  ctx.translate((t * 5) % N, (t * 3.5) % N);
  ctx.fillRect(-poolR*1.3, -poolR*1.3, poolR*2.6, poolR*2.6);
  ctx.restore();

  // Layer 2 — counter-drift, finer flecks
  ctx.save();
  ctx.globalAlpha = alpha * 0.4;
  ctx.filter = "blur(1.2px) contrast(1.8)";
  ctx.rotate(t * 0.04);
  ctx.translate(-(t * 2.5) % N, (t * 4) % N);
  ctx.fillStyle = ctx.createPattern(noiseCanvas, "repeat");
  ctx.fillRect(-poolR*1.4, -poolR*1.4, poolR*2.8, poolR*2.8);
  ctx.restore();

  // Tint pass — multiply mood color over the luminance noise so flecks
  // appear as colored highlights, not gray.
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, poolR);
  grad.addColorStop(0,   `rgba(${col.glow.join(",")},0.7)`);
  grad.addColorStop(1,   `rgba(${col.glow.join(",")},0.35)`);
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0, 0, poolR, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

window.Pool = Pool;
