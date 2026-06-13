"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/matches", label: "Matches" },
  { href: "/simulator", label: "Simulator" },
  { href: "/trends", label: "Trends" },
  { href: "/model", label: "Model" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="ml-1 flex flex-nowrap gap-[3px]">
      {links.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`whitespace-nowrap rounded-[10px] px-[13px] py-[7px] text-[13px] font-bold transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "bg-transparent text-[var(--muted)] hover:text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
