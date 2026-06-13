import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 96,
          fontWeight: 900,
          letterSpacing: -8,
          fontFamily: "sans-serif",
        }}
      >
        26
      </div>
    ),
    size
  );
}
