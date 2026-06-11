"use client";

/**
 * Pool — the Home-page centerpiece. A circular pool of water seen from a
 * slight 3/4 perspective, on which the orb floats.
 *
 * Layers:
 *   1. Mood-tinted radial sheen
 *   2. Ambient slow rings (always-on life between splashes)
 *   3. Center breath synced to the orb's bob + splash flash
 *   4. Wave packets — damped Gaussian × cosine crest arcs:
 *        z(r, t) = A · e^(−ατ) · e^(−(r − vτ)²/σ(τ)²) · cos(k(r − vτ))
 *
 * Packets come from the shared rippleClock (every orb bob), from cursor
 * movement inside the pool, and from forceSplash() on search-submit.
 */

import { useEffect, useRef } from "react";

import { rippleClock } from "./ripple-clock";

interface Packet {
  x: number;
  y: number;
  t0: number;
  amp: number;
  kind: "orb" | "cursor";
}

export function Pool({ listening, submitting }: { listening: boolean; submitting: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listeningRef = useRef(listening);
  const submittingRef = useRef(submitting);
  useEffect(() => {
    listeningRef.current = listening;
  }, [listening]);
  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    let W = 0;
    let H = 0;
    let cx = 0;
    let cy = 0;
    let poolR = 220;
    const perspY = 0.55;
    function resize() {
      if (!canvas || !wrap || !ctx) return;
      const r = wrap.getBoundingClientRect();
      W = r.width;
      H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W / 2;
      cy = H / 2 + 6;
      poolR = Math.min(W, H) * 0.46;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const packets: Packet[] = [];
    const MAX = 24;

    const lastCursor = { x: 0, y: 0, t: 0, has: false };
    let lastEmit = 0;
    function onMove(e: PointerEvent) {
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const dx = x - cx;
      const dy = (y - cy) / perspY;
      const d = Math.hypot(dx, dy);
      if (d > poolR * 1.1) {
        lastCursor.has = false;
        return;
      }
      const now = performance.now() / 1000;
      const dt = lastCursor.has ? Math.max(0.001, now - lastCursor.t) : 0.05;
      const speed = lastCursor.has ? Math.hypot(x - lastCursor.x, y - lastCursor.y) / dt : 0;
      lastCursor.x = x;
      lastCursor.y = y;
      lastCursor.t = now;
      lastCursor.has = true;
      if (now - lastEmit > 0.08) {
        const amp = Math.max(0.06, Math.min(0.45, speed / 1800));
        if (amp > 0.06) {
          packets.push({ x, y, t0: now, amp, kind: "cursor" });
          lastEmit = now;
        }
      }
    }
    function onLeave() {
      lastCursor.has = false;
    }
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);

    const seen = new Set<number>();
    const unsub = rippleClock.subscribe(({ splashes, t }) => {
      for (const s of splashes) {
        if (seen.has(s.t0)) continue;
        seen.add(s.t0);
        packets.push({ x: cx, y: cy, t0: s.t0, amp: 0.7 * s.amp, kind: "orb" });
        if (packets.length > MAX) packets.shift();
      }
      if (seen.size > 50) {
        const cutoff = t - 6;
        for (const v of seen) if (v < cutoff) seen.delete(v);
      }
    });

    function moodColor(): { base: number[]; crest: number[]; glow: number[] } {
      const mood = document.documentElement.getAttribute("data-mood") || "default";
      switch (mood) {
        case "liminal":
          return { base: [200, 165, 255], crest: [225, 200, 255], glow: [180, 140, 255] };
        case "aurora":
          return { base: [120, 200, 180], crest: [180, 255, 220], glow: [120, 200, 180] };
        case "editorial":
          return { base: [120, 160, 230], crest: [200, 220, 255], glow: [120, 160, 230] };
        default:
          return { base: [167, 139, 250], crest: [220, 200, 255], glow: [167, 139, 250] };
      }
    }

    // Wave parameters (tuned for a ~440px pool)
    const v = 220;
    const k = 0.082;
    const sigma0 = 28;
    const sigmaGrow = 24;
    const alpha = 1.1;
    const POOL_PAD = 2;

    let raf = 0;
    function frame(now: number) {
      if (!ctx) return;
      const t = now / 1000;
      const col = moodColor();

      ctx.clearRect(0, 0, W, H);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, perspY);
      const sheen = ctx.createRadialGradient(0, 0, 0, 0, 0, poolR);
      sheen.addColorStop(0, `rgba(${col.glow.join(",")},0.10)`);
      sheen.addColorStop(0.6, `rgba(${col.glow.join(",")},0.04)`);
      sheen.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sheen;
      ctx.beginPath();
      ctx.arc(0, 0, poolR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      while (packets.length && t - (packets[0]?.t0 ?? 0) > 4) packets.shift();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, perspY);
      ctx.beginPath();
      ctx.arc(0, 0, poolR - POOL_PAD, 0, Math.PI * 2);
      ctx.clip();

      // Ambient slow rings
      ctx.globalCompositeOperation = "screen";
      const ambientCount = 4;
      const ambientPeriod = 6;
      for (let i = 0; i < ambientCount; i++) {
        const phase = (t / ambientPeriod + i / ambientCount) % 1;
        const r = phase * poolR;
        if (r < 12) continue;
        const fade = Math.min(1, phase / 0.12) * Math.min(1, (1 - phase) / 0.3);
        const a = 0.22 * fade;
        ctx.lineWidth = 0.9;
        ctx.strokeStyle = `rgba(${col.crest.join(",")},${a.toFixed(3)})`;
        ctx.shadowColor = `rgba(${col.glow.join(",")},${(a * 0.9).toFixed(3)})`;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "source-over";

      // Center breath synced to the bob + splash flash
      const bobPhase = (t / 5.2) * Math.PI * 2;
      const breath = 0.5 + 0.5 * Math.sin(bobPhase);
      let flash = 0;
      for (const p of packets) {
        const tau = t - p.t0;
        if (tau >= 0 && tau < 0.6 && p.kind === "orb") {
          flash = Math.max(flash, (1 - tau / 0.6) * 0.8 * p.amp);
        }
      }
      const centreA = 0.1 + 0.06 * breath + flash * 0.55;
      const centre = ctx.createRadialGradient(0, 0, 0, 0, 0, poolR * 0.55);
      centre.addColorStop(0, `rgba(${col.crest.join(",")},${centreA.toFixed(3)})`);
      centre.addColorStop(0.4, `rgba(${col.glow.join(",")},${(centreA * 0.5).toFixed(3)})`);
      centre.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = centre;
      ctx.fillRect(-poolR, -poolR, poolR * 2, poolR * 2);

      // Wave packets — luminous crest arcs
      ctx.globalCompositeOperation = "screen";
      for (const p of packets) {
        const tau = t - p.t0;
        if (tau < 0 || tau > 4) continue;

        const px = p.x - cx;
        const py = (p.y - cy) / perspY;

        const r0 = v * tau;
        const sig = sigma0 + sigmaGrow * tau;
        const damp = Math.exp(-alpha * tau);
        const attack = 1 - Math.exp(-tau * 16);
        const ampScale = (p.kind === "cursor" ? 0.5 : 1.0) * (submittingRef.current ? 1.3 : 1.0);
        const A = p.amp * damp * attack * ampScale;
        if (A < 0.015) continue;

        const lambda = (Math.PI * 2) / k;
        const rmin = Math.max(0, r0 - 2.2 * sig);
        const rmax = r0 + 2.2 * sig;
        const nMin = Math.ceil(rmin / lambda - r0 / lambda);
        const nMax = Math.floor(rmax / lambda - r0 / lambda);

        for (let n = nMin; n <= nMax; n++) {
          const dr = n * lambda;
          const r = r0 + dr;
          if (r < 6) continue;
          const env = Math.exp(-(dr * dr) / (sig * sig));
          const intensity = A * env;
          if (intensity < 0.02) continue;

          const lineW = 0.6 + intensity * 2.4;
          const a = Math.min(0.85, intensity * 1.6);
          ctx.lineWidth = lineW;
          ctx.strokeStyle = `rgba(${col.crest.join(",")},${a.toFixed(3)})`;
          ctx.shadowColor = `rgba(${col.glow.join(",")},${(a * 0.9).toFixed(3)})`;
          ctx.shadowBlur = 12 + intensity * 14;
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "source-over";
      ctx.restore();

      raf = requestAnimationFrame(frame);
    }
    // Draw the first frame synchronously (rAF is suspended in hidden tabs);
    // frame() schedules its own successor, so this also starts the loop.
    frame(performance.now());

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
      <canvas ref={canvasRef} className="pool-canvas" />
    </div>
  );
}
