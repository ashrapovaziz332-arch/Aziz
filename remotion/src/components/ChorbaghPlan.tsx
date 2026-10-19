import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../brand";
import { octagonPoints } from "./geometry";

/**
 * Chorbog' rejasining top-down animatsiyasi.
 * Masshtab: 20 × 20 m hovli → sizePx (standart 760 px, 38 px = 1 m). Landscape Architect plan.json tayyor bo'lgach,
 * o'lchamlar shu yerga props orqali uzatiladi.
 */
type Props = { night?: boolean; siteM?: number; channelM?: number; fountainRM?: number; sizePx?: number; centerY?: number };

export const ChorbaghPlan: React.FC<Props> = ({ night = false, siteM = 20, channelM = 1, fountainRM = 2, sizePx = 740, centerY = 770 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const S = sizePx;
  const px = S / siteM;
  const ox = (1080 - S) / 2;
  const oy = centerY - S / 2;
  const ch = channelM * px;
  const margin = 0.8 * px;
  const half = (S - ch) / 2;

  const border = interpolate(frame, [0, 30], [1, 0], { extrapolateRight: "clamp" });
  const channel = spring({ frame: frame - 18, fps, config: { damping: 200 } });
  const fountain = spring({ frame: frame - 40, fps, config: { damping: 12 } });
  const bg = night ? C.ink : C.sand;
  const line = night ? C.gold : C.emerald;
  const water = night ? "#7FE3DA" : C.turquoise;

  const parterres = [
    [0, 0],
    [half + ch, 0],
    [0, half + ch],
    [half + ch, half + ch],
  ];
  const cypressCount = 9;

  return (
    <svg width="100%" height="100%" viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0, background: bg }}>
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation={night ? 10 : 0} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g transform={`translate(${ox} ${oy})`}>
        {parterres.map(([x, y], i) => {
          const o = interpolate(frame, [30 + i * 6, 50 + i * 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <rect
              key={i}
              x={x + margin}
              y={y + margin}
              width={half - margin * 2}
              height={half - margin * 2}
              rx={8}
              fill={night ? C.emeraldLight : C.emerald}
              opacity={o * (night ? 0.55 : 0.9)}
            />
          );
        })}
        <g filter="url(#glow)">
          <rect x={half} y={S / 2 - (S / 2) * channel} width={ch} height={S * channel} fill={water} />
          <rect x={S / 2 - (S / 2) * channel} y={half} width={S * channel} height={ch} fill={water} />
          <polygon
            points={octagonPoints(S / 2, S / 2, fountainRM * px * fountain)}
            fill={water}
            stroke={C.gold}
            strokeWidth={6}
          />
        </g>
        <rect
          x={0}
          y={0}
          width={S}
          height={S}
          fill="none"
          stroke={line}
          strokeWidth={8}
          strokeDasharray={S * 4}
          strokeDashoffset={S * 4 * border}
        />
        {Array.from({ length: cypressCount }, (_, i) => {
          const t = (i + 0.5) / cypressCount;
          const o = interpolate(frame, [50 + i * 2, 60 + i * 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <g key={i} opacity={o} fill={night ? C.gold : C.emeraldLight}>
              <circle cx={S * t} cy={-0.5 * px} r={0.35 * px} />
              <circle cx={S * t} cy={S + 0.5 * px} r={0.35 * px} />
            </g>
          );
        })}
      </g>
    </svg>
  );
};
