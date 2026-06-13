import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// Generated PNG favicon (the "26" mark) — a raster icon renders reliably in
// every browser tab, unlike an SVG <text> favicon.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#009e4b",
          color: "#06210f",
          fontSize: 38,
          fontWeight: 900,
          letterSpacing: -3,
          fontFamily: "sans-serif",
          borderRadius: 14,
        }}
      >
        26
      </div>
    ),
    size
  );
}
