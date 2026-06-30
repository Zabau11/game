import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Modelmind",
  description: "Guess the hidden consensus of 4 AI models.",
  openGraph: {
    title: "Modelmind",
    description: "Guess the hidden consensus of 4 AI models.",
    images: [
      {
        url: "/link-preview.png?v=1",
        width: 2940,
        height: 1530,
        alt: "Modelmind landing page preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Modelmind",
    description: "Guess the hidden consensus of 4 AI models.",
    images: ["/link-preview.png?v=1"],
  },
  icons: {
    icon: [
      { url: "/icon.png?v=2", type: "image/png", sizes: "256x256" },
      { url: "/icon.svg?v=2", type: "image/svg+xml" },
    ],
    shortcut: [{ url: "/icon.png?v=2", type: "image/png" }],
    apple: [{ url: "/icon.png?v=2", type: "image/png", sizes: "256x256" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
