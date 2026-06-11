"use client";

/**
 * WaterlineRipples — eye-level luminous horizon under the orb.
 *
 * Sum of decaying traveling sine waves driven by the shared rippleClock.
 * Four stacked SVG paths per side: glow (blurred body of light), base
 * (crisp wave outline), spec (sparkles on crests), motes (drifting
 * particles riding the surface). Mirrored left/right so motion is
 * symmetric and never crosses behind the sphere.
 *
 * Plus useOrbBob — drives a JS translateY on the orb wrapper so the
 * sphere bobs in lockstep with the waterline (same clock).
 */

import { useEffect, useRef } from "react";

import { type RippleState, rippleClock } from "./ripple-clock";

export function useOrbBob(listening: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const listeningRef = useRef(listening);
  useEffect(() => {
    listeningRef.current = listening;
  }, [listening]);
  useEffect(() => {
    let curAmp = 6;
    const unsub = rippleClock.subscribe(({ bob, sinceSplash }) => {
      const el = ref.current;
      if (!el) return;
      // If a CSS animation is driving us (dive), step aside and let it run.
      if (el.closest(".orb-stage--diving")) return;
      const targetAmp = listeningRef.current ? 11 : 6;
      curAmp += (targetAmp - curAmp) * 0.08;
      const sink = listeningRef.current ? 4 : 0;
      const recoil =
        Math.exp(-sinceSplash * 4) * Math.sin(sinceSplash * 22) * (listeningRef.current ? 3 : 1.4);
      const y = -bob * curAmp + recoil + sink;
      el.style.transform = `translateY(${y.toFixed(2)}px)`;
    });
    return unsub;
  }, []);
  return ref;
}

interface Mote {
  x: number;
  vx: number;
  phase: number;
  size: number;
  life: number;
}

