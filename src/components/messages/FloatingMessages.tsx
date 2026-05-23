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
  "fixed bottom-20 z-50 right-4 sm:right-6 md:bottom-6 lg:right-[max(1.5rem,calc((100vw-260px-1040px)/2+1rem))]";

export const floatingMessagesPopupClass =
  "fixed bottom-[5.5rem] z-[60] w-[min(360px,calc(100vw-2rem))] right-4 sm:right-6 md:bottom-[4.5rem] lg:right-[max(1.5rem,calc((100vw-260px-1040px)/2+1rem))]";
