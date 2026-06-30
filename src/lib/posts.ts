import type { SupabaseClient } from "@supabase/supabase-js";
import { insertPostMentions, resolveMentionUserIds } from "@/lib/mentions";
import { extensionForMediaFile, mediaKindFromFile } from "@/lib/postMedia";
import type { PostType, PostVisibility } from "@/types/feed";

export type CreatePostInput = {
  authorId: string;
  body: string;
  postType: PostType;
  title: string | null;
  visibility: PostVisibility;
  communityId: string | null;
  eventDate: string | null;
  eventTime: string | null;
  files: File[];
};

const POST_SELECT = `
  id,
  body,
  title,
  post_type,
  created_at,
  community_id,
  visibility,
  event_date,
  event_time,
  author:profiles!posts_author_id_fkey(id, username, avatar_url, plan, show_plan_badge),
  images:post_images(url, sort_order, media_type),
  communities(name, slug, accent_color),
  mentions:post_mentions(
    mentioned_user:profiles!post_mentions_mentioned_user_id_fkey(id, username, avatar_url)
  )
`;

export { POST_SELECT };

export async function createPostWithMedia(
  supabase: SupabaseClient,
  input: CreatePostInput
): Promise<{ postId: string | null; error: string | null }> {
  const mentionIds = await resolveMentionUserIds(supabase, input.body, input.authorId);

  const { data: newPost, error: insertErr } = await supabase
    .from("posts")
    .insert({
      author_id: input.authorId,
      body: input.body,
      post_type: input.postType,
      title: input.title,
      visibility: input.visibility,
      community_id: input.communityId,
      event_date: input.postType === "event" && input.eventDate ? input.eventDate : null,
      event_time:
        input.postType === "event" && input.eventTime
          ? input.eventTime.length === 5
            ? `${input.eventTime}:00`
            : input.eventTime
          : null,
    })
    .select("id")
    .single();

  if (insertErr || !newPost) {
    return { postId: null, error: insertErr?.message ?? "Não foi possível publicar." };
  }

  await insertPostMentions(supabase, newPost.id, mentionIds);

  for (let i = 0; i < input.files.length; i++) {
    const file = input.files[i];
    const ext = extensionForMediaFile(file);
    const path = `${input.authorId}/${newPost.id}/${Date.now()}-${i}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("post-images")
      .upload(path, file, { upsert: false, contentType: file.type });

    if (uploadErr) continue;

    const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(path);
    await supabase.from("post_images").insert({
      post_id: newPost.id,
      url: urlData.publicUrl,
      sort_order: i,
      media_type: mediaKindFromFile(file),
    });
  }

  return { postId: newPost.id, error: null };
}

export function formatEventSchedule(eventDate: string | null, eventTime: string | null) {
  const parts: string[] = [];
  if (eventDate) {
    parts.push(
      new Date(eventDate + "T12:00:00").toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    );
  }
  if (eventTime) {
    const t = eventTime.slice(0, 5);
    parts.push(t);
  }
  return parts.join(" · ");
}
