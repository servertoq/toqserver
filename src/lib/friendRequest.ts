/** Mensagem amigável para erros ao enviar pedido de amizade. */
export function formatFriendRequestError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("create_notification") && lower.includes("not unique")) {
    return "O banco de dados precisa de uma atualização. Aplique a migration 027 no Supabase e tente novamente.";
  }
  if (lower.includes("já são amigos")) {
    return "Vocês já são amigos.";
  }
  if (lower.includes("não autenticado")) {
    return "Faça login novamente para enviar o pedido.";
  }
  return message || "Não foi possível enviar o pedido de amizade.";
}
