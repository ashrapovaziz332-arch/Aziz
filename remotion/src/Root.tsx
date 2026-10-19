import { Composition } from "remotion";
import { P001Teaser } from "./compositions/P001Teaser";
import script001 from "../../projects/001-islomiy-landshaft/01-creative/script.json";
import pipeline from "../../studio/pipeline.json";

const { width, height, fps } = pipeline.format;

export const Root: React.FC = () => (
  <>
    <Composition
      id="P001-Teaser"
      component={P001Teaser}
      durationInFrames={Math.round(script001.durationSec * fps)}
      fps={fps}
      width={width}
      height={height}
      defaultProps={{ script: script001 }}
    />
  </>
);
