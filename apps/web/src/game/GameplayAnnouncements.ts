import { gameAudio, type AudioEventCue } from "./GameAudio.js";
import { BoundedEventIdCache, type GameplayAnnouncementKey } from "@quizstrike/shared";

export interface GameplayAnnouncementRequest {
  eventId: string;
  announcementKey: GameplayAnnouncementKey;
  occurredAt: number;
  subtitle?: string;
}

export interface GameplayAnnouncementDefinition {
  assetPath: string;
  priority: number;
  maxAgeMs: number;
  subtitle: string;
  fallbackCue: AudioEventCue;
}

export const GAMEPLAY_ANNOUNCEMENTS: Record<GameplayAnnouncementKey, GameplayAnnouncementDefinition> = {
  FLAG_PLANTED: {
    assetPath: "/assets/audio/announcements/flag-planted.mp3",
    priority: 80,
    maxAgeMs: 30_000,
    subtitle: "The flag has been planted.",
    fallbackCue: "flag_planted"
  },
  STREAK_HEATING_UP: {
    assetPath: "/assets/audio/announcements/streak-heating-up.mp3",
    priority: 50,
    maxAgeMs: 8_000,
    subtitle: "He's heating up!",
    fallbackCue: "streak"
  },
  STREAK_DOMINATING: {
    assetPath: "/assets/audio/announcements/streak-dominating.mp3",
    priority: 50,
    maxAgeMs: 8_000,
    subtitle: "Dominating!",
    fallbackCue: "streak"
  },
  STREAK_UNSTOPPABLE: {
    assetPath: "/assets/audio/announcements/streak-unstoppable.mp3",
    priority: 50,
    maxAgeMs: 8_000,
    subtitle: "Unstoppable!",
    fallbackCue: "streak"
  },
  STREAK_WICKED_SICK: {
    assetPath: "/assets/audio/announcements/streak-wicked-sick.mp3",
    priority: 50,
    maxAgeMs: 8_000,
    subtitle: "Wicked Sick!",
    fallbackCue: "streak"
  },
  STREAK_MONSTER: {
    assetPath: "/assets/audio/announcements/streak-monster.mp3",
    priority: 50,
    maxAgeMs: 8_000,
    subtitle: "Muh-Muh-Muh-Monster!",
    fallbackCue: "streak"
  },
  STREAK_GODLIKE: {
    assetPath: "/assets/audio/announcements/streak-godlike.mp3",
    priority: 50,
    maxAgeMs: 8_000,
    subtitle: "Guh-Guh-Guh-Godlike!",
    fallbackCue: "streak"
  }
};

type QueueItem = GameplayAnnouncementRequest & { definition: GameplayAnnouncementDefinition };

export interface GameplayAnnouncementManagerOptions {
  maxQueueSize?: number;
  now?: () => number;
  playAsset?: (path: string, volume: number) => Promise<boolean>;
  playFallback?: (cue: AudioEventCue, subtitle: string) => void | Promise<void>;
}

function speakDevelopmentFallback(subtitle: string) {
  if (
    !subtitle ||
    !import.meta.env?.DEV ||
    typeof window === "undefined" ||
    !("speechSynthesis" in window) ||
    typeof SpeechSynthesisUtterance === "undefined"
  ) {
    return;
  }

  const speech = window.speechSynthesis;
  speech.cancel();

  return new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(subtitle);
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      utterance.onend = null;
      utterance.onerror = null;
      resolve();
    };

    utterance.volume = 1;
    utterance.rate = 1;
    utterance.onend = finish;
    utterance.onerror = finish;

    try {
      speech.speak(utterance);
    } catch {
      finish();
    }
  });
}

export class GameplayAnnouncementManager {
  private readonly maxQueueSize: number;
  private readonly now: () => number;
  private readonly playAsset: (path: string, volume: number) => Promise<boolean>;
  private readonly playFallback: (cue: AudioEventCue, subtitle: string) => void | Promise<void>;
  private readonly seenEventIds: BoundedEventIdCache;
  private readonly queue: QueueItem[] = [];
  private currentAudio: HTMLAudioElement | undefined;
  private isPlaying = false;
  private muted = false;
  private volume = 0.85;

  constructor(options: GameplayAnnouncementManagerOptions = {}) {
    this.maxQueueSize = Math.max(1, Math.floor(options.maxQueueSize ?? 4));
    this.now = options.now ?? (() => Date.now());
    this.seenEventIds = new BoundedEventIdCache(128, 2 * 60_000, this.now);
    this.playAsset = options.playAsset ?? ((path, volume) => this.playBrowserAsset(path, volume));
    this.playFallback = options.playFallback ?? ((cue, subtitle) => {
      gameAudio.playEvent(cue);
      return speakDevelopmentFallback(subtitle);
    });
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.currentAudio) this.currentAudio.volume = muted ? 0 : this.volume;
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0.85));
    if (this.currentAudio && !this.muted) this.currentAudio.volume = this.volume;
  }

  preload() {
    if (typeof Audio === "undefined") return;
    Object.values(GAMEPLAY_ANNOUNCEMENTS).forEach((definition) => {
      const audio = new Audio(definition.assetPath);
      audio.preload = "auto";
    });
  }

  enqueue(request: GameplayAnnouncementRequest) {
    if (!this.seenEventIds.accept(request.eventId)) return false;

    const definition = GAMEPLAY_ANNOUNCEMENTS[request.announcementKey];
    if (!definition || this.now() - request.occurredAt > definition.maxAgeMs) return false;
    const item = { ...request, definition };
    this.queue.push(item);
    this.queue.sort((left, right) => right.definition.priority - left.definition.priority || left.occurredAt - right.occurredAt);
    while (this.queue.length > this.maxQueueSize) this.queue.pop();
    void this.pump();
    return true;
  }

  get queuedCount() {
    return this.queue.length;
  }

  get playing() {
    return this.isPlaying;
  }

  clear() {
    this.queue.length = 0;
    this.currentAudio?.pause();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    this.currentAudio = undefined;
    this.isPlaying = false;
    this.seenEventIds.clear();
  }

  private async pump() {
    if (this.isPlaying || this.queue.length === 0) return;
    const item = this.queue.shift();
    if (!item) return;
    this.isPlaying = true;
    try {
      if (!this.muted) {
        const played = await this.playAsset(item.definition.assetPath, this.volume);
        if (!played) await this.playFallback(item.definition.fallbackCue, item.subtitle ?? item.definition.subtitle);
      }
    } finally {
      this.currentAudio = undefined;
      this.isPlaying = false;
      void this.pump();
    }
  }

  private playBrowserAsset(path: string, volume: number) {
    return new Promise<boolean>((resolve) => {
      if (typeof Audio === "undefined") {
        resolve(false);
        return;
      }
      const audio = new Audio(path);
      this.currentAudio = audio;
      audio.preload = "auto";
      audio.volume = this.muted ? 0 : volume;
      const finish = (played: boolean) => {
        audio.onended = null;
        audio.onerror = null;
        if (this.currentAudio === audio) this.currentAudio = undefined;
        resolve(played);
      };
      audio.onended = () => finish(true);
      audio.onerror = () => finish(false);
      void audio.play().catch(() => finish(false));
    });
  }
}

export const gameplayAnnouncements = new GameplayAnnouncementManager();
