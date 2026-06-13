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

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 text-sm">
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground",
            pathname === href && "bg-secondary text-foreground"
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
