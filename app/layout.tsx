import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "World Cup 2026 Predictor",
  description:
    "Monte Carlo predictions for the FIFA World Cup 2026, updated with live results.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <SiteHeader />
        <main className="container pb-16 pt-6">{children}</main>
      </body>
    </html>
  );
}
