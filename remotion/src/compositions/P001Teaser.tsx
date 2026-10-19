import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { C } from "../brand";
import type { Scene, Script } from "../types";
import { ArchView } from "../components/ArchView";
import { ChorbaghPlan } from "../components/ChorbaghPlan";
import { FountainRipples } from "../components/FountainRipples";
import { GirihPattern } from "../components/GirihPattern";
import { Hud } from "../components/Hud";
import { KineticText } from "../components/KineticText";
import { SceneFrame } from "../components/SceneFrame";

/**
 * №001 — Islomiy landshaft: texnik/uslub test kompozitsiyasi.
 * Matnlar va vaqtlar faqat 01-creative/script.json dan olinadi.
 * 3D renderlar tayyor bo'lgach, fon vizuallari <OffthreadVideo> bilan almashtiriladi.
 */
const Visual: React.FC<{ scene: Scene; frames: number }> = ({ scene, frames }) => {
  switch (scene.id) {
    case "s01":
      return <GirihPattern durationFrames={frames} />;
    case "s02":
      return <ChorbaghPlan />;
    case "s03":
      return <FountainRipples durationFrames={frames} />;
    case "s04":
      return <GirihPattern durationFrames={frames} tile={320} background={C.ink} zoomFrom={1} zoomTo={1.3} rotateDeg={-10} />;
    case "s05":
      return <ArchView durationFrames={frames} />;
    default:
      return <ChorbaghPlan night />;
  }
};

const textY = (scene: Scene): number => {
  if (scene.id === "s02" || scene.id === "s06") return 1290; // reja ostida, handle ustida
  if (scene.purpose === "hook") return 900;
  return 1300;
};

export const P001Teaser: React.FC<{ script: Script }> = ({ script }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      {script.scenes.map((scene) => {
        const from = Math.round(scene.startSec * fps);
        const frames = Math.round(scene.durationSec * fps);
        return (
          <Sequence key={scene.id} from={from} durationInFrames={frames} name={`${scene.id} · ${scene.purpose}`}>
            <SceneFrame durationFrames={frames}>
              <Visual scene={scene} frames={frames} />
              <KineticText
                text={scene.onScreenText}
                y={textY(scene)}
                size={scene.purpose === "hook" ? 104 : 84}
                color={scene.id === "s02" ? C.emerald : C.sand}
                accent={scene.id === "s02" ? C.turquoise : C.gold}
                plate={scene.id === "s04" || scene.id === "s05"}
              />
            </SceneFrame>
          </Sequence>
        );
      })}
      <Hud projectId={script.projectId} title={script.title} />
    </AbsoluteFill>
  );
};
