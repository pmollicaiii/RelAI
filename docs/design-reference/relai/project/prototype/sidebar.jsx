// RelAI V1 — Sidebar + Home (search-first landing) + Folder list

function Sidebar({ currentFolderId, folders, onSelectFolder, onHome }) {
  return (
    <aside className="sidebar">
      <button className="brand brand-logo" onClick={onHome} style={{ background: "none", border: "none", cursor: "pointer", width: "100%", padding: 0 }}>
        <img src="prototype/relai-logo.png" alt="RelAI" className="brand-logo-img" style={{ width: "100px", height: "100px" }} />
      </button>
      <div className="nav">
        <div className="label">Workspace</div>
        <button className={"item " + (!currentFolderId ? "active" : "")} onClick={onHome}>
          <span className="dot hot"></span>
          <span className="name">Home</span>
          <span className="count">5</span>
        </button>
        <div className="label">Client Folders</div>
        {folders.map((f) =>
        <button key={f.id} className={"item " + (currentFolderId === f.id ? "active" : "")} onClick={() => onSelectFolder(f.id)}>
            <span className={"dot " + (f.pulse || "")}></span>
            <span className="name">{f.clientName.split(" & ")[0]}</span>
            <span className="count">{f.savedCount}</span>
          </button>
        )}
        <button className="item" style={{ color: "var(--ink-3)", marginTop: 6 }}>
          <span className="dot" style={{ background: "transparent", border: "1px dashed var(--ink-4)" }}></span>
          <span className="name">+ New folder</span>
        </button>
      </div>
      <div className="user">
        <div className="avi">JR</div>
        <div>
          <div className="nm">Jordan Reyes</div>
          <div className="em">Keller Williams · Center City</div>
        </div>
      </div>
    </aside>);

}

