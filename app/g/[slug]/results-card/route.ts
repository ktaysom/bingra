import { ImageResponse } from "next/og";
import { createElement } from "react";

export const runtime = "nodejs";

function sanitizeLabel(value: string | null, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.slice(0, 50);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const teamA = sanitizeLabel(url.searchParams.get("teamA"), "Team A");
  const teamB = sanitizeLabel(url.searchParams.get("teamB"), "Team B");
  const winner = sanitizeLabel(url.searchParams.get("winner"), "Winner");
  const score = sanitizeLabel(url.searchParams.get("score"), "—");
  const raw = sanitizeLabel(url.searchParams.get("raw"), "—");
  const hasBingra = url.searchParams.get("bingra") === "1";

  return new ImageResponse(
    createElement(
      "div",
      {
        style: {
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "radial-gradient(circle at 20% 15%, #1d4ed8 0%, #1e293b 42%, #0f172a 100%)",
          color: "#ffffff",
          padding: "56px",
          fontFamily: "Inter, Arial, sans-serif",
          border: "8px solid #60a5fa",
        },
      },
      createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 14 } },
        createElement(
          "div",
          {
            style: {
              alignSelf: "flex-start",
              backgroundColor: "rgba(96, 165, 250, 0.18)",
              border: "2px solid rgba(147, 197, 253, 0.65)",
              borderRadius: "999px",
              padding: "8px 18px",
              fontSize: 20,
              letterSpacing: 1.6,
              textTransform: "uppercase",
              fontWeight: 700,
            },
          },
          "Bingra Results",
        ),
        createElement(
          "div",
          { style: { fontSize: 66, fontWeight: 850, lineHeight: 1.02, letterSpacing: -1 } },
          `${teamA} vs ${teamB}`,
        ),
      ),
      createElement(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: "22px 24px",
            borderRadius: "22px",
            backgroundColor: "rgba(15, 23, 42, 0.56)",
            border: "1px solid rgba(148, 163, 184, 0.5)",
          },
        },
        createElement("div", { style: { fontSize: 36, fontWeight: 800 } }, `🏆 Winner: ${winner}`),
        createElement(
          "div",
          { style: { fontSize: 30, opacity: 0.96, fontWeight: 600 } },
          `Final score: ${score}`,
        ),
        createElement(
          "div",
          { style: { fontSize: 24, opacity: 0.95, fontWeight: 600 } },
          `Raw score: ${raw}${hasBingra ? " · Bingra x2" : ""}`,
        ),
        createElement(
          "div",
          { style: { fontSize: 22, opacity: 0.86 } },
          "Predict game events and race to Bingra",
        ),
        createElement(
          "div",
          { style: { fontSize: 18, opacity: 0.74, letterSpacing: 0.4 } },
          "bingra.app",
        ),
      ),
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}