import { interpolate, useCurrentFrame } from "remotion";
import { C } from "../brand";

/** Ravoq orqali golden hour manzarasi va sarv qatori (crane-up harakati). */
export const ArchView: React.FC<{ durationFrames: number }> = ({ durationFrames }) => {
  const frame = useCurrentFrame();
  const rise = interpolate(frame, [0, durationFrames], [120, -40]);
  const sun = interpolate(frame, [0, durationFrames], [0.85, 1]);
  const archW = 760;
  const archX = (1080 - archW) / 2;
  const archTop = 420;
  const archBottom = 1600;
  const spring = archTop + 360;
  const arch = `M ${archX} ${archBottom} L ${archX} ${spring} Q ${archX} ${archTop + 60} 540 ${archTop} Q ${archX + archW} ${archTop + 60} ${archX + archW} ${spring} L ${archX + archW} ${archBottom} Z`;

  return (
    <svg width="100%" height="100%" viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0, background: C.ink }}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F6D9A0" />
          <stop offset="55%" stopColor="#E7A86A" />
          <stop offset="100%" stopColor={C.emerald} />
        </linearGradient>
        <clipPath id="archClip">
          <path d={arch} />
        </clipPath>
      </defs>
      <g clipPath="url(#archClip)">
        <rect width={1080} height={1920} fill="url(#sky)" />
        <circle cx={540} cy={900} r={120 * sun} fill="#FFF2D2" opacity={0.9} />
        <g transform={`translate(0 ${rise})`}>
          {[-1, 1].map((side) =>
            [0, 1, 2, 3].map((i) => {
              const x = 540 + side * (110 + i * 75);
              const h = 520 - i * 70;
              return <ellipse key={`${side}-${i}`} cx={x} cy={1500 - h / 2} rx={30 - i * 3} ry={h / 2} fill={C.emerald} opacity={0.95 - i * 0.12} />;
            }),
          )}
          <rect x={510} y={1150} width={60} height={600} fill={C.turquoise} opacity={0.85} />
        </g>
      </g>
      <path d={arch} fill="none" stroke={C.gold} strokeWidth={10} />
      <path d={arch} fill="none" stroke={C.gold} strokeOpacity={0.35} strokeWidth={2} transform="translate(540 1010) scale(1.06) translate(-540 -1010)" />
    </svg>
  );
};
