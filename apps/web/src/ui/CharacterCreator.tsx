import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import {
  APPEARANCE_COLORS,
  BACKPACK_STYLES,
  CHARACTER_PRESETS,
  DEFAULT_PLAYER_APPEARANCE,
  EYEWEAR_STYLES,
  HELMET_STYLES,
  SCHOOL_APPEARANCE_PRESETS,
  SHOE_STYLES,
  sanitizePlayerAppearance,
  type CharacterCustomizationSettings,
  type PlayerAppearance,
  type Team
} from "@quizstrike/shared";
import { Camera, Check, Dice5, ImagePlus, RotateCcw, Save, ShieldCheck, X } from "lucide-react";
import { CharacterFactory } from "../game/characters/CharacterFactory";
import {
  DEFAULT_DECAL_EDIT_OPTIONS,
  processDecalImage,
  validateDecalFile,
  type DecalEditOptions
} from "../game/characters/decalProcessing";

type CharacterCreatorProps = {
  appearance?: PlayerAppearance;
  team: Team;
  policy: CharacterCustomizationSettings;
  disabled?: boolean;
  onSave: (appearance: PlayerAppearance) => Promise<void>;
  onUploadDecal: (blob: Blob) => Promise<string>;
  loadDecalAsset: (assetId: string) => Promise<Blob>;
};

const labelFor = (value: string) => value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
const appearanceSignature = (appearance: PlayerAppearance) => JSON.stringify(appearance);

function CharacterPreview({
  appearance,
  team,
  loadDecalAsset,
  localDecal
}: {
  appearance: PlayerAppearance;
  team: Team;
  loadDecalAsset: (assetId: string) => Promise<Blob>;
  localDecal?: Blob | null;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const loadRef = useRef(loadDecalAsset);
  loadRef.current = loadDecalAsset;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#dcecff");
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
    let distance = 10;
    camera.position.set(0, 3.2, distance);
    camera.lookAt(0, 2.4, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight("#ffffff", "#8293aa", 2.4));
    const key = new THREE.DirectionalLight("#ffffff", 2.2);
    key.position.set(4, 8, 6);
    key.castShadow = true;
    scene.add(key);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(4.2, 40),
      new THREE.MeshStandardMaterial({ color: "#a8c8e8", roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const makeTexture = async (assetId: string) => {
      const blob = assetId === "00000000-0000-0000-0000-000000000000" && localDecal ? localDecal : await loadRef.current(assetId);
      const url = URL.createObjectURL(blob);
      try {
        return await new Promise<THREE.Texture>((resolve, reject) => new THREE.TextureLoader().load(url, resolve, undefined, reject));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    const previewAppearance = localDecal ? { ...appearance, decalAssetId: "00000000-0000-0000-0000-000000000000" } : appearance;
    const factory = new CharacterFactory({ loadDecalTexture: makeTexture });
    const model = factory.createCharacter({ playerId: "lobby-preview", team, appearance: previewAppearance, gear: "starter_blaster" });
    model.root.rotation.y = Math.PI;
    scene.add(model.root);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let dragging = false;
    let lastX = 0;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchDistance = 0;
    let lastTime = performance.now();
    let userRotationAt = 0;
    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    const animate = (time: number) => {
      if (document.hidden) {
        if (!reducedMotion) frame = requestAnimationFrame(animate);
        return;
      }
      const delta = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;
      if (!reducedMotion && !dragging && time - userRotationAt > 1800) model.root.rotation.y += delta * 0.35;
      renderer.render(scene, camera);
      if (!reducedMotion) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    const pointerDown = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2) {
        const [first, second] = [...pointers.values()];
        pinchDistance = Math.hypot(second.x - first.x, second.y - first.y);
      }
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const pointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size >= 2) {
        const [first, second] = [...pointers.values()];
        const nextDistance = Math.hypot(second.x - first.x, second.y - first.y);
        if (pinchDistance > 0) {
          distance = Math.max(7, Math.min(13, distance - (nextDistance - pinchDistance) * 0.018));
          camera.position.z = distance;
        }
        pinchDistance = nextDistance;
        userRotationAt = performance.now();
        return;
      }
      model.root.rotation.y += (event.clientX - lastX) * 0.012;
      lastX = event.clientX;
      userRotationAt = performance.now();
      if (reducedMotion) renderer.render(scene, camera);
    };
    const pointerUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      pinchDistance = 0;
      dragging = pointers.size > 0;
      const remaining = [...pointers.values()][0];
      if (remaining) lastX = remaining.x;
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      distance = Math.max(7, Math.min(13, distance + event.deltaY * 0.01));
      camera.position.z = distance;
      userRotationAt = performance.now();
      if (reducedMotion) renderer.render(scene, camera);
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("pointercancel", pointerUp);
    renderer.domElement.addEventListener("wheel", wheel, { passive: false });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      model.dispose();
      factory.dispose();
      renderer.dispose();
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      renderer.domElement.remove();
    };
  }, [appearanceSignature(appearance), team, localDecal]);

  return <div ref={mountRef} className="character-preview" role="img" aria-label="Live 3D preview. Drag to rotate and scroll to zoom." />;
}

