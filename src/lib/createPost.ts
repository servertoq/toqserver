import type { SupabaseClient } from "@supabase/supabase-js";
import { createPostWithMedia, type CreatePostInput } from "@/lib/posts";
import type { PostType, PostVisibility } from "@/types/feed";

export type CreatePostSubmitData = {
  body: string;
  postType: PostType;
  title: string | null;
  visibility: PostVisibility;
  eventDate: string | null;
  eventTime: string | null;
  files: File[];
  pollOptions?: string[];
  pollAllowMultiple?: boolean;
  pollShowResultsToAll?: boolean;
};

export type EditPostSubmitData = CreatePostSubmitData & {
  removedImageUrls?: string[];
};

export function toCreatePostInput(
  authorId: string,
  communityId: string | null,
  data: CreatePostSubmitData
): CreatePostInput {
  return {
    authorId,
    body: data.body,
    postType: data.postType,
    title: data.title,
    visibility: data.visibility,
    communityId,
    eventDate: data.eventDate,
    eventTime: data.eventTime,
    files: data.files,
    pollOptions: data.pollOptions,
    pollAllowMultiple: data.pollAllowMultiple,
    pollShowResultsToAll: data.pollShowResultsToAll,
  };
}

export function toUpdatePostInput(
  postId: string,
  authorId: string,
  data: EditPostSubmitData
) {
  return {
    postId,
    authorId,
    body: data.body,
    postType: data.postType,
    title: data.title,
    visibility: data.visibility,
    eventDate: data.eventDate,
    eventTime: data.eventTime,
    files: data.files,
    removedImageUrls: data.removedImageUrls ?? [],
    pollAllowMultiple: data.pollAllowMultiple,
    pollShowResultsToAll: data.pollShowResultsToAll,
  };
}

export async function submitCreatePost(
  supabase: SupabaseClient,
  input: CreatePostInput
) {
  return createPostWithMedia(supabase, input);
}
