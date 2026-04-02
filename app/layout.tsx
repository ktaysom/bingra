import "./globals.css";
import type { Metadata } from "next";
import { getPublicBaseUrl } from "../lib/share/share";

export const metadata: Metadata = {
  metadataBase: new URL(getPublicBaseUrl()),
  icons: {
    icon: "/logos/bingra-favicon.svg",
    shortcut: "/logos/bingra-favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-bingra-app-bg text-bingra-dark">{children}</body>
    </html>
  );
}