"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/matches", label: "Matches" },
  { href: "/simulator", label: "Simulator" },
  { href: "/trends", label: "Trends" },
  { href: "/model", label: "Model" },
];

export function NavLinks({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav
      className={cn(
        "no-scrollbar flex flex-nowrap gap-[3px] overflow-x-auto",
        className
      )}
    >
      {links.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "whitespace-nowrap rounded-[10px] px-[13px] py-[7px] text-[13px] font-bold transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-transparent text-[var(--muted)] hover:text-ink"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
