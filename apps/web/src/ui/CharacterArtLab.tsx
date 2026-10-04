import { useState } from "react";
import { DEFAULT_CHARACTER_CUSTOMIZATION_SETTINGS, DEFAULT_PLAYER_APPEARANCE, getCosmeticProgress, sanitizePlayerAppearance, type PlayerAppearance, type Team } from "@quizstrike/shared";
import { CharacterPreview } from "./CharacterCreator";
import PremiumCharacterCreator from "./PremiumCharacterCreator";

/** Development-only studio: also the reproducible source of the catalog artwork. */
export default function CharacterArtLab() {
  const params = new URLSearchParams(window.location.search);
  const [team, setTeam] = useState<Team>(params.get("team") === "red" ? "red" : "blue");
  const [appearance, setAppearance] = useState<PlayerAppearance>(() => sanitizePlayerAppearance({
    ...DEFAULT_PLAYER_APPEARANCE,
    headStyleId: params.get("head") ?? "boy_short_hair",
    backAccessoryId: params.get("back") ?? "none",
    footwearId: params.get("footwear") ?? "runners",
    victoryPoseId: params.get("pose") ?? "champion"
  }));
  const unavailableDecal = async () => { throw new Error("Decals are unavailable in the art lab"); };
  const capture = params.get("catalogCapture");
  if (capture) return <div className="wardrobe-capture" style={{ width: 512, height: 512 }}>
    <CharacterPreview appearance={appearance} team={team} loadDecalAsset={unavailableDecal}
      focusHead={capture === "head"} focusBack={capture === "back"} focusFootwear={capture === "footwear"}
      showVictoryPose={capture === "victory"} showWeapon={false} />
  </div>;
  return <div className="wardrobe-art-lab">
    <div className="section-heading"><div><h1>Character art studio</h1><p>Live game models · original QuizStrike cosmetics</p></div>
      <div className="button-row"><button onClick={() => setTeam("blue")} aria-pressed={team === "blue"}>Blue team</button><button onClick={() => setTeam("red")} aria-pressed={team === "red"}>Red team</button></div>
    </div>
    <PremiumCharacterCreator appearance={appearance} team={team} policy={DEFAULT_CHARACTER_CUSTOMIZATION_SETTINGS}
      progress={getCosmeticProgress({ correctAnswers: 100, tags: 100 })}
      onSave={async next => { setAppearance(next); }} onUploadDecal={unavailableDecal} loadDecalAsset={unavailableDecal} />
  </div>;
}
