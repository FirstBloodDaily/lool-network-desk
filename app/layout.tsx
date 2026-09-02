import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LoL Network Desk",
  description: "Investor dashboard for the three-channel League of Legends YouTube network. 100% network metrics.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
