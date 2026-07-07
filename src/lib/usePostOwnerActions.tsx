"use client";

import { useCallback, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EditPostModal } from "@/components/feed/EditPostModal";
import { toUpdatePostInput, type EditPostSubmitData } from "@/lib/createPost";
import { deletePost, updatePostWithMedia } from "@/lib/posts";
import type { PostContext } from "@/lib/postVisibility";
import { createClient } from "@/lib/supabase/client";
import type { FeedPost } from "@/types/feed";
import { useSingleSubmit } from "@/lib/useSingleSubmit";

type Options = {
  authorId: string;
  context?: PostContext;
  onRefresh: () => Promise<void>;
  onRemove?: (postId: string) => void;
  onError?: (message: string) => void;
  avatarUrl: string | null;
  username: string;
  displayName?: string | null;
};

export function usePostOwnerActions({
  authorId,
  context = "global",
  onRefresh,
  onRemove,
  onError,
  avatarUrl,
  username,
  displayName,
}: Options) {
  const supabase = createClient();
  const [editingPost, setEditingPost] = useState<FeedPost | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeedPost | null>(null);
  const { isSubmitting: saving, guard: guardSave } = useSingleSubmit();
  const { isSubmitting: deleting, guard: guardDelete } = useSingleSubmit();

  const handleEdit = useCallback((post: FeedPost) => {
    setEditingPost(post);
  }, []);

  const handleDeleteRequest = useCallback((post: FeedPost) => {
    setDeleteTarget(post);
  }, []);

  async function handleEditSubmit(data: EditPostSubmitData) {
    if (!editingPost || saving) return;

    await guardSave(async () => {
      const { error } = await updatePostWithMedia(
        supabase,
        toUpdatePostInput(editingPost.id, authorId, data)
      );

      if (error) {
        onError?.(error);
        return;
      }

      setEditingPost(null);
      await onRefresh();
    });
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget || deleting) return;

    await guardDelete(async () => {
      const { error } = await deletePost(supabase, deleteTarget.id, authorId);

      if (error) {
        onError?.(error);
        return;
      }

      onRemove?.(deleteTarget.id);
      setDeleteTarget(null);
      await onRefresh();
    });
  }

  const ownerMenuProps = {
    onEditPost: handleEdit,
    onDeletePost: handleDeleteRequest,
  };

  const ownerActionUi = (
    <>
      <EditPostModal
        open={!!editingPost}
        post={editingPost}
        avatarUrl={avatarUrl}
        username={username}
        displayName={displayName}
        loading={saving}
        context={context}
        onClose={() => !saving && setEditingPost(null)}
        onSubmit={handleEditSubmit}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir publicação?"
        message="Esta ação não pode ser desfeita. Comentários, curtidas e votos também serão removidos."
        confirmLabel="Excluir"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </>
  );

  return { ownerMenuProps, ownerActionUi };
}