// ─────────────────────────────────────────────
// WaterlineRipples — eye-level view of ripples
// emanating outward from the sphere on both sides.
// Uses a sum of decaying traveling sine waves so the
// motion reads as physical: amplitude shrinks with
// distance from the sphere; phase advances with time
// and position (c·t − k·x) so peaks travel outward.
// Two SVG <path>s (mirrored) so the motion is exactly
// symmetric and never crosses behind the sphere.
// ─────────────────────────────────────────────
// A tiny shared clock so the bobbing sphere and ripples agree on time.
// Exposes phase ∈ [0, 2π) and the bob's vertical displacement (-1..+1, peak +1 = up).
//
// Splashes are modelled as discrete wave-packet emissions: each downward
// zero-crossing pushes a packet onto the splashes[] queue with a birth time
// t0 and an amplitude. The ripple component reads splashes[] and evaluates
//
//   z(x, t) = Σ A·e^(-α(t-t0)) · e^(-(x - v(t-t0))² / σ(t-t0)²) · cos(k(x - v(t-t0)))
//
// (the damped-Gaussian × circular-wave equation), so each impact produces
// a real propagating wave train, not just a single bump.
window.__rippleClock = window.__rippleClock || (() => {
  const subs = new Set();
  const start = performance.now();
  let lastBob = 0;
  // Each splash: { t0: seconds, amp: 0.6..2 } — old ones are pruned to keep cost low.
  const splashes = [];
  const MAX_SPLASHES = 8;
  function emitSplash(t, amp) {
    splashes.push({ t0: t, amp });
    if (splashes.length > MAX_SPLASHES) splashes.shift();
  }
  function pruneSplashes(t) {
    // Anything older than 4 s has decayed below visibility; drop it.
    while (splashes.length && t - splashes[0].t0 > 4) splashes.shift();
  }
  function getState(now) {
    const t = (now - start) / 1000;
    const pace = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--pace") || "1") || 1;
    const period = 3.6 * pace;
    const phase = t / period * Math.PI * 2;
    const bob = Math.sin(phase);
    if (lastBob > 0 && bob <= 0) emitSplash(t, 1.0); // natural cycle splash
    lastBob = bob;
    pruneSplashes(t);
    return { t, phase, bob, period, splashes, sinceSplash: splashes.length ? t - splashes[splashes.length - 1].t0 : 10 };
  }
  function tick(now) {
    const s = getState(now);
    subs.forEach((fn) => {try {fn(s);} catch (e) {}});
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  return {
    subscribe(fn) {subs.add(fn);return () => subs.delete(fn);},
    // Force a splash NOW (for search-submit, etc). strength scales amplitude.
    forceSplash(strength = 1) {
      const t = (performance.now() - start) / 1000;
      emitSplash(t, 1.6 * strength);
    }
  };
})();

function WaterlineRipples({ listening, submitting }) {
  const leftBase = React.useRef(null);
  const rightBase = React.useRef(null);
  const leftGlow = React.useRef(null);
  const rightGlow = React.useRef(null);
  const leftSpec = React.useRef(null); // specular highlights (dots on crests)
  const rightSpec = React.useRef(null);
  const leftMotes = React.useRef(null); // floating luminous motes
  const rightMotes = React.useRef(null);
  const listeningRef = React.useRef(listening);
  const submittingRef = React.useRef(submitting);
  React.useEffect(() => {listeningRef.current = listening;}, [listening]);
  React.useEffect(() => {submittingRef.current = submitting;}, [submitting]);

  React.useEffect(() => {
    // Geometry
    const W = 480; // wider — the line reaches further now
    const H = 80; // taller viewBox so reflection room exists
    const MID = H / 2;
    const STEPS = 110; // denser sampling for smooth crests
    const sphereGap = 14;

    // Wave parameters
    const v = 280;
    const k = 0.072;
    const sigma0 = 26;
    const sigmaGrow = 30;
    const alpha = 1.05;
    const A0 = 10.5;

    // Ambient swell — barely-there motion when the pool is at rest
    const ambient = [
    { amp: 0.55, k: 0.030, speed: 0.8, phase: 0.0 },
    { amp: 0.30, k: 0.055, speed: 1.3, phase: 1.7 }];


    // Floating motes — N specks drifting outward; each carries a position
    // (px from sphere) and a phase offset for its tiny y-bob.
    const MOTE_COUNT = 8;
    const motes = Array.from({ length: MOTE_COUNT }, (_, i) => ({
      x: sphereGap + Math.random() * (W - sphereGap),
      vx: 14 + Math.random() * 18, // px/s outward drift
      phase: Math.random() * Math.PI * 2,
      size: 0.6 + Math.random() * 1.0,
      life: 1 // 0..1; fades out at edges
    }));
    let lastT = -1;

    // Sample y at a given x given current state — we reuse the formula so
    // motes can ride the wave surface.
    function sampleY(x, state) {
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
      // Edge taper
      const u = (x - sphereGap) / (W - sphereGap);
      const edge = Math.min(1, (1 - u) * 6) * Math.min(1, u * 6);
      return y * edge;
    }

    function buildFrame(state) {
      const { t, splashes } = state;
      const listenBoost = listeningRef.current ? 1.6 : 1.0;

      // --- Build wave path & track per-sample crest height for specular ---
      const samples = new Array(STEPS + 1);
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
        dPath += (i === 0 ? "M " : "L ") + x.toFixed(2) + " " + (MID + y).toFixed(2) + " ";
      }

      // --- Specular highlights — for each local maximum ABOVE threshold,
      //     emit a bright short stroke at its position. These are the
      //     "light catching on the crest" sparkles.
      // Threshold scales with overall wave energy so quiet moments don't
      // produce false specs.
      const energy = samples.reduce((a, s) => a + Math.abs(s.y), 0) / samples.length;
      const thresh = Math.max(0.6, energy * 0.9);

      let dSpec = "";
      for (let i = 1; i < samples.length - 1; i++) {
        const a = samples[i - 1].y,b = samples[i].y,c = samples[i + 1].y;
        // Crest = local minimum (since y is inverted: more negative = higher peak)
        if (b < a && b < c && b < -thresh) {
          const len = Math.min(6, Math.abs(b) * 0.6);
          const sx = samples[i].x;
          const sy = MID + b;
          dSpec += `M ${(sx - len / 2).toFixed(2)} ${sy.toFixed(2)} L ${(sx + len / 2).toFixed(2)} ${sy.toFixed(2)} `;
        }
      }

      // --- Motes — advance positions, recycle, build a path of dots ---
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
        // Fade in at the start, fade out near the edge
        const edgeFade = Math.min(1, (W - m.x) / 60) * Math.min(1, (m.x - sphereGap) / 30);
        m.life = edgeFade;
        // Express as a tiny circle (we'll stroke it for glow). Use a 2-segment
        // micro-path: a single point as a degenerate line gets rendered with
        // line-cap=round, producing a luminous dot.
        dMotes += `M ${m.x.toFixed(2)} ${(MID + y).toFixed(2)} L ${(m.x + 0.01).toFixed(2)} ${(MID + y).toFixed(2)} `;
      }

      return { dPath, dSpec, dMotes };
    }

    const unsub = window.__rippleClock.subscribe((state) => {
      const { dPath, dSpec, dMotes } = buildFrame(state);
      if (rightBase.current) rightBase.current.setAttribute("d", dPath);
      if (leftBase.current) leftBase.current.setAttribute("d", dPath);
      if (rightGlow.current) rightGlow.current.setAttribute("d", dPath);
      if (leftGlow.current) leftGlow.current.setAttribute("d", dPath);
      if (rightSpec.current) rightSpec.current.setAttribute("d", dSpec);
      if (leftSpec.current) leftSpec.current.setAttribute("d", dSpec);
      if (rightMotes.current) rightMotes.current.setAttribute("d", dMotes);
      if (leftMotes.current) leftMotes.current.setAttribute("d", dMotes);
    });
    return unsub;
  }, []);

  return (
    <div className={"waterline-ripples " + (listening ? "is-listening" : "") + (submitting ? " is-submitting" : "")} aria-hidden="true">
      <svg className="wl wl-left" viewBox="0 0 480 80" preserveAspectRatio="none">
        <g transform="translate(480,0) scale(-1,1)">
          <path ref={leftGlow} className="wl-glow" fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path ref={leftBase} className="wl-base" fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path ref={leftSpec} className="wl-spec" fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path ref={leftMotes} className="wl-motes" fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </g>
      </svg>
      <svg className="wl wl-right" viewBox="0 0 480 80" preserveAspectRatio="none">
        <path ref={rightGlow} className="wl-glow" fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path ref={rightBase} className="wl-base" fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path ref={rightSpec} className="wl-spec" fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path ref={rightMotes} className="wl-motes" fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>);

}

