"use client";

import { create } from "zustand";
import type { Override, Overrides } from "@/lib/types";

interface OverrideState {
  overrides: Overrides;
  setOverride: (matchNumber: number, override: Override) => void;
  clearOverride: (matchNumber: number) => void;
  clearAll: () => void;
}

export const useOverrideStore = create<OverrideState>((set) => ({
  overrides: {},
  setOverride: (matchNumber, override) =>
    set((s) => ({ overrides: { ...s.overrides, [matchNumber]: override } })),
  clearOverride: (matchNumber) =>
    set((s) => {
      const next = { ...s.overrides };
      delete next[matchNumber];
      return { overrides: next };
    }),
  clearAll: () => set({ overrides: {} }),
}));
