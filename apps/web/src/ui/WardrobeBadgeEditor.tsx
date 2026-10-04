import { useEffect, useRef, useState } from "react";
import { Camera, Eraser, Pencil, RotateCcw, Star, Undo2, Upload, Zap } from "lucide-react";
import { DEFAULT_DECAL_EDIT_OPTIONS, processDecalImage, validateDecalFile, type DecalEditOptions } from "../game/characters/decalProcessing";
import { useSiteTranslation } from "./siteTranslation";

export default function WardrobeBadgeEditor({ disabled, onPreview, onApply }: {
  disabled?: boolean; onPreview: (blob: Blob) => void; onApply: (blob: Blob) => Promise<void>;
}) {
  const { t } = useSiteTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null), cameraRef = useRef<HTMLInputElement>(null);
  const history = useRef<ImageData[]>([]);
  const lastPoint = useRef<{ x: number; y: number; pointer: number } | null>(null);
  const alive = useRef(true);
  const [color, setColor] = useState("#64d6ff");
  const [erase, setErase] = useState(false), [hasArt, setHasArt] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [options, setOptions] = useState<DecalEditOptions>(DEFAULT_DECAL_EDIT_OPTIONS);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const remember = () => {
    const context = canvasRef.current?.getContext("2d", { willReadFrequently: true });
    if (context) { history.current.push(context.getImageData(0, 0, 512, 512)); if (history.current.length > 12) history.current.shift(); }
  };
  const clear = () => { remember(); canvasRef.current?.getContext("2d")?.clearRect(0, 0, 512, 512); setHasArt(false); };
  const undo = () => {
    const last = history.current.pop(); if (!last) return;
    canvasRef.current?.getContext("2d")?.putImageData(last, 0, 0);
    setHasArt(last.data.some((value, i) => i % 4 === 3 && value > 0));
  };
  const importArtwork = async (file?: File) => {
    if (!file || disabled || busy) return;
    const invalid = validateDecalFile(file); if (invalid) { setError(invalid); return; }
    setBusy(true); setError("");
    try {
      const blob = await processDecalImage(file, { ...DEFAULT_DECAL_EDIT_OPTIONS, outline: false });
      const bitmap = await createImageBitmap(blob);
      try {
        if (!alive.current) return;
        const context = canvasRef.current?.getContext("2d"); if (!context) return;
        remember(); context.globalCompositeOperation = "source-over"; context.clearRect(0, 0, 512, 512); context.drawImage(bitmap, 0, 0, 512, 512); setHasArt(true);
        setOptions(DEFAULT_DECAL_EDIT_OPTIONS);
      } finally { bitmap.close(); }
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : "Your artwork couldn’t load."); }
    finally { if (alive.current) setBusy(false); }
  };
  const stamp = (kind: "star" | "bolt") => {
    const context = canvasRef.current?.getContext("2d"); if (!context || disabled || busy) return;
    remember(); context.save(); context.globalCompositeOperation = "source-over"; context.fillStyle = color; context.beginPath();
    if (kind === "star") {
      for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? 76 : 170;
        const x = 256 + Math.cos(angle) * radius, y = 256 + Math.sin(angle) * radius;
        if (i) context.lineTo(x, y); else context.moveTo(x, y);
      }
    } else {
      context.moveTo(286, 70); context.lineTo(150, 280); context.lineTo(250, 280);
      context.lineTo(214, 442); context.lineTo(366, 215); context.lineTo(270, 215);
    }
    context.closePath(); context.fill(); context.restore(); setHasArt(true); setError("");
  };
  const exportArtwork = async (apply: boolean) => {
    if (disabled || busy || !hasArt || !canvasRef.current) return;
    setBusy(true); setError("");
    try {
      const blob = await new Promise<Blob | null>(resolve => canvasRef.current!.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Your artwork couldn’t be exported.");
      const processed = await processDecalImage(new File([blob], "badge.png", { type: "image/png" }), options);
      if (!alive.current) return;
      if (apply) await onApply(processed); else onPreview(processed);
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : "Your badge couldn’t save."); }
    finally { if (alive.current) setBusy(false); }
  };
  const palette = [{ name: "Ice blue", value: "#64d6ff" }, { name: "Coral", value: "#ff927a" }, { name: "Gold", value: "#ffcf69" }, { name: "Violet", value: "#bd99ff" }, { name: "White", value: "#ffffff" }, { name: "Ink", value: "#233451" }];
  return <fieldset className="wardrobe-badge-editor" disabled={disabled || busy}>
    <legend>{t("Your signature badge")}</legend><p>{t("Draw a symbol or upload your artwork.")}</p>
    <div className="wardrobe-drawing-toolbar" role="group" aria-label={t("Drawing tools")}>
      <button type="button" aria-label={t("Draw")} aria-pressed={!erase} onClick={() => setErase(false)}><Pencil size={17} aria-hidden="true" /></button>
      <button type="button" aria-label={t("Erase")} aria-pressed={erase} onClick={() => setErase(true)}><Eraser size={17} aria-hidden="true" /></button>
      <button type="button" aria-label={t("Undo drawing")} onClick={undo}><Undo2 size={17} aria-hidden="true" /></button>
      <button type="button" aria-label={t("Clear drawing")} onClick={clear}><RotateCcw size={17} aria-hidden="true" /></button>
      <button type="button" aria-label={t("Add a star")} onClick={() => stamp("star")}><Star size={17} aria-hidden="true" /></button>
      <button type="button" aria-label={t("Add a lightning bolt")} onClick={() => stamp("bolt")}><Zap size={17} aria-hidden="true" /></button>
    </div>
    <div className="wardrobe-drawing-colors" role="group" aria-label={t("Drawing colors")}>{palette.map(item => <button type="button" key={item.value} style={{ backgroundColor: item.value }} aria-label={t(item.name)} aria-pressed={item.value === color} onClick={() => setColor(item.value)} />)}</div>
    <canvas width={512} height={512} ref={canvasRef} aria-label={t("Badge drawing canvas. Use drawing tools or upload artwork.")}
      onPointerDown={event => {
        if (disabled || busy) return; remember(); event.currentTarget.setPointerCapture(event.pointerId);
        const rect = event.currentTarget.getBoundingClientRect();
        const point = { x: (event.clientX - rect.left) * 512 / rect.width, y: (event.clientY - rect.top) * 512 / rect.height, pointer: event.pointerId };
        lastPoint.current = point;
        const context = event.currentTarget.getContext("2d"); if (!context) return;
        context.globalCompositeOperation = erase ? "destination-out" : "source-over"; context.fillStyle = color;
        context.beginPath(); context.arc(point.x, point.y, erase ? 18 : 8, 0, Math.PI * 2); context.fill(); setHasArt(true);
      }} onPointerMove={event => {
        const last = lastPoint.current; if (!last || last.pointer !== event.pointerId || disabled || busy) return;
        const rect = event.currentTarget.getBoundingClientRect(), x = (event.clientX - rect.left) * 512 / rect.width, y = (event.clientY - rect.top) * 512 / rect.height;
        const context = event.currentTarget.getContext("2d"); if (!context) return;
        context.globalCompositeOperation = erase ? "destination-out" : "source-over"; context.strokeStyle = color;
        context.lineWidth = erase ? 36 : 16; context.lineCap = "round"; context.lineJoin = "round";
        context.beginPath(); context.moveTo(last.x, last.y); context.lineTo(x, y); context.stroke(); lastPoint.current = { x, y, pointer: event.pointerId };
      }} onPointerUp={() => { lastPoint.current = null; }} onPointerCancel={() => { lastPoint.current = null; }} />
    <div className="wardrobe-badge-upload"><button type="button" onClick={() => fileRef.current?.click()}><Upload size={15} aria-hidden="true" />{t("Upload artwork")}</button><button type="button" onClick={() => cameraRef.current?.click()}><Camera size={15} aria-hidden="true" />{t("Camera")}</button></div>
    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event => { void importArtwork(event.target.files?.[0]); event.target.value = ""; }} />
    <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={event => { void importArtwork(event.target.files?.[0]); event.target.value = ""; }} />
    <label>{t("Artwork size")}<input type="range" min="0.5" max="1.5" step="0.05" value={options.scale} onChange={event => setOptions(current => ({ ...current, scale: Number(event.target.value) }))} /></label>
    <label>{t("Brightness")}<input type="range" min="60" max="140" step="5" value={options.brightness} onChange={event => setOptions(current => ({ ...current, brightness: Number(event.target.value) }))} /></label>
    <div className="wardrobe-badge-effects"><label><input type="checkbox" checked={options.removeLightBackground} onChange={event => setOptions(current => ({ ...current, removeLightBackground: event.target.checked }))} />{t("Remove white background")}</label><label><input type="checkbox" checked={options.outline} onChange={event => setOptions(current => ({ ...current, outline: event.target.checked }))} />{t("Sticker outline")}</label></div>
    <div className="wardrobe-badge-upload"><button type="button" disabled={!hasArt} onClick={() => void exportArtwork(false)}>{t("Preview badge")}</button><button type="button" disabled={!hasArt} onClick={() => void exportArtwork(true)}>{t("Use badge")}</button></div>
    {busy && <p role="status">{t("Preparing your badge…")}</p>}{error && <p role="alert">{t(error)}</p>}
  </fieldset>;
}
