import { AdvertisingArticlePage } from "@/components/advertising/AdvertisingArticlePage";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <AdvertisingArticlePage slug={slug} />;
}
