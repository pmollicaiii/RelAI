/**
 * Shared ripple clock — the heartbeat that keeps the bobbing orb, the
 * waterline ripples, and the pool's wave packets in perfect sync.
 *
 * Splashes are modelled as discrete wave-packet emissions: each downward
 * zero-crossing of the bob pushes a packet with birth time t0 + amplitude.
 * Consumers evaluate the damped-Gaussian × circular-wave equation:
 *
 *   z(x, t) = Σ A·e^(−α(t−t0)) · e^(−(x − v(t−t0))² / σ(t)²) · cos(k(x − v(t−t0)))
 *
 * Ported from the Claude Design bundle's window.__rippleClock — module
 * singleton instead of a window global.
 */

export interface Splash {
  t0: number;
  amp: number;
}

export interface RippleState {
  t: number;
  phase: number;
  bob: number;
  period: number;
  splashes: Splash[];
  sinceSplash: number;
}

type Subscriber = (state: RippleState) => void;

const MAX_SPLASHES = 8;

class RippleClock {
  private subs = new Set<Subscriber>();
  private start = 0;
  private lastBob = 0;
  private splashes: Splash[] = [];
  private running = false;

  private ensureRunning(): void {
    if (this.running || typeof window === "undefined") return;
    this.running = true;
    this.start = performance.now();
    // Seed one mid-flight splash so the very first paint already shows a
    // wave train near the orb instead of a flat line (the first natural
    // splash only lands at the bob's first downward zero-crossing).
    this.emitSplash(-0.6, 1.0);
    const tick = (now: number) => {
      const s = this.getState(now);
      for (const fn of this.subs) {
        try {
          fn(s);
        } catch {
          // subscriber errors never break the clock
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private emitSplash(t: number, amp: number): void {
    this.splashes.push({ t0: t, amp });
    if (this.splashes.length > MAX_SPLASHES) this.splashes.shift();
  }

  private getState(now: number): RippleState {
    const t = (now - this.start) / 1000;
    const paceRaw =
      typeof document !== "undefined"
        ? getComputedStyle(document.documentElement).getPropertyValue("--pace")
        : "1";
    const pace = Number.parseFloat(paceRaw || "1") || 1;
    const period = 3.6 * pace;
    const phase = (t / period) * Math.PI * 2;
    const bob = Math.sin(phase);
    if (this.lastBob > 0 && bob <= 0) this.emitSplash(t, 1.0);
    this.lastBob = bob;
    while (this.splashes.length && t - (this.splashes[0]?.t0 ?? 0) > 4) this.splashes.shift();
    const last = this.splashes[this.splashes.length - 1];
    return {
      t,
      phase,
      bob,
      period,
      splashes: this.splashes,
      sinceSplash: last ? t - last.t0 : 10,
    };
  }

  subscribe(fn: Subscriber): () => void {
    this.ensureRunning();
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  /**
   * Current state without subscribing. Lets consumers paint one frame
   * synchronously at mount so the surface is never blank before the
   * first rAF tick (rAF is fully suspended in hidden tabs).
   */
  snapshot(): RippleState {
    this.ensureRunning();
    return this.getState(typeof performance !== "undefined" ? performance.now() : 0);
  }

  /** Force a splash NOW (search-submit, etc). strength scales amplitude. */
  forceSplash(strength = 1): void {
    this.ensureRunning();
    const t = (performance.now() - this.start) / 1000;
    this.emitSplash(t, 1.6 * strength);
  }
}

export const rippleClock = new RippleClock();
