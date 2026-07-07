"use client";

import { Suspense } from "react";
import { FloatingMessagesInner } from "./FloatingMessagesInner";

export function FloatingMessages() {
  return (
    <Suspense fallback={null}>
      <FloatingMessagesInner />
    </Suspense>
  );
}

/** Alinha o dock com a coluna direita do feed (280px) em telas grandes */
export const floatingMessagesDockClass =
  "fixed z-50 right-4 sm:right-6 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] md:bottom-6 lg:right-6";

export const floatingMessagesPopupClass =
  "fixed z-[60] w-[min(360px,calc(100vw-2rem))] right-4 sm:right-6 bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] md:bottom-[4.5rem] lg:right-6";
