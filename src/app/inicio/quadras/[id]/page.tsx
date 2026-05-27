import { CourtDetailPage } from "@/components/courts/CourtDetailPage";

export default async function QuadraDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CourtDetailPage id={id} />;
}
