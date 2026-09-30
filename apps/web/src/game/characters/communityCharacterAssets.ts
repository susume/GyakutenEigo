export const COMMUNITY_CHARACTER = {
  id: "kenney-skater",
  url: "assets/community/kenney-protagonist/character.glb",
  textureUrl: "assets/community/kenney-protagonist/skater.png",
  source: "https://kenney.nl/assets/animated-characters-protagonists",
  license: "CC0-1.0",
  height: 2.05,
  forwardRotation: Math.PI,
  clips: { idle: "idle", run: "run", jump: "jump" }
} as const;