function DecalEditor({ file, appearance, team, loadDecalAsset, onCancel, onConfirm }: { file: File; appearance: PlayerAppearance; team: Team; loadDecalAsset: (assetId: string) => Promise<Blob>; onCancel: () => void; onConfirm: (blob: Blob) => Promise<void> }) {
  const [options, setOptions] = useState<DecalEditOptions>(DEFAULT_DECAL_EDIT_OPTIONS);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => closeRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') ?? []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      void processDecalImage(file, options, 256).then((blob) => {
        if (!active) return;
        const url = URL.createObjectURL(blob);
        setPreview((current) => {
          if (current) URL.revokeObjectURL(current.url);
          return { url, blob };
        });
        setError("");
      }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Preview failed."));
    }, 100);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [file, options]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview?.url]);
  const update = <K extends keyof DecalEditOptions>(key: K, value: DecalEditOptions[K]) => setOptions((current) => ({ ...current, [key]: value }));
  const confirm = async () => {
    setWorking(true);
    setError("");
    try {
      await onConfirm(await processDecalImage(file, options));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The sticker could not be saved.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="decal-editor" role="dialog" aria-modal="true" aria-labelledby="decal-editor-title">
      <div ref={dialogRef} className="decal-editor-card">
        <header><div><span>Local image editor</span><h3 id="decal-editor-title">Make a safe sticker</h3></div><button ref={closeRef} type="button" onClick={onCancel} aria-label="Cancel sticker"><X /></button></header>
        <p className="privacy-note"><ShieldCheck size={18} />Use a drawing, symbol, or pattern—not a face, name, school ID, or private photo. The original stays on this device.</p>
        <div className="decal-editor-layout">
          <div className="decal-editor-previews">
            <div className="decal-preview-checker">{preview && <img src={preview.url} alt="Transparent sticker preview" />}</div>
            <CharacterPreview appearance={appearance} team={team} loadDecalAsset={loadDecalAsset} localDecal={preview?.blob} />
          </div>
          <div className="decal-controls">
            <button type="button" onClick={() => update("rotation", ((options.rotation + 90) % 360) as DecalEditOptions["rotation"])}><RotateCcw size={16} />Rotate 90°</button>
            {([['scale', 'Scale', 0.6, 2], ['offsetX', 'Left / right', -1, 1], ['offsetY', 'Up / down', -1, 1], ['brightness', 'Brightness', 60, 140], ['contrast', 'Contrast', 60, 160]] as const).map(([key, label, min, max]) => (
              <label key={key}>{label}<input type="range" min={min} max={max} step={key.startsWith("offset") ? 0.05 : key === "scale" ? 0.05 : 5} value={options[key]} onChange={(event) => update(key, Number(event.target.value))} /></label>
            ))}
            <label className="toggle-row"><input type="checkbox" checked={options.removeLightBackground} onChange={(event) => update("removeLightBackground", event.target.checked)} />Remove light background</label>
            <label className="toggle-row"><input type="checkbox" checked={options.posterize} onChange={(event) => update("posterize", event.target.checked)} />Cartoon colours</label>
            <label className="toggle-row"><input type="checkbox" checked={options.outline} onChange={(event) => update("outline", event.target.checked)} />White sticker border</label>
          </div>
        </div>
        {error && <p className="error-text" role="alert">{error}</p>}
        <footer><button type="button" onClick={() => setOptions(DEFAULT_DECAL_EDIT_OPTIONS)}>Reset</button><button type="button" onClick={onCancel}>Cancel</button><button className="primary" type="button" disabled={working || !preview} onClick={confirm}>{working ? "Processing…" : "Use Sticker"}</button></footer>
      </div>
    </div>
  );
}

