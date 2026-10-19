import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT_DISPLAY } from "../brand";

type Props = {
  text: string;
  /** Matn markazining Y koordinatasi (px). Instagram xavfsiz zonasida qolishi kerak. */
  y?: number;
  size?: number;
  color?: string;
  accent?: string;
  delay?: number;
  /** Murakkab fon ustida o'qilishi uchun yarim shaffof plashka */
  plate?: boolean;
};

export const KineticText: React.FC<Props> = ({ text, y = 1180, size = 92, color = C.sand, accent = C.gold, delay = 6, plate = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");

  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        right: 80,
        top: y,
        transform: "translateY(-50%)",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: `0 ${size * 0.28}px`,
        fontFamily: FONT_DISPLAY,
        fontWeight: 600,
        fontSize: size,
        lineHeight: 1.12,
        textAlign: "center",
        textShadow: "0 6px 30px rgba(0,0,0,0.45)",
        ...(plate ? { background: "rgba(11,20,16,0.62)", padding: "28px 36px", borderRadius: 28 } : {}),
      }}
    >
      {words.map((w, i) => {
        const s = spring({ frame: frame - delay - i * 4, fps, config: { damping: 14, mass: 0.6 } });
        const isLast = i === words.length - 1;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              color: isLast ? accent : color,
              fontStyle: isLast ? "italic" : "normal",
              opacity: interpolate(s, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(s, [0, 1], [50, 0])}px)`,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};