// Drives a JS-controlled translateY on a ref'd element so it bobs in lockstep
// with the WaterlineRipples (same clock). Returns a ref to attach.
function useOrbBob(listening) {
  const ref = React.useRef(null);
  const listeningRef = React.useRef(listening);
  React.useEffect(() => {listeningRef.current = listening;}, [listening]);
  React.useEffect(() => {
    let curAmp = 6;
    const unsub = window.__rippleClock.subscribe(({ bob, sinceSplash }) => {
      const el = ref.current;
      if (!el) return;
      // If a CSS animation is driving us (dive), step aside and let it run.
      if (el.closest(".orb-stage--diving")) return;
      const targetAmp = listeningRef.current ? 11 : 6;
      curAmp += (targetAmp - curAmp) * 0.08;
      const sink = listeningRef.current ? 4 : 0;
      const recoil = Math.exp(-sinceSplash * 4) * Math.sin(sinceSplash * 22) * (listeningRef.current ? 3 : 1.4);
      const y = -bob * curAmp + recoil + sink;
      el.style.transform = `translateY(${y.toFixed(2)}px)`;
    });
    return unsub;
  }, []);
  return ref;
}

function HomePage({ folders, pulse, onSelectFolder, onStartSearch }) {
  const folderMap = Object.fromEntries(folders.map((f) => [f.id, f]));
  const [query, setQuery] = React.useState("");
  const [targetFolder, setTargetFolder] = React.useState(""); // "" = none yet
  const [pickerOpen, setPickerOpen] = React.useState(false);
  // Attachments: voice memos / inspo / discovery-call notes etc — modeled as
  // {id, name, kind: 'audio'|'doc'|'image', size, source: 'upload'} so the
  // ranker has additional taste signal beyond the text query.
  const [attachments, setAttachments] = React.useState([]);
  const fileInputRef = React.useRef(null);
  function onPickFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setAttachments((prev) => [
    ...prev,
    ...files.map((f) => ({
      id: f.name + ":" + f.size + ":" + Math.random().toString(36).slice(2, 6),
      name: f.name,
      size: f.size,
      kind: f.type.startsWith("audio/") ? "audio" :
      f.type.startsWith("image/") ? "image" :
      "doc"
    }))]
    );
    // reset so picking the same file twice still fires onChange
    e.target.value = "";
  }
  function removeAttachment(id) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  // --- Push-to-talk (hold Ctrl) ---
  const [listening, setListening] = React.useState(false);
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [crystallizing, setCrystallizing] = React.useState(false); // post-dictation seeds
  const [submitting, setSubmitting] = React.useState(false);
  const orbBobRef = useOrbBob(listening);
  const listeningRef = React.useRef(false);
  const startRef = React.useRef(0);
  const timerRef = React.useRef(null);
  const dictationRef = React.useRef(null);

  // Simulated dictation phrases — typed into the textarea while holding
  const DICTATION = "Couple with two kids relocating from Brooklyn, budget around one point one million, want a real yard, not a tiny patio, needs three bedrooms, loves pre-war, Fitler or Rittenhouse, no new construction please.";

  function startListening() {
    if (listeningRef.current) return;
    listeningRef.current = true;
    setListening(true);
    startRef.current = performance.now();
    setElapsedMs(0);
    // tick
    timerRef.current = setInterval(() => {
      setElapsedMs(performance.now() - startRef.current);
    }, 80);
    // Begin streaming tokens into the textarea
    const words = DICTATION.split(" ");
    let i = 0;
    const baseLen = (query && !query.endsWith(" ") ? query + " " : query).length;
    const prefix = query && !query.endsWith(" ") ? query + " " : query;
    dictationRef.current = setInterval(() => {
      if (!listeningRef.current || i >= words.length) {
        clearInterval(dictationRef.current);
        dictationRef.current = null;
        return;
      }
      setQuery((q) => {
        const next = prefix + words.slice(0, i + 1).join(" ");
        return next;
      });
      i++;
    }, 140);
  }

  function stopListening() {
    if (!listeningRef.current) return;
    listeningRef.current = false;
    setListening(false);
    if (timerRef.current) {clearInterval(timerRef.current);timerRef.current = null;}
    if (dictationRef.current) {clearInterval(dictationRef.current);dictationRef.current = null;}
    setElapsedMs(0);
    // Crystallization moment — seeds float from textarea up around the orb and settle into criteria
    setCrystallizing(true);
    setTimeout(() => setCrystallizing(false), 2400);
  }

  React.useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Shift" && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) {
        startListening();
      }
    }
    function onKeyUp(e) {
      if (e.key === "Shift") stopListening();
    }
    function onBlur() {stopListening();}
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      stopListening();
    };
  }, []);

  const selected = targetFolder ? folderMap[targetFolder] : null;

  function go() {
    if (!query.trim() || submitting) return;
    if (!targetFolder) {
      setPickerOpen(true);
      return;
    }
    // Search-as-drop: the sphere plunges, the page splashes, then we navigate.
    setSubmitting(true);
    window.__rippleClock.forceSplash(1.3);
    setTimeout(() => {
      onStartSearch(targetFolder, query);
      setSubmitting(false);
    }, 720);
  }

  const sec = Math.floor(elapsedMs / 1000);
  const tenths = Math.floor(elapsedMs % 1000 / 100);

  return (
    <div className="content">
      <div className="page-head home-head">
        <div>
          <div className="eyebrow-row">
            <span className="eyebrow-day mono" style={{ opacity: "1", fontSize: "20px" }}>MON · 04 · 20</span>
            <span className="eyebrow-rule"></span>
            <span className="eyebrow-greet" style={{ fontSize: "25px" }}>Good morning, Jordan.</span>
          </div>
          <h1 className="home-h1">Where would you like to <em>begin?</em></h1>
          <p className="home-sub">Speak or type a search in plain English. RelAI will re-rank results using a client folder's <em style={{ color: "var(--accent)" }}>Taste</em> profile.</p>
        </div>
        <div className="constellation">
          <div className="const-label mono" style={{ color: "rgb(0, 0, 0)", fontSize: "12px", height: "60px" }}>RECENT</div>
          <button className="const-orb" title="3-bed Fitler Square under $900k · Sarah & Mike">
            <span className="const-orb-bubble"></span>
            <span className="const-orb-name">Sarah</span>
            <span className="const-orb-meta mono" style={{ color: "rgb(0, 0, 0)" }}>3D AGO · 12</span>
          </button>
          <button className="const-orb" title="South Philly trinity, ~$550k · David">
            <span className="const-orb-bubble"></span>
            <span className="const-orb-name">David</span>
            <span className="const-orb-meta mono" style={{ color: "rgb(0, 0, 0)" }}>1W AGO · 7</span>
          </button>
          <button className="const-orb pulsing" title="Loft, Northern Liberties · Linh — 2 new">
            <span className="const-orb-bubble"></span>
            <span className="const-orb-name">Linh</span>
            <span className="const-orb-meta mono">● 2 NEW</span>
          </button>
        </div>
      </div>

      <div className="orb-wrap">
        {submitting && <div className="screen-ripple" aria-hidden="true"><span /><span /><span /></div>}
        {crystallizing &&
        <div className="seeds" aria-hidden="true">
            {["3 BD", "Fitler Square", "Rittenhouse", "≤ $1.1M", "real yard", "pre-war", "no new construction"].map((s, i) =>
          <span key={s} className={"seed seed-" + i}>{s}</span>
          )}
          </div>
        }
        <div className={"orb-stage " + (listening ? "orb-stage--listening " : "") + (submitting ? "orb-stage--diving" : "")}>
          <WaterlineRipples listening={listening} submitting={submitting} />

          {/* The bobbing sphere itself — JS-driven translateY on the wrapper */}
          <div ref={orbBobRef} className="orb-bobber">
          <button className={"orb " + (listening ? "orb--listening" : "")}
            onMouseDown={startListening}
            onMouseUp={stopListening}
            onMouseLeave={stopListening}
            onTouchStart={(e) => {e.preventDefault();startListening();}}
            onTouchEnd={stopListening}
            title="Hold to dictate">
            
            {/* Outer atmospheric glow */}
            <span className="orb-glow"></span>
            <span className="orb-glow orb-glow-2"></span>

            {/* 3D glass sphere (Three.js) */}
            <WaterOrb listening={listening} />
          </button>
          </div>
        </div>

        <div className="orb-caption">
          {listening ?
          <>
              <div className="orb-t serif">I'm listening…</div>
              <div className="orb-s mono">● RECORDING · {sec}.{tenths}s</div>
            </> :

          <div className="orb-hints">
              <div className="orb-hint">
                <span className="hint-icon hint-cursor">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 3 L4 17 L8.2 13.5 L10.6 19 L13 18 L10.6 12.6 L16 12.3 Z" />
                  </svg>
                  <span className="click-ring"></span>
                  <span className="click-ring click-ring-2"></span>
                </span>
                <span className="hint-lbl">CLICK & HOLD</span>
              </div>
              <span className="orb-hint-sep"></span>
              <div className="orb-hint">
                <span className="hint-icon hint-key">
                  <span className="key-cap">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 10 L12 5 L17 10" style={{ stroke: "rgb(0, 0, 0)" }} />
                      <path d="M9 10 L9 18 L15 18 L15 10" style={{ stroke: "rgb(7, 7, 7)" }} />
                    </svg>
                  </span>
                </span>
                <span className="hint-lbl">hold shift</span>
              </div>
            </div>
          }
        </div>
      </div>

      <div className={"compose " + (listening ? "compose--listening" : "")} style={{ marginTop: 28, position: "relative" }}>
        <div className="lbl" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>DESCRIBE WHAT YOU'RE LOOKING FOR:</span>
          <span className="spacer" style={{ flex: 1 }}></span>
          <span className="mono" style={{ color: "var(--ink-4)", fontSize: 10 }}>
            {listening ? "● LISTENING — release SHIFT to stop" : "HOLD SHIFT TO DICTATE"}
          </span>
        </div>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. 3-bed rowhome in Fitler Square under $900k, needs a garage and outdoor space…  —or hold Shift and speak"
          onKeyDown={(e) => {if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) go();}} />
        
        {listening &&
        <div className="dictation-overlay">
            <div className="dict-mic"><div className="dict-mic-ring"></div>🎙</div>
            <div className="dict-wave">
              {[...Array(18)].map((_, i) => <span key={i} style={{ animationDelay: i * 0.07 + "s" }} />)}
            </div>
            <div className="dict-time mono">{sec}.{tenths}s</div>
            <div className="dict-hint mono">TRANSCRIBING · HOLD SHIFT</div>
          </div>
        }
        {attachments.length > 0 &&
        <div className="attach-strip">
            {attachments.map((a) => {
            const sizeKb = a.size > 1024 * 1024 ?
            (a.size / (1024 * 1024)).toFixed(1) + " MB" :
            Math.max(1, Math.round(a.size / 1024)) + " KB";
            const glyph = a.kind === "audio" ? "♪" : a.kind === "image" ? "▣" : "⌹";
            return (
              <div key={a.id} className={"attach-chip attach-chip--" + a.kind}>
                  <span className="attach-glyph">{glyph}</span>
                  <span className="attach-name" title={a.name}>{a.name}</span>
                  <span className="attach-size mono">{sizeKb}</span>
                  <button className="attach-x" onClick={() => removeAttachment(a.id)} aria-label={"Remove " + a.name}>×</button>
                </div>);

          })}
          </div>
        }
        <div className="row">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="audio/*,.txt,.md,.pdf,.doc,.docx,.rtf,.png,.jpg,.jpeg,.heic"
            style={{ display: "none" }}
            onChange={onPickFiles} />

          <button
            className="attach-btn"
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            title="Attach audio or notes from this device">

            <span className="attach-btn-glyph">+</span>
            <span>Attach</span>
            <span className="attach-btn-kinds mono">AUDIO · DOC</span>
          </button>
          <div style={{ position: "relative" }}>
            <button className="folder-btn" onClick={() => setPickerOpen(!pickerOpen)} title={selected ? "Change folder" : "Add to client folder"}>
              {selected ?
              <>
                  <span className="attach-btn-glyph">📁</span>
                  <span>{selected.clientName.split(" & ")[0]}</span>
                </> :

              <>
                  <span className="attach-btn-glyph">+</span>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>📁</span>
                </>
              }
              <span className="folder-caret">▾</span>
            </button>
            {pickerOpen &&
            <div className="hide-reasons" style={{ position: "absolute", right: "auto", left: 0, top: "110%", minWidth: 260 }}>
                <div className="q">File this search under…</div>
                <div className="opts">
                  {folders.map((f) =>
                <button key={f.id} className="opt" onClick={() => {setTargetFolder(f.id);setPickerOpen(false);}}>
                      <b style={{ fontWeight: 500 }}>{f.clientName}</b>
                      <span style={{ color: "var(--ink-3)", fontSize: 10.5, marginLeft: 8 }}>· {f.tasteHeadline}</span>
                    </button>
                )}
                  <button className="opt" onClick={() => {setPickerOpen(false);}}>
                    <span style={{ color: "var(--accent)" }}>+ New client folder…</span>
                  </button>
                </div>
                <div className="meta">RE-RANKING USES THE CHOSEN FOLDER'S TASTE VECTOR</div>
              </div>
            }
          </div>
          <span className="hint mono">⌘ + ENTER to search</span>
          <div className="spacer"></div>
          <button
            className={"mic-btn " + (listening ? "on" : "")}
            onMouseDown={startListening}
            onMouseUp={stopListening}
            onMouseLeave={stopListening}
            onTouchStart={(e) => {e.preventDefault();startListening();}}
            onTouchEnd={stopListening}
            title="Hold to dictate (or hold Shift)">
            
            <span className="mic-dot"></span>
            <span>{listening ? "Listening…" : "Hold to talk"}</span>
            <span className="kbd">SHIFT</span>
          </button>
          <button className="run" onClick={go} disabled={!query.trim()}>
            <I.Search />
            Search {selected ? `for ${selected.clientName.split(" ")[0]}` : ""}
            <span className="kbd">⏎</span>
          </button>
        </div>
      </div>

      <div className="section-label">What moved overnight · Pulse</div>
      <div className="pulse-hero">
        {pulse.map((p, i) => {
          const f = folderMap[p.clientId];
          return (
            <div key={i} className="row" onClick={() => onSelectFolder(p.clientId)}>
              <span className={"dot " + p.tone}></span>
              <div className="client">{f.clientName}</div>
              <div className="ev">{p.label}</div>
              <div className="time mono">{p.time}</div>
              <div className="open">Open →</div>
            </div>);

        })}
      </div>

    </div>);

}

window.Sidebar = Sidebar;
window.HomePage = HomePage;
// Keep legacy alias
window.PulsePage = HomePage;