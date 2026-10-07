import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import type { SpeakingAvatarState } from "./avatarBehavior";
import { SPEAKING_AVATARS } from "./speakingAvatars";
import "./speaking-avatar.css";

export interface SpeakingAvatarProps {
  state: SpeakingAvatarState;
  modelSrc?: string;
  fallbackImageSrc?: string;
  fallbackAlt?: string;
  className?: string;
}

function AvatarFallback({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? <MessageCircle size={64} aria-hidden="true" />
    : <img src={src} alt={alt} onError={() => setFailed(true)} />;
}

export default function SpeakingAvatar({ state, modelSrc = SPEAKING_AVATARS.default.modelSrc,
  fallbackImageSrc = SPEAKING_AVATARS.default.fallbackImageSrc, fallbackAlt = "", className = "" }: SpeakingAvatarProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  useLayoutEffect(() => { stateRef.current = state; }, [state]);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    setStatus("loading");
    // Lazy loading also catches chunk/initialization failures without affecting controls.
    void import("./SpeakingAvatarRenderer").then(({ mountSpeakingAvatar }) => {
      if (cancelled) return;
      dispose = mountSpeakingAvatar(host, modelSrc, () => stateRef.current,
        () => { if (!cancelled) setStatus("ready"); },
        () => { if (!cancelled) setStatus("fallback"); });
    }).catch((error: unknown) => {
      if (cancelled) return;
      if (import.meta.env.DEV) console.warn("SpeakCheck avatar unavailable; using the image.", error);
      setStatus("fallback");
    });
    return () => { cancelled = true; dispose?.(); };
  }, [modelSrc]);

  return <div className={`speaking-avatar ${className}`} data-avatar-status={status} data-avatar-state={state} aria-hidden="true">
    <div ref={hostRef} className="speaking-avatar-canvas" style={{ visibility: status === "ready" ? "visible" : "hidden" }} />
    {status !== "ready" && <div className="speaking-avatar-fallback"><AvatarFallback key={fallbackImageSrc} src={fallbackImageSrc} alt={fallbackAlt} /></div>}
  </div>;
}
