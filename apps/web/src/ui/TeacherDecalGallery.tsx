import { useEffect, useRef, useState } from "react";
import { Eye, ImageOff, ShieldCheck, Trash2, X } from "lucide-react";
import { teacherApi, type DecalModerationAsset, type DecalModerationSummary } from "../api/client";

type TeacherDecalGalleryProps = {
  sessionCode: string;
  refreshKey: string;
  loadAsset: (assetId: string) => Promise<Blob>;
  onRemove: (assetId: string) => Promise<void>;
};

const formatBytes = (bytes: number) => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;

function AuthenticatedDecalImage({ asset, loadAsset, className }: { asset: DecalModerationAsset; loadAsset: (assetId: string) => Promise<Blob>; className?: string }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setFailed(false);
    void loadAsset(asset.assetId).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(() => { if (active) setFailed(true); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [asset.assetId, loadAsset]);
  if (failed) return <span className={`moderation-image-fallback ${className ?? ""}`}><ImageOff aria-hidden="true" />Unavailable</span>;
  return url
    ? <img className={className} src={url} alt={`${asset.nickname}'s submitted sticker`} />
    : <span className={`moderation-image-fallback ${className ?? ""}`}>Loading…</span>;
}

export default function TeacherDecalGallery({ sessionCode, refreshKey, loadAsset, onRemove }: TeacherDecalGalleryProps) {
  const [summary, setSummary] = useState<DecalModerationSummary | null>(null);
  const [preview, setPreview] = useState<DecalModerationAsset | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setError("");
    void teacherApi.listDecals(sessionCode).then((payload) => {
      if (active) setSummary(payload as DecalModerationSummary);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Sticker submissions could not be loaded.");
    });
    return () => { active = false; };
  }, [sessionCode, refreshKey, revision]);

  useEffect(() => {
    if (!preview) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    window.setTimeout(() => closeRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPreview(null);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') ?? []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [preview?.assetId]);

  const remove = async (assetId: string) => {
    setError("");
    try {
      await onRemove(assetId);
      if (preview?.assetId === assetId) setPreview(null);
      setRevision((current) => current + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sticker could not be removed.");
    }
  };

  return (
    <section className="decal-moderation" aria-labelledby="decal-moderation-title">
      <header>
        <div><h4 id="decal-moderation-title"><ShieldCheck size={18} />Sticker Review</h4><p>Private to this room. Preview drawings and remove anything unsuitable.</p></div>
        {summary && <span>{formatBytes(summary.totalBytes)} / {formatBytes(summary.maxBytes)}</span>}
      </header>
      {error && <p className="error-text" role="alert">{error}</p>}
      {!summary && !error && <p>Loading sticker submissions…</p>}
      {summary?.assets.length === 0 && <p className="moderation-empty">No stickers submitted.</p>}
      <div className="decal-moderation-grid">
        {summary?.assets.map((asset) => (
          <article key={asset.assetId}>
            <AuthenticatedDecalImage asset={asset} loadAsset={loadAsset} />
            <div><strong>{asset.nickname}</strong><small>{asset.isActive ? "In use" : "Awaiting save"} · {formatBytes(asset.byteLength)}</small></div>
            <div className="moderation-actions"><button type="button" onClick={() => setPreview(asset)}><Eye size={15} />View</button><button type="button" onClick={() => void remove(asset.assetId)}><Trash2 size={15} />Remove</button></div>
          </article>
        ))}
      </div>
      {preview && (
        <div className="moderation-preview-backdrop" role="presentation">
          <div ref={dialogRef} className="moderation-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="moderation-preview-title">
            <header><div><h3 id="moderation-preview-title">{preview.nickname}'s sticker</h3><p>{formatBytes(preview.byteLength)} · deleted automatically after this room</p></div><button ref={closeRef} type="button" onClick={() => setPreview(null)} aria-label="Close sticker preview"><X /></button></header>
            <div className="moderation-preview-checker"><AuthenticatedDecalImage asset={preview} loadAsset={loadAsset} className="moderation-preview-image" /></div>
            <footer><button type="button" onClick={() => setPreview(null)}>Keep</button><button type="button" className="danger" onClick={() => void remove(preview.assetId)}><Trash2 size={16} />Remove Sticker</button></footer>
          </div>
        </div>
      )}
    </section>
  );
}
