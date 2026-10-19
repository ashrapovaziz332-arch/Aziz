import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

/** Har bir sahna uchun kirish/chiqish transitioni (fade + yengil masshtab). */
export const SceneFrame: React.FC<{ durationFrames: number; fade?: number; children: React.ReactNode }> = ({
  durationFrames,
  fade = 8,
  children,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, fade, durationFrames - fade, durationFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [0, fade], [1.04, 1], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity, transform: `scale(${scale})` }}>{children}</AbsoluteFill>;
};
