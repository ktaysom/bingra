import "./globals.css";
import type { Metadata, Viewport } from "next";
import { getPublicBaseUrl } from "../lib/share/share";

const ROOT_LAYOUT_MODULE_LOADED_AT = Date.now();

export const metadata: Metadata = {
  metadataBase: new URL(getPublicBaseUrl()),
  icons: {
    icon: "/logos/bingra-favicon.svg",
    shortcut: "/logos/bingra-favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  console.info("[app/layout][timing]", {
    segment: "render",
    moduleLoadAgeMs: Date.now() - ROOT_LAYOUT_MODULE_LOADED_AT,
  });
  return (
    <html lang="en">
      <body className="bg-bingra-app-bg text-bingra-dark">{children}</body>
    </html>
  );
}
