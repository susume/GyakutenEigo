export type HudVitals = {
  health: number;
  maxHealth: number;
  energy?: number;
  maxEnergy?: number;
  alive: boolean;
  active: boolean;
  alwaysVisible: boolean;
};

export type HudSnapshot = { healthVisible: boolean; energyVisible: boolean; inCombat: boolean };
export type HudEvent = { type: "vitals"; vitals: HudVitals } | { type: "combat" };
export type HudClock = {
  now: () => number;
  schedule: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  cancel: (timer: ReturnType<typeof setTimeout>) => void;
};

const browserClock: HudClock = {
  now: () => Date.now(),
  schedule: (callback, delay) => setTimeout(callback, delay),
  cancel: (timer) => clearTimeout(timer)
};

/** One manager per local player. No render-loop polling or per-snapshot timers. */
export class HudManager {
  private vitals?: HudVitals;
  private combatUntil = 0;
  private revealUntil = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private listeners = new Set<() => void>();
  private snapshot: HudSnapshot = { healthVisible: true, energyVisible: true, inCombat: false };

  constructor(private readonly clock: HudClock = browserClock, private readonly combatHoldMs = 5000) {}

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  dispatch(event: HudEvent) {
    const now = this.clock.now();
    if (event.type === "combat") this.combatUntil = now + this.combatHoldMs;
    else {
      const previous = this.vitals;
      this.vitals = event.vitals;
      if (!previous || previous.health !== event.vitals.health || previous.energy !== event.vitals.energy
        || previous.maxHealth !== event.vitals.maxHealth || previous.maxEnergy !== event.vitals.maxEnergy
        || previous.alive !== event.vitals.alive || previous.active !== event.vitals.active) {
        this.revealUntil = now + 2500;
      }
      if (previous && event.vitals.health < previous.health) this.combatUntil = now + this.combatHoldMs;
    }
    this.refresh();
  }

  private refresh = () => {
    if (this.timer !== undefined) this.clock.cancel(this.timer);
    this.timer = undefined;
    const now = this.clock.now();
    const inCombat = now < this.combatUntil;
    const v = this.vitals;
    const reveal = !v || v.alwaysVisible || !v.active || !v.alive || inCombat || now < this.revealUntil;
    const next = {
      inCombat,
      healthVisible: reveal || !Number.isFinite(v?.health) || (v?.health ?? 0) < (v?.maxHealth ?? 100),
      energyVisible: reveal || !Number.isFinite(v?.energy) || (v?.energy ?? 0) < (v?.maxEnergy ?? 0)
    };
    if (Object.keys(next).some((key) => next[key as keyof HudSnapshot] !== this.snapshot[key as keyof HudSnapshot])) {
      this.snapshot = next;
      this.listeners.forEach((listener) => listener());
    }
    const deadlines = [this.combatUntil, this.revealUntil].filter((deadline) => deadline > now);
    if (deadlines.length) this.timer = this.clock.schedule(this.refresh, Math.min(...deadlines) - now);
  };

  /** Safe on unmount and React StrictMode effect cleanup; the instance can be reused. */
  dispose() {
    if (this.timer !== undefined) this.clock.cancel(this.timer);
    this.timer = undefined;
  }
}