export default function CharacterCreator({ appearance, team, policy, disabled, onSave, onUploadDecal, loadDecalAsset }: CharacterCreatorProps) {
  const initial = useMemo(() => sanitizePlayerAppearance(appearance), [appearanceSignature(sanitizePlayerAppearance(appearance))]);
  const [draft, setDraft] = useState<PlayerAppearance>(initial);
  const [savedSignature, setSavedSignature] = useState(appearanceSignature(initial));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Appearance saved");
  const [error, setError] = useState("");
  const [decalFile, setDecalFile] = useState<File | null>(null);

  useEffect(() => {
    const next = sanitizePlayerAppearance(appearance);
    setDraft(next);
    setSavedSignature(appearanceSignature(next));
  }, [appearanceSignature(sanitizePlayerAppearance(appearance))]);

  const save = async (next = draft) => {
    if (saving || disabled) return;
    setSaving(true);
    setError("");
    try {
      await onSave(next);
      setSavedSignature(appearanceSignature(next));
      setMessage("Appearance saved");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Appearance could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const dirty = appearanceSignature(draft) !== savedSignature;
  useEffect(() => {
    if (!dirty || disabled || saving) return;
    const timeout = window.setTimeout(() => void save(draft), 850);
    return () => window.clearTimeout(timeout);
  }, [appearanceSignature(draft), disabled, saving]);

  const change = <K extends keyof PlayerAppearance>(key: K, value: PlayerAppearance[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setMessage("Saving changes…");
  };
  const randomize = () => {
    const pick = <T,>(values: readonly T[]) => values[Math.floor(Math.random() * values.length)];
    setDraft((current) => ({
      ...current,
      characterPreset: pick(CHARACTER_PRESETS),
      helmetStyle: pick(HELMET_STYLES),
      helmetColor: pick(APPEARANCE_COLORS),
      backpackStyle: pick(BACKPACK_STYLES),
      backpackColor: pick(APPEARANCE_COLORS),
      eyewearStyle: pick(EYEWEAR_STYLES),
      eyewearColor: pick(APPEARANCE_COLORS),
      clothingPrimaryColor: pick(APPEARANCE_COLORS),
      clothingSecondaryColor: pick(APPEARANCE_COLORS),
      shoeStyle: pick(SHOE_STYLES),
      shoeColor: pick(APPEARANCE_COLORS)
    }));
  };
  const chooseFile = (file?: File) => {
    if (!file) return;
    const validationError = validateDecalFile(file);
    if (validationError) setError(validationError);
    else {
      setError("");
      setDecalFile(file);
    }
  };

  if (!policy.enabled) return <div className="customization-locked"><ShieldCheck size={20} /><span>Your teacher has locked character customization. Your safe default is ready.</span></div>;

  return (
    <section className="character-creator" aria-label="Character creator">
      <div className="creator-heading">
        <div><span>Ready room</span><h3>Build Your Player</h3></div>
        <div className="creator-actions">
          <button type="button" onClick={randomize} disabled={disabled || policy.presetsOnly}><Dice5 size={16} />Randomize</button>
          <button type="button" onClick={() => setDraft({ ...DEFAULT_PLAYER_APPEARANCE })} disabled={disabled}><RotateCcw size={16} />Reset</button>
        </div>
      </div>
      <div className="character-creator-preview-column">
        <CharacterPreview appearance={draft} team={team} loadDecalAsset={loadDecalAsset} />
        <div className="appearance-save-state" aria-live="polite">{dirty ? "Unsaved changes" : <><Check size={15} />{message}</>}</div>
      </div>
      <div className="character-creator-controls">
        <div className="creator-controls-scroll">
          <div className="appearance-presets" aria-label="Approved presets">{SCHOOL_APPEARANCE_PRESETS.map((preset) => <button type="button" key={preset.id} onClick={() => setDraft({ ...preset.appearance })} disabled={disabled}>{preset.name}</button>)}</div>
          {!policy.presetsOnly && (
            <div className="appearance-fields">
              {([
                ["characterPreset", "Body preset", CHARACTER_PRESETS],
                ["helmetStyle", "Helmet", HELMET_STYLES],
                ["backpackStyle", "Backpack", BACKPACK_STYLES],
                ["eyewearStyle", "Glasses", EYEWEAR_STYLES],
                ["shoeStyle", "Shoes", SHOE_STYLES]
              ] as const).map(([key, label, values]) => <label key={key}>{label}<select value={draft[key]} onChange={(event) => change(key, event.target.value as never)} disabled={disabled}>{values.map((value) => <option key={value} value={value}>{labelFor(value)}</option>)}</select></label>)}
              {([['clothingPrimaryColor', 'Jacket'], ['clothingSecondaryColor', 'Trousers'], ['helmetColor', 'Helmet colour'], ['backpackColor', 'Pack colour'], ['eyewearColor', 'Glasses colour'], ['shoeColor', 'Shoe colour']] as const).map(([key, label]) => (
                <fieldset className="colour-field" key={key}><legend>{label}</legend><div>{APPEARANCE_COLORS.map((color) => <button type="button" key={color} className={draft[key] === color ? "selected" : ""} style={{ '--swatch': color } as CSSProperties} onClick={() => change(key, color)} aria-label={`${label} ${color}`} aria-pressed={draft[key] === color} disabled={disabled} />)}</div></fieldset>
              ))}
            </div>
          )}
          <div className="decal-row">
            <div><strong>Artwork sticker</strong><small>{policy.uploadsEnabled ? "Processed here; only the small finished sticker is uploaded." : "Teacher approval is required for uploads."}</small></div>
            {policy.uploadsEnabled && <div className="decal-input-actions"><label className="file-button"><ImagePlus size={17} />Upload<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { chooseFile(event.target.files?.[0]); event.currentTarget.value = ""; }} disabled={disabled} /></label><label className="file-button"><Camera size={17} />Camera<input type="file" accept="image/*" capture="environment" onChange={(event) => { chooseFile(event.target.files?.[0]); event.currentTarget.value = ""; }} disabled={disabled} /></label></div>}
            {draft.decalAssetId && <button type="button" onClick={() => change("decalAssetId", undefined)} disabled={disabled}>Remove</button>}
          </div>
          {error && <p className="error-text" role="alert">{error}</p>}
        </div>
        <button className="primary save-appearance" type="button" onClick={() => void save()} disabled={disabled || saving || !dirty}><Save size={17} />{saving ? "Saving…" : dirty ? "Save Appearance" : "Saved"}</button>
      </div>
      {decalFile && <DecalEditor file={decalFile} appearance={draft} team={team} loadDecalAsset={loadDecalAsset} onCancel={() => setDecalFile(null)} onConfirm={async (blob) => { const assetId = await onUploadDecal(blob); const next = { ...draft, decalAssetId: assetId }; setDraft(next); setDecalFile(null); await save(next); }} />}
    </section>
  );
}
