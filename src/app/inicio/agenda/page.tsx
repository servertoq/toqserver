import { redirect } from "next/navigation";

export default function AgendaRoutePage() {
  redirect("/inicio/perfil?tab=agenda");
}