export function WaterlineRipples({
  listening,
  submitting,
}: {
  listening: boolean;
  submitting: boolean;
}) {
  const leftBase = useRef<SVGPathElement>(null);
  const rightBase = useRef<SVGPathElement>(null);
  const leftGlow = useRef<SVGPathElement>(null);
  const rightGlow = useRef<SVGPathElement>(null);
  const leftSpec = useRef<SVGPathElement>(null);
  const rightSpec = useRef<SVGPathElement>(null);
  const leftMotes = useRef<SVGPathElement>(null);
  const rightMotes = useRef<SVGPathElement>(null);
  const listeningRef = useRef(listening);
  const submittingRef = useRef(submitting);
  useEffect(() => {
    listeningRef.current = listening;
  }, [listening]);
  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  useEffect(() => {
    // Geometry
    const W = 480;
    const H = 80;
    const MID = H / 2;
    const STEPS = 110;
    const sphereGap = 14;

    // Wave parameters
    const v = 280;
    const k = 0.072;
    const sigma0 = 26;
    const sigmaGrow = 30;
    const alpha = 1.05;
    const A0 = 10.5;

    const ambient = [
      { amp: 0.55, k: 0.03, speed: 0.8, phase: 0.0 },
      { amp: 0.3, k: 0.055, speed: 1.3, phase: 1.7 },
    ];

    const MOTE_COUNT = 8;
    const motes: Mote[] = Array.from({ length: MOTE_COUNT }, () => ({
      x: sphereGap + Math.random() * (W - sphereGap),
      vx: 14 + Math.random() * 18,
      phase: Math.random() * Math.PI * 2,
      size: 0.6 + Math.random() * 1.0,
      life: 1,
    }));
    let lastT = -1;

    function sampleY(x: number, state: RippleState): number {
      const { t, splashes } = state;
      const dist = x - sphereGap;
      let y = 0;
      for (const s of splashes) {
        const tau = t - s.t0;
        if (tau < 0 || tau > 4) continue;
        const r = v * tau;
        const dr = dist - r;
        const sig = sigma0 + sigmaGrow * tau;
        const env = Math.exp(-(dr * dr) / (sig * sig));
        const damp = Math.exp(-alpha * tau);
        const attack = 1 - Math.exp(-tau * 16);
        y += A0 * s.amp * damp * attack * env * Math.cos(k * dr);
      }
      for (const a of ambient) {
        const aenv = Math.exp(-0.006 * dist);
        y += a.amp * aenv * Math.sin(a.k * dist - a.speed * t + a.phase);
      }
      const u = (x - sphereGap) / (W - sphereGap);
      const edge = Math.min(1, (1 - u) * 6) * Math.min(1, u * 6);
      return y * edge;
    }

    function buildFrame(state: RippleState) {
      const { t, splashes } = state;
      const listenBoost = listeningRef.current ? 1.6 : 1.0;

      const samples: Array<{ x: number; y: number }> = new Array(STEPS + 1);
      let dPath = "";
      for (let i = 0; i <= STEPS; i++) {
        const u = i / STEPS;
        const x = sphereGap + u * (W - sphereGap);
        const dist = x - sphereGap;
        let y = 0;

        for (const s of splashes) {
          const tau = t - s.t0;
          if (tau < 0 || tau > 4) continue;
          const r = v * tau;
          const dr = dist - r;
          const sig = sigma0 + sigmaGrow * tau;
          const env = Math.exp(-(dr * dr) / (sig * sig));
          const damp = Math.exp(-alpha * tau);
          const attack = 1 - Math.exp(-tau * 16);
          y += A0 * s.amp * damp * attack * env * Math.cos(k * dr);
        }
        for (const a of ambient) {
          const aenv = Math.exp(-0.006 * dist);
          y += a.amp * aenv * Math.sin(a.k * dist - a.speed * t + a.phase);
        }
        const edge = Math.min(1, (1 - u) * 6) * Math.min(1, u * 6);
        y *= edge * listenBoost;

        samples[i] = { x, y };
        dPath += `${i === 0 ? "M " : "L "}${x.toFixed(2)} ${(MID + y).toFixed(2)} `;
      }

      const energy = samples.reduce((a, s) => a + Math.abs(s.y), 0) / samples.length;
      const thresh = Math.max(0.6, energy * 0.9);

      let dSpec = "";
      for (let i = 1; i < samples.length - 1; i++) {
        const a = samples[i - 1]?.y ?? 0;
        const b = samples[i]?.y ?? 0;
        const c = samples[i + 1]?.y ?? 0;
        if (b < a && b < c && b < -thresh) {
          const len = Math.min(6, Math.abs(b) * 0.6);
          const sx = samples[i]?.x ?? 0;
          const sy = MID + b;
          dSpec += `M ${(sx - len / 2).toFixed(2)} ${sy.toFixed(2)} L ${(sx + len / 2).toFixed(2)} ${sy.toFixed(2)} `;
        }
      }

      const dt = lastT < 0 ? 0.016 : Math.min(0.05, t - lastT);
      lastT = t;
      let dMotes = "";
      for (const m of motes) {
        m.x += m.vx * dt;
        if (m.x > W - 4) {
          m.x = sphereGap + Math.random() * 60;
          m.vx = 14 + Math.random() * 18;
          m.phase = Math.random() * Math.PI * 2;
        }
        const y = sampleY(m.x, state) + Math.sin(t * 1.5 + m.phase) * 0.4;
        const edgeFade = Math.min(1, (W - m.x) / 60) * Math.min(1, (m.x - sphereGap) / 30);
        m.life = edgeFade;
        dMotes += `M ${m.x.toFixed(2)} ${(MID + y).toFixed(2)} L ${(m.x + 0.01).toFixed(2)} ${(MID + y).toFixed(2)} `;
      }

      return { dPath, dSpec, dMotes };
    }

    const unsub = rippleClock.subscribe((state) => {
      const { dPath, dSpec, dMotes } = buildFrame(state);
      rightBase.current?.setAttribute("d", dPath);
      leftBase.current?.setAttribute("d", dPath);
      rightGlow.current?.setAttribute("d", dPath);
      leftGlow.current?.setAttribute("d", dPath);
      rightSpec.current?.setAttribute("d", dSpec);
      leftSpec.current?.setAttribute("d", dSpec);
      rightMotes.current?.setAttribute("d", dMotes);
      leftMotes.current?.setAttribute("d", dMotes);
    });
    return unsub;
  }, []);

  return (
    <div
      className={
        "waterline-ripples " +
        (listening ? "is-listening" : "") +
        (submitting ? " is-submitting" : "")
      }
      aria-hidden="true"
    >
      <svg className="wl wl-left" viewBox="0 0 480 80" preserveAspectRatio="none">
        <title>waterline</title>
        <g transform="translate(480,0) scale(-1,1)">
          <path
            ref={leftGlow}
            className="wl-glow"
            fill="none"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            ref={leftBase}
            className="wl-base"
            fill="none"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            ref={leftSpec}
            className="wl-spec"
            fill="none"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            ref={leftMotes}
            className="wl-motes"
            fill="none"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </svg>
      <svg className="wl wl-right" viewBox="0 0 480 80" preserveAspectRatio="none">
        <title>waterline</title>
        <path
          ref={rightGlow}
          className="wl-glow"
          fill="none"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          ref={rightBase}
          className="wl-base"
          fill="none"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          ref={rightSpec}
          className="wl-spec"
          fill="none"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          ref={rightMotes}
          className="wl-motes"
          fill="none"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
