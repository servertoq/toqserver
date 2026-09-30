"use client";

import { appContentClass } from "@/lib/layout";
import { PageHeader } from "@/components/shared/PageHeader";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { DeleteAccountSection } from "./DeleteAccountSection";
import { ProfilePrivacySettings } from "./ProfilePrivacySettings";
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
            <h2 className="settings-card-title">Privacidade do perfil</h2>
            <p className="settings-card-desc">
              Controle o que outras pessoas veem antes de virarem suas amigas no Toq.
            </p>
            <ProfilePrivacySettings />
          </section>

          <section className="settings-card">
            <h2 className="settings-card-title">Senha</h2>
            <p className="settings-card-desc">
              Altere a senha usada para entrar com e-mail e senha.
            </p>
            <ChangePasswordForm />
          </section>

          <section className="settings-card border-red-100">
            <h2 className="settings-card-title text-red-700">Excluir conta</h2>
            <p className="settings-card-desc">
              Remova permanentemente seu perfil e dados após o período de carência.
            </p>
            <DeleteAccountSection />
          </section>
        </div>
      </main>
    </>
  );
}
