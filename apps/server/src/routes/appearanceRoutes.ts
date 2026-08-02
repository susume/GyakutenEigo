import type { Application, Request, Response } from "express";
import type { DecalStore } from "../decalStore.js";
import type {
  GameEvent,
  GameSession,
  CharacterCustomizationSettings,
  PlayerAppearance,
  PlayerSession,
  TeacherUser
} from "@quizstrike/shared";

type AuthedRequest = Request & { user?: TeacherUser };

export type AppearanceRouteDependencies = {
  getSessionByCode: (code: string) => GameSession | undefined;
  routeParam: (value: string | string[] | undefined) => string;
  requireTeacher: (req: AuthedRequest, res: Response, next: () => void) => void;
  requirePlayerAccess: (req: Request, res: Response, session: GameSession, player: PlayerSession) => boolean;
  appearanceUpdateTimestamps: Map<string, number>;
  appearanceUpdateCooldownMs: number;
  getPlayerAppearanceError: (input: unknown) => string | undefined;
  sanitizePlayerAppearance: (input: Partial<PlayerAppearance>) => PlayerAppearance;
  getLockedAppearanceItems: (appearance: PlayerAppearance, level: number) => Array<{ name: string; unlockLevel: number }>;
  getCosmeticProgress: (player: PlayerSession) => { level: number };
  decalStore: DecalStore;
  checkDecalUploadRate: (playerId: string) => boolean;
  inspectProcessedDecal: (bytes: Buffer, mimeType: string | undefined) => string | undefined;
  decalMaxProcessedBytes: number;
  id: () => string;
  deleteDecal: (assetId: string | undefined) => void;
  broadcastSession: (session: GameSession) => void;
  stampSession: (session: GameSession) => GameSession;
  sanitizeCharacterCustomizationSettings: (input: Record<string, unknown> | undefined) => CharacterCustomizationSettings;
  aiSkinProviderConfigured: boolean;
  clearPlayerAppearance: (session: GameSession, player: PlayerSession) => void;
  appendEvent: (session: GameSession, event: Omit<GameEvent, "id" | "createdAt">) => GameEvent;
  canReadRoomAsset: (req: Request, session: GameSession) => boolean;
};

const getSessionAndPlayer = (deps: AppearanceRouteDependencies, req: Request) => {
  const session = deps.getSessionByCode(deps.routeParam(req.params.code));
  const player = session?.players.find((candidate) => candidate.id === deps.routeParam(req.params.playerId));
  return { session, player };
};

