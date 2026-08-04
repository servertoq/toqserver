import type { SupabaseClient } from "@supabase/supabase-js";
import { insertPostMentions, resolveMentionUserIds, syncPostMentions } from "@/lib/mentions";
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
  pollOptions?: string[];
  pollAllowMultiple?: boolean;
  pollShowResultsToAll?: boolean;
  matchCapacity?: number | null;
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
  author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url, plan, show_plan_badge),
  images:post_images(url, sort_order, media_type),
  communities(name, slug, accent_color, created_by),
  mentions:post_mentions(
    mentioned_user:profiles!post_mentions_mentioned_user_id_fkey(id, username, display_name, avatar_url)
  ),
  poll:post_polls(allow_multiple, show_results_to_all),
  poll_options:post_poll_options(id, label, sort_order),
  match:post_matches(capacity)
`;

export { POST_SELECT };

export async function createPostWithMedia(
  supabase: SupabaseClient,
  input: CreatePostInput
): Promise<{ postId: string | null; error: string | null }> {
  const mentionIds = await resolveMentionUserIds(supabase, input.body, input.authorId);

  const usesSchedule = input.postType === "event" || input.postType === "partida";
  const visibility =
    input.postType === "partida" ? ("private" as const) : input.visibility;

  const { data: newPost, error: insertErr } = await supabase
    .from("posts")
    .insert({
      author_id: input.authorId,
      body: input.body,
      post_type: input.postType,
      title: input.postType === "event" ? input.title : null,
      visibility,
      community_id: input.communityId,
      event_date: usesSchedule && input.eventDate ? input.eventDate : null,
      event_time:
        usesSchedule && input.eventTime
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

  if (input.postType === "partida") {
    const capacity = Math.round(Number(input.matchCapacity));
    if (!Number.isFinite(capacity) || capacity < 1 || capacity > 64) {
      return { postId: null, error: "Informe quantas pessoas quer na partida (1 a 64)." };
    }
    if (!input.eventDate || !input.eventTime) {
      return { postId: null, error: "Informe data e horário da partida." };
    }
    const { error: matchErr } = await supabase.from("post_matches").insert({
      post_id: newPost.id,
      capacity,
    });
    if (matchErr) {
      return { postId: null, error: matchErr.message ?? "Não foi possível salvar a partida." };
    }
  }

  if (input.postType === "poll") {
    const options = (input.pollOptions ?? [])
      .map((label) => label.trim())
      .filter(Boolean);

    if (options.length < 2) {
      return { postId: null, error: "Informe pelo menos 2 opções na enquete." };
    }

    const { error: pollErr } = await supabase.from("post_polls").insert({
      post_id: newPost.id,
      allow_multiple: input.pollAllowMultiple ?? false,
      show_results_to_all: input.pollShowResultsToAll ?? true,
    });

    if (pollErr) {
      return { postId: null, error: pollErr.message ?? "Não foi possível criar a enquete." };
    }

    const { error: optionsErr } = await supabase.from("post_poll_options").insert(
      options.map((label, index) => ({
        post_id: newPost.id,
        label,
        sort_order: index,
      }))
    );

    if (optionsErr) {
      return { postId: null, error: optionsErr.message ?? "Não foi possível salvar as opções." };
    }
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

export type UpdatePostInput = {
  postId: string;
  authorId: string;
  body: string;
  postType: PostType;
  title: string | null;
  visibility: PostVisibility;
  eventDate: string | null;
  eventTime: string | null;
  files: File[];
  removedImageUrls: string[];
  pollAllowMultiple?: boolean;
  pollShowResultsToAll?: boolean;
  matchCapacity?: number | null;
};

export async function updatePostWithMedia(
  supabase: SupabaseClient,
  input: UpdatePostInput
): Promise<{ error: string | null }> {
  const mentionIds = await resolveMentionUserIds(supabase, input.body, input.authorId);
  const usesSchedule = input.postType === "event" || input.postType === "partida";
  const visibility =
    input.postType === "partida" ? ("private" as const) : input.visibility;

  const { error: updateErr } = await supabase
    .from("posts")
    .update({
      body: input.body,
      title: input.postType === "event" ? input.title : null,
      visibility,
      event_date: usesSchedule && input.eventDate ? input.eventDate : null,
      event_time:
        usesSchedule && input.eventTime
          ? input.eventTime.length === 5
            ? `${input.eventTime}:00`
            : input.eventTime
          : null,
    })
    .eq("id", input.postId)
    .eq("author_id", input.authorId);

  if (updateErr) {
    return { error: updateErr.message ?? "Não foi possível salvar as alterações." };
  }

  if (input.postType === "partida") {
    const capacity = Math.round(Number(input.matchCapacity));
    if (!Number.isFinite(capacity) || capacity < 1 || capacity > 64) {
      return { error: "Informe quantas pessoas quer na partida (1 a 64)." };
    }
    if (!input.eventDate || !input.eventTime) {
      return { error: "Informe data e horário da partida." };
    }
    const { error: matchErr } = await supabase
      .from("post_matches")
      .upsert({ post_id: input.postId, capacity }, { onConflict: "post_id" });
    if (matchErr) {
      return { error: matchErr.message ?? "Não foi possível atualizar a partida." };
    }
  }

  if (input.postType === "poll") {
    const { error: pollErr } = await supabase
      .from("post_polls")
      .update({
        allow_multiple: input.pollAllowMultiple ?? false,
        show_results_to_all: input.pollShowResultsToAll ?? true,
      })
      .eq("post_id", input.postId);

    if (pollErr) {
      return { error: pollErr.message ?? "Não foi possível atualizar a enquete." };
    }
  }

  await syncPostMentions(supabase, input.postId, mentionIds);

  for (const url of input.removedImageUrls) {
    await supabase.from("post_images").delete().eq("post_id", input.postId).eq("url", url);
  }

  if (input.postType !== "poll" && input.files.length > 0) {
    const { data: existingImages } = await supabase
      .from("post_images")
      .select("sort_order")
      .eq("post_id", input.postId)
      .order("sort_order", { ascending: false })
      .limit(1);

    let nextSort = (existingImages?.[0]?.sort_order ?? -1) + 1;

    for (let i = 0; i < input.files.length; i++) {
      const file = input.files[i];
      const ext = extensionForMediaFile(file);
      const path = `${input.authorId}/${input.postId}/${Date.now()}-${i}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("post-images")
        .upload(path, file, { upsert: false, contentType: file.type });

      if (uploadErr) continue;

      const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(path);
      await supabase.from("post_images").insert({
        post_id: input.postId,
        url: urlData.publicUrl,
        sort_order: nextSort,
        media_type: mediaKindFromFile(file),
      });
      nextSort += 1;
    }
  }

  return { error: null };
}

export async function deletePost(
  supabase: SupabaseClient,
  postId: string,
  authorId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("author_id", authorId);

  return { error: error?.message ?? null };
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
