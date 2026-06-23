import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Machine Consensus",
  description: "Can you predict what the machines agree on?",
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
