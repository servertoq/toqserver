import type { Metadata } from "next";
import { LEGAL_DOCUMENTS } from "@/lib/legal/documents";
import { LEGAL_SITE } from "@/lib/legal/site";
import { LegalDocShell } from "@/components/legal/LegalDocShell";

const doc = LEGAL_DOCUMENTS.termos;

export const metadata: Metadata = {
  title: `${doc.title} | ${LEGAL_SITE.brand}`,
  description: doc.description,
};

export default function TermosPage() {
  return <LegalDocShell docId="termos" />;
}
