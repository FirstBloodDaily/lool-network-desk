import type { Metadata } from "next";
import "./globals.css";
import SessionGate from "@/components/SessionGate";

export const metadata: Metadata = {
  title: "LoL Network Desk",
  description: "YouTube desk for a LoL Esports channel network. 100% network metrics.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><SessionGate>{children}</SessionGate></body>
    </html>
  );
}
