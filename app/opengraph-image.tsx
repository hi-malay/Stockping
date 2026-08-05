import { ImageResponse } from "next/og";

// Next picks this up for both og:image and twitter:image automatically
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Stockping — restock alerts for Blinkit, Zepto and Instamart";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0b0b0c",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 88, fontWeight: 700, letterSpacing: -2 }}>stockping</div>
        <div style={{ fontSize: 38, marginTop: 16, color: "#a1a1aa", lineHeight: 1.35 }}>
          Restock alerts on Telegram for Blinkit, Zepto &amp; Instamart
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 48 }}>
          {["Blinkit", "Zepto", "Instamart"].map((p) => (
            <div
              key={p}
              style={{
                fontSize: 30,
                padding: "12px 28px",
                borderRadius: 999,
                border: "2px solid #27272a",
                color: "#e4e4e7",
              }}
            >
              {p}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 28, marginTop: 48, color: "#4ade80" }}>
          🟢 checks every 30 min · price + direct link
        </div>
      </div>
    ),
    size,
  );
}
