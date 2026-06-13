import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-display",
});
const body = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://wc.danterigoli.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "World Cup 26 Predictor — title odds for all 48 nations",
    template: "%s · World Cup 26 Predictor",
  },
  description:
    "Live FIFA World Cup 2026 win probabilities for all 48 nations, from a LightGBM goals model run over 10,000 Monte Carlo tournament simulations. Dashboard, match predictions, a what-if simulator and odds-over-time trends.",
  applicationName: "World Cup 26 Predictor",
  keywords: [
    "World Cup 2026",
    "FIFA World Cup 26",
    "predictions",
    "title odds",
    "Monte Carlo simulation",
    "LightGBM",
    "Elo ratings",
    "football forecast",
    "soccer predictions",
  ],
  authors: [{ name: "Dante Rigoli" }],
  openGraph: {
    type: "website",
    siteName: "World Cup 26 Predictor",
    title: "World Cup 26 Predictor — title odds for all 48 nations",
    description:
      "Live win probabilities for all 48 nations from a LightGBM goals model over 10,000 Monte Carlo simulations.",
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "World Cup 26 Predictor",
    description:
      "Live win probabilities for all 48 nations — a LightGBM goals model over 10,000 Monte Carlo simulations.",
  },
  robots: { index: true, follow: true },
};

// Set the saved kit before paint to avoid a flash of the wrong theme.
const KIT_SCRIPT = `(function(){try{var k=localStorage.getItem("wc-kit");if(k!=="home"&&k!=="away")k="home";document.documentElement.setAttribute("data-kit",k);}catch(e){document.documentElement.setAttribute("data-kit","home");}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-kit="home"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: KIT_SCRIPT }} />
      </head>
      <body className="font-sans">
        <SiteHeader />
        <main className="mx-auto max-w-[1220px] px-[22px] pb-24 pt-6">
          {children}
        </main>
        <footer className="border-t border-line px-[22px] py-5 text-center text-[11px] text-[var(--muted)]">
          Fan project · the model blends a 150-year Elo rating, FIFA world
          ranking and squad market value through a LightGBM goals model over
          10,000 Monte Carlo simulations. Not affiliated with or endorsed by
          FIFA.
        </footer>
      </body>
    </html>
  );
}
