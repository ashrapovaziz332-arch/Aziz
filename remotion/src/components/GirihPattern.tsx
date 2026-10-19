import { interpolate, useCurrentFrame } from "remotion";
import { C } from "../brand";
import { octagonPoints, starPoints } from "./geometry";

type Props = {
  tile?: number;
  color?: string;
  background?: string;
  /** 0..1 — chiziqlarni chizilish jarayoni */
  drawFrames?: number;
  rotateDeg?: number;
  zoomFrom?: number;
  zoomTo?: number;
  durationFrames: number;
};

export const GirihPattern: React.FC<Props> = ({
  tile = 180,
  color = C.gold,
  background = C.emerald,
  drawFrames = 40,
  rotateDeg = 6,
  zoomFrom = 1.25,
  zoomTo = 1,
  durationFrames,
}) => {
  const frame = useCurrentFrame();
  const draw = interpolate(frame, [0, drawFrames], [1, 0], { extrapolateRight: "clamp" });
  const zoom = interpolate(frame, [0, durationFrames], [zoomFrom, zoomTo]);
  const rot = interpolate(frame, [0, durationFrames], [0, rotateDeg]);
  const h = tile / 2;
  const dash = tile * 4;

  return (
    <svg width="100%" height="100%" viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0, background }}>
      <defs>
        <pattern id="girih" width={tile} height={tile} patternUnits="userSpaceOnUse">
          <polygon
            points={starPoints(h, h, h * 0.92, h * 0.55)}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeDasharray={dash}
            strokeDashoffset={dash * draw}
          />
          <polygon points={octagonPoints(h, h, h * 0.32)} fill="none" stroke={color} strokeOpacity={0.55} strokeWidth={2} />
          {[0, tile].map((x) =>
            [0, tile].map((y) => (
              <polygon key={`${x}-${y}`} points={starPoints(x, y, h * 0.38, h * 0.22)} fill={color} fillOpacity={0.18} />
            )),
          )}
        </pattern>
        <radialGradient id="vignette" cx="50%" cy="45%" r="75%">
          <stop offset="55%" stopColor={background} stopOpacity={0} />
          <stop offset="100%" stopColor={C.ink} stopOpacity={0.85} />
        </radialGradient>
      </defs>
      <g transform={`translate(540 960) rotate(${rot}) scale(${zoom}) translate(-540 -960)`}>
        <rect x={-600} y={-600} width={2280} height={3120} fill="url(#girih)" />
      </g>
      <rect width={1080} height={1920} fill="url(#vignette)" />
    </svg>
  );
};
