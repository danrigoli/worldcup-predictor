import Link from "next/link";
import { Trophy } from "lucide-react";
import { NavLinks } from "@/components/nav-links";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="container flex h-14 items-center gap-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Trophy className="h-5 w-5 text-primary" />
          <span>WC 2026 Predictor</span>
        </Link>
        <NavLinks />
      </div>
    </header>
  );
}
