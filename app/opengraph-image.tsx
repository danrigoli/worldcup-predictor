import { ImageResponse } from "next/og";

export const alt = "World Cup 26 Predictor — win probabilities for all 48 nations";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background:
            "radial-gradient(125% 135% at 100% 0%, #19a04c 0%, #0c5e2e 44%, #093f20 100%)",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Watermark 26 */}
        <div
          style={{
            position: "absolute",
            right: -40,
            bottom: -180,
            fontSize: 560,
            fontWeight: 900,
            color: "rgba(196,255,61,0.10)",
            letterSpacing: -30,
          }}
        >
          26
        </div>

        {/* Brand lockup */}
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 28,
              background: "#c4ff3d",
              color: "#06210f",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 52,
              fontWeight: 900,
              letterSpacing: -4,
            }}
          >
            26
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ color: "#ffffff", fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>
              WORLD CUP 26 PREDICTOR
            </div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 20, fontWeight: 700, letterSpacing: 4 }}>
              LIGHTGBM · MONTE CARLO
            </div>
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 96, fontWeight: 900, letterSpacing: -4, color: "#ffffff" }}>
            THE ROAD TO&nbsp;<span style={{ color: "#c4ff3d" }}>2026</span>
          </div>
          <div style={{ color: "rgba(255,255,255,0.82)", fontSize: 30, fontWeight: 500, maxWidth: 900 }}>
            Win probabilities for all 48 nations — a machine-learning goals model
            over 10,000 Monte Carlo tournament simulations.
          </div>
        </div>
      </div>
    ),
    size
  );
}