export const registerAppearanceRoutes = (app: Application, deps: AppearanceRouteDependencies) => {
  app.put("/api/sessions/:code/players/:playerId/appearance", (req, res) => {
    const { session, player } = getSessionAndPlayer(deps, req);
    if (!session || !player || player.isBot) {
      res.status(404).json({ error: "Player session not found." });
      return;
    }
    if (!deps.requirePlayerAccess(req, res, session, player)) return;
    const policy = session.settings.characterCustomization;
    if (session.status !== "waiting" || !policy.enabled) {
      res.status(423).json({ error: "Character customization is locked." });
      return;
    }
    const lastUpdate = deps.appearanceUpdateTimestamps.get(player.id) ?? 0;
    if (Date.now() - lastUpdate < deps.appearanceUpdateCooldownMs) {
      res.status(429).json({ error: "Please wait a moment before saving again." });
      return;
    }
    const input = req.body?.appearance ?? req.body;
    const validationError = deps.getPlayerAppearanceError(input);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }
    const appearance = deps.sanitizePlayerAppearance(input as Partial<PlayerAppearance>);
    const lockedItems = deps.getLockedAppearanceItems(appearance, deps.getCosmeticProgress(player).level);
    if (lockedItems.length > 0) {
      res.status(403).json({ error: `${lockedItems[0].name} unlocks at cosmetic level ${lockedItems[0].unlockLevel}.` });
      return;
    }
    if (appearance.decalAssetId) {
      const decal = deps.decalStore.get(appearance.decalAssetId);
      if (!policy.uploadsEnabled || !decal || decal.sessionId !== session.id || decal.playerId !== player.id) {
        res.status(400).json({ error: "That decal is not available for this player." });
        return;
      }
    }
    if (player.appearance?.decalAssetId !== appearance.decalAssetId) deps.deleteDecal(player.appearance?.decalAssetId);
    player.appearance = appearance;
    deps.appearanceUpdateTimestamps.set(player.id, Date.now());
    deps.broadcastSession(session);
    res.json({ session: deps.stampSession(session), player });
  });

  app.post("/api/sessions/:code/players/:playerId/decals", (req, res) => {
    const { session, player } = getSessionAndPlayer(deps, req);
    if (!session || !player || player.isBot) {
      res.status(404).json({ error: "Player session not found." });
      return;
    }
    if (!deps.requirePlayerAccess(req, res, session, player)) return;
    const policy = session.settings.characterCustomization;
    if (session.status !== "waiting" || !policy.enabled || !policy.uploadsEnabled) {
      res.status(423).json({ error: "Uploaded decals are not enabled for this room." });
      return;
    }
    if (!deps.checkDecalUploadRate(player.id)) {
      res.status(429).json({ error: "Upload limit reached. Try again in one minute." });
      return;
    }
    const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const mimeType = deps.inspectProcessedDecal(bytes, req.header("content-type")?.split(";")[0]);
    if (!mimeType || bytes.length === 0 || bytes.length > deps.decalMaxProcessedBytes) {
      res.status(415).json({ error: "Upload a processed PNG or WebP decal within the size limit." });
      return;
    }
    const assetId = deps.id();
    const stored = deps.decalStore.put(
      { id: assetId, sessionId: session.id, playerId: player.id, mimeType: mimeType as "image/png" | "image/webp", bytes, createdAt: Date.now() },
      player.appearance?.decalAssetId
    );
    if (!stored.ok) {
      res.status(413).json({ error: "This room's sticker storage is full. Ask your teacher to remove an older sticker." });
      return;
    }
    res.status(201).json({ assetId, mimeType, bytes: bytes.length });
  });

  app.get("/api/sessions/:code/decals", deps.requireTeacher, (req: AuthedRequest, res) => {
    const session = deps.getSessionByCode(deps.routeParam(req.params.code));
    if (!session || session.teacherId !== req.user!.id) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    const assets = deps.decalStore.listSession(session.id).map((asset) => {
      const player = session.players.find((candidate) => candidate.id === asset.playerId);
      return {
        ...asset,
        nickname: player?.nickname ?? "Former player",
        createdAt: new Date(asset.createdAt).toISOString(),
        expiresAt: new Date(asset.expiresAt).toISOString(),
        isActive: player?.appearance?.decalAssetId === asset.assetId
      };
    });
    res.json({ assets, totalBytes: deps.decalStore.getSessionBytes(session.id), maxBytes: deps.decalStore.roomMaxBytes });
  });

  app.get("/api/sessions/:code/decals/:assetId", (req, res) => {
    const session = deps.getSessionByCode(deps.routeParam(req.params.code));
    const decal = deps.decalStore.get(deps.routeParam(req.params.assetId));
    if (!session || !decal || decal.sessionId !== session.id) {
      res.status(404).json({ error: "Decal not found." });
      return;
    }
    if (!deps.canReadRoomAsset(req, session)) {
      res.status(401).json({ error: "Room access is required." });
      return;
    }
    res.setHeader("Cache-Control", "private, max-age=3600, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.status(200).type(decal.mimeType).send(decal.bytes);
  });

  app.put("/api/sessions/:code/customization", deps.requireTeacher, (req: AuthedRequest, res) => {
    const session = deps.getSessionByCode(deps.routeParam(req.params.code));
    if (!session || session.teacherId !== req.user!.id) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    if (session.status !== "waiting") {
      res.status(423).json({ error: "Customization settings are locked after the match starts." });
      return;
    }
    const requested = deps.sanitizeCharacterCustomizationSettings(req.body);
    if (requested.aiEnabled && !deps.aiSkinProviderConfigured) {
      res.status(400).json({ error: "AI designs require a configured secure server provider." });
      return;
    }
    if (!requested.uploadsEnabled) {
      for (const player of session.players) {
        if (player.appearance?.decalAssetId) {
          player.appearance = { ...player.appearance, decalAssetId: undefined };
        }
      }
      deps.decalStore.deleteSession(session.id);
    }
    session.settings.characterCustomization = requested;
    deps.broadcastSession(session);
    res.json({ session: deps.stampSession(session), aiProviderConfigured: deps.aiSkinProviderConfigured });
  });

  app.delete("/api/sessions/:code/players/:playerId/appearance", deps.requireTeacher, (req: AuthedRequest, res) => {
    const { session, player } = getSessionAndPlayer(deps, req);
    if (!session || session.teacherId !== req.user!.id || !player) {
      res.status(404).json({ error: "Player session not found." });
      return;
    }
    deps.clearPlayerAppearance(session, player);
    deps.appendEvent(session, { type: "timer", message: `Teacher cleared ${player.nickname}'s custom appearance.`, playerId: player.id, team: player.team });
    deps.broadcastSession(session);
    res.json({ session: deps.stampSession(session), player });
  });

  app.delete("/api/sessions/:code/players/:playerId/decal", deps.requireTeacher, (req: AuthedRequest, res) => {
    const { session, player } = getSessionAndPlayer(deps, req);
    if (!session || session.teacherId !== req.user!.id || !player) {
      res.status(404).json({ error: "Player session not found." });
      return;
    }
    deps.decalStore.deletePlayer(session.id, player.id);
    player.appearance = { ...deps.sanitizePlayerAppearance(player.appearance ?? {}), decalAssetId: undefined };
    deps.appendEvent(session, { type: "timer", message: `Teacher removed ${player.nickname}'s custom sticker.`, playerId: player.id, team: player.team });
    deps.broadcastSession(session);
    res.json({ session: deps.stampSession(session), player });
  });

  app.delete("/api/sessions/:code/decals/:assetId", deps.requireTeacher, (req: AuthedRequest, res) => {
    const session = deps.getSessionByCode(deps.routeParam(req.params.code));
    const assetId = deps.routeParam(req.params.assetId);
    const decal = deps.decalStore.get(assetId);
    if (!session || session.teacherId !== req.user!.id || !decal || decal.sessionId !== session.id) {
      res.status(404).json({ error: "Decal not found." });
      return;
    }
    deps.decalStore.delete(assetId);
    const player = session.players.find((candidate) => candidate.id === decal.playerId);
    if (player?.appearance?.decalAssetId === assetId) player.appearance = { ...player.appearance, decalAssetId: undefined };
    deps.appendEvent(session, { type: "timer", message: `Teacher removed ${player?.nickname ?? "a player's"} custom sticker.`, playerId: player?.id, team: player?.team });
    deps.broadcastSession(session);
    res.json({ session: deps.stampSession(session) });
  });

  app.post("/api/sessions/:code/appearance/reset", deps.requireTeacher, (req: AuthedRequest, res) => {
    const session = deps.getSessionByCode(deps.routeParam(req.params.code));
    if (!session || session.teacherId !== req.user!.id) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    session.players.forEach((player) => deps.clearPlayerAppearance(session, player));
    deps.decalStore.deleteSession(session.id);
    deps.appendEvent(session, { type: "timer", message: "Teacher reset all custom appearances." });
    deps.broadcastSession(session);
    res.json({ session: deps.stampSession(session) });
  });
};
