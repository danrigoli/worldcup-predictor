import Link from "next/link";
import { NavLinks } from "@/components/nav-links";
import { KitSwitcher } from "@/components/kit-switcher";

export function SiteHeader() {
  return (
    <header
      className="sticky top-0 z-50 border-b border-line backdrop-blur-[14px]"
      style={{ background: "var(--header-bg)" }}
    >
      <div className="mx-auto flex max-w-[1220px] flex-wrap items-center gap-5 px-[22px] py-[13px]">
        <Link href="/" className="flex items-center gap-3">
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

        <NavLinks />

        <div className="ml-auto">
          <KitSwitcher />
        </div>
      </div>
    </header>
  );
}
