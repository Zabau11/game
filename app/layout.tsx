import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Modelmind",
  description: "Guess the hidden consensus of 4 AI models.",
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
