"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { NAV_LINKS, NavLinks } from "@/components/nav-links";
import { KitSwitcher } from "@/components/kit-switcher";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile menu on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header
      className="sticky top-0 z-50 border-b border-line backdrop-blur-[14px]"
      style={{ background: "var(--header-bg)" }}
    >
      <div className="mx-auto flex max-w-[1220px] items-center gap-5 px-[22px] py-[13px]">
        <Link href="/" className="flex flex-shrink-0 items-center gap-3">
          <div
            className="grid h-[46px] w-[46px] place-items-center rounded-[14px] font-display text-[21px] font-extrabold tracking-[-1.5px] text-primary-foreground shadow-kit"
            style={{ background: "var(--accent)" }}
          >
            26
          </div>
          <div className="leading-[1.05]">
            <div className="font-display text-[17px] font-extrabold tracking-[-0.4px] text-ink">
              WORLD CUP <span style={{ color: "var(--accent)" }}>26</span>
            </div>
            <div className="text-[10.5px] font-bold tracking-[2.5px] text-[var(--muted)]">
              MATCH PREDICTOR
            </div>
          </div>
        </Link>

        <NavLinks className="ml-1 hidden md:flex" />

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:block">
            <KitSwitcher />
          </div>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={open}
            className="grid h-10 w-10 place-items-center rounded-[10px] border border-line text-ink md:hidden"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={cn(
          "overflow-hidden border-line transition-[max-height] duration-200 md:hidden",
          open ? "max-h-[420px] border-t" : "max-h-0"
        )}
        style={{ background: "var(--header-bg)" }}
      >
        <div className="px-[22px] py-3">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-[10px] px-3 py-2.5 text-sm font-bold transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-[var(--muted)] hover:text-ink"
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-3 border-t border-line pt-3">
            <KitSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}
