"use client";

import { appContentClass } from "@/lib/layout";
import { PageHeader } from "@/components/shared/PageHeader";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { ProfileUrlForm } from "./ProfileUrlForm";
import { ThemeSettings } from "./ThemeSettings";

export function SettingsPage() {
  return (
    <>
      <main className={`${appContentClass} py-6`}>
        <PageHeader
          kicker=""
          title="Configurações"
          subtitle="Personalize sua experiência e gerencie a segurança da conta."
        />

        <div className="space-y-6">
          <section className="settings-card">
            <h2 className="settings-card-title">Aparência</h2>
            <p className="settings-card-desc">
              Escolha como o Toq Tennis deve aparecer no celular e no computador.
            </p>
            <ThemeSettings />
          </section>

          <section className="settings-card">
            <h2 className="settings-card-title">Perfil público</h2>
            <p className="settings-card-desc">
              Defina a URL do seu perfil. O nome que aparece na rede é configurado em Perfil → Editar.
            </p>
            <ProfileUrlForm />
          </section>

          <section className="settings-card">
            <h2 className="settings-card-title">Senha</h2>
            <p className="settings-card-desc">
              Altere a senha usada para entrar com e-mail e senha.
            </p>
            <ChangePasswordForm />
          </section>
        </div>
      </main>
    </>
  );
}
