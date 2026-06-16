import { redirect } from "next/navigation";

export default function LegacyResetPasswordPage() {
  redirect("/?reset=1");
}
