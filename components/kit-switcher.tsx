"use client";

import { useEffect, useState } from "react";

type Kit = "home" | "away";

const KITS: { key: Kit; label: string; dot: string }[] = [
  { key: "home", label: "Home", dot: "#009e4b" },
  { key: "away", label: "Away", dot: "#b6ff3a" },
];

export function KitSwitcher() {
  const [kit, setKit] = useState<Kit>("home");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-kit");
    if (current === "home" || current === "away") setKit(current);
  }, []);

  const select = (k: Kit) => {
    setKit(k);
    document.documentElement.setAttribute("data-kit", k);
    try {
      localStorage.setItem("wc-kit", k);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[10.5px] font-bold tracking-[1.5px] text-[var(--muted)]">
        KIT
      </span>
      <div className="flex gap-[3px] rounded-xl border border-line bg-panel p-[3px]">
        {KITS.map((k) => {
          const active = kit === k.key;
          return (
            <button
              key={k.key}
              onClick={() => select(k.key)}
              className={`flex items-center gap-1.5 rounded-[9px] px-[11px] py-1.5 text-xs font-bold transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent text-[var(--muted)]"
              }`}
            >
              <span
                className="h-[9px] w-[9px] rounded-full"
                style={{
                  background: k.dot,
                  boxShadow: active ? "0 0 0 2px rgba(255,255,255,.5)" : "none",
                }}
              />
              {k.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
