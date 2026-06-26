import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Outguess",
  description: "Can you outguess 4 AI models?",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
