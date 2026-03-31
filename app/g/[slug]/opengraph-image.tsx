import { ImageResponse } from "next/og";
import { getPublicGameShareDataBySlug } from "../../../lib/share/game-public";

export const runtime = "nodejs";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

type OgImageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function OpenGraphImage(props: OgImageProps) {
  const { slug } = await props.params;

  const game = await getPublicGameShareDataBySlug(slug);

  const teamA = game?.teamAName ?? "Team A";
  const teamB = game?.teamBName ?? "Team B";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #312e81 100%)",
          color: "#ffffff",
          padding: "56px",
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              fontSize: 26,
              letterSpacing: 2,
              textTransform: "uppercase",
              opacity: 0.9,
            }}
          >
            Bingra
          </div>
          <div style={{ fontSize: 74, fontWeight: 800, lineHeight: 1.05 }}>{teamA} vs {teamB}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 34, opacity: 0.95 }}>Predict game events and race to Bingra</div>
          <div
            style={{
              fontSize: 20,
              opacity: 0.8,
            }}
          >
            Think you can beat my picks? 🏆
          </div>
        </div>
      </div>
    ),
    size,
  );
}