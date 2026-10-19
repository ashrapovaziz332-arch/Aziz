import { interpolate, useCurrentFrame } from "remotion";
import { C } from "../brand";
import { octagonPoints, starPoints } from "./geometry";

export const FountainRipples: React.FC<{ durationFrames: number }> = ({ durationFrames }) => {
  const frame = useCurrentFrame();
  const rings = 6;
  const period = 45;
  const zoom = interpolate(frame, [0, durationFrames], [1, 1.18]);

  return (
    <svg width="100%" height="100%" viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>
      <defs>
        <radialGradient id="pool" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={C.turquoise} />
          <stop offset="100%" stopColor={C.emerald} />
        </radialGradient>
      </defs>
      <rect width={1080} height={1920} fill="url(#pool)" />
      <g transform={`translate(540 860) scale(${zoom}) translate(-540 -860)`}>
        {Array.from({ length: rings }, (_, i) => {
          const t = ((frame + (i * period) / 1.5) % (period * 4)) / (period * 4);
          return (
            <polygon
              key={i}
              points={octagonPoints(540, 860, 60 + t * 620)}
              fill="none"
              stroke={C.sand}
              strokeOpacity={(1 - t) * 0.6}
              strokeWidth={4 - t * 3}
            />
          );
        })}
        <polygon points={octagonPoints(540, 860, 150)} fill={C.ink} fillOpacity={0.25} stroke={C.gold} strokeWidth={8} />
        <polygon
          points={starPoints(540, 860, 90, 55)}
          fill={C.gold}
          transform={`rotate(${frame * 0.6} 540 860)`}
        />
      </g>
    </svg>
  );
};
