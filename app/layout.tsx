import type { Metadata, Viewport } from "next";
import "./globals.css";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://lnkiai.github.io"),
  title: "M3E Canvas",
  applicationName: "M3E Canvas",
  alternates: { canonical: `${BASE}/` },
  description:
    "Sketch Material 3 Expressive screens in the browser and turn them into vibe-coding prompts. / Material 3 Expressive の画面をブラウザで組み立てて、そのままプロンプトに。",
  openGraph: {
    title: "M3E Canvas",
    description: "Design Material 3 Expressive screens, link them, preview them, and copy a prompt for your AI coding tool.",
    images: [`${BASE}/og.png`],
    type: "website",
  },
  twitter: { card: "summary_large_image", images: [`${BASE}/og.png`] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#6750A4",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* The text face still comes from Google; the fallbacks carry the page when it is unreachable. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&display=swap"
        />
        {/* The icon font is served from this site, so the icons never fall back to their
            names when Google cannot be reached. */}
        <style
          dangerouslySetInnerHTML={{
            __html: `@font-face{font-family:"Material Symbols Rounded";src:url("${BASE}/fonts/material-symbols-rounded.woff2") format("woff2-variations");font-weight:100 700;font-style:normal;font-display:block;}`,
          }}
        />
        <link rel="preload" as="font" type="font/woff2" href={`${BASE}/fonts/material-symbols-rounded.woff2`} crossOrigin="anonymous" />
      </head>
      <body style={{ fontFamily: "Roboto, system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
