import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { brand, C, FONT_BODY } from "../brand";

/** Doimiy brend qatlami: loyiha raqami (yuqori xavfsiz chiziq), handle va progress (pastki xavfsiz chiziq). */
export const Hud: React.FC<{ projectId: string; title: string }> = ({ projectId, title }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { topPx, bottomPx, sidePx } = brand.safeZone;
  const progress = frame / durationInFrames;
  const appear = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const label: React.CSSProperties = {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    whiteSpace: "nowrap",
    padding: "10px 22px",
    borderRadius: 999,
    background: "rgba(11,20,16,0.55)",
    fontFamily: FONT_BODY,
    fontWeight: 700,
    letterSpacing: 6,
    fontSize: 26,
    color: C.sand,
    opacity: appear,
    textShadow: "0 2px 12px rgba(0,0,0,0.5)",
  };

  return (
    <>
      <div style={{ ...label, top: topPx }}>
        №{projectId} · {title.toUpperCase()}
      </div>
      <div style={{ ...label, bottom: bottomPx + 30, fontWeight: 500, letterSpacing: 3 }}>{brand.handle}</div>
      <div
        style={{
          position: "absolute",
          left: sidePx,
          bottom: bottomPx,
          height: 4,
          width: (1080 - sidePx * 2) * progress,
          background: C.gold,
          borderRadius: 2,
        }}
      />
    </>
  );
};
