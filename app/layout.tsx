import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
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
      <body className="bg-bingra-gray-light text-bingra-dark">{children}</body>
    </html>
  );
}