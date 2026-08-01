import { MercadoPagoConfig, Preference, PreApproval, Payment } from "mercadopago";
import type { PlanChargeKind, PlanPaymentMode } from "@/lib/billing/plans";
import type { UserPlan } from "@/types/plans";

export function isMercadoPagoConfigured() {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
}

export function getMercadoPagoClient() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurada.");
  }
  return new MercadoPagoConfig({ accessToken, options: { timeout: 15000 } });
}

/** Preferência de checkout em modo teste (credenciais de teste no painel). */
export function isMercadoPagoTestMode() {
  const flag = process.env.MERCADOPAGO_TEST?.trim().toLowerCase();
  if (flag === "1" || flag === "true" || flag === "yes") return true;
  if (flag === "0" || flag === "false" || flag === "no") return false;
  // Public Key de teste antiga começava com TEST-
  const pk = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? "";
  return pk.startsWith("TEST-");
}

export function unitPriceFromCents(cents: number) {
  return Math.round(cents) / 100;
}

type PreferenceInput = {
  changeId: string;
  userId: string;
  email: string;
  title: string;
  description: string;
  amountCents: number;
  fromPlan: UserPlan;
  toPlan: UserPlan;
  chargeKind: PlanChargeKind;
  paymentMode: PlanPaymentMode;
  successUrl: string;
  cancelUrl: string;
  notificationUrl: string;
};

/** Checkout Pro: Pix + cartão (pagamento único do ciclo). */
export async function createCheckoutPreference(input: PreferenceInput) {
  const client = getMercadoPagoClient();
  const preference = new Preference(client);

  const testMode = isMercadoPagoTestMode();
  // Em teste, não amarra o e-mail real do Toq — o MP exige comprador de teste logado.
  const testBuyerEmail = process.env.MERCADOPAGO_TEST_BUYER_EMAIL?.trim();

  const result = await preference.create({
    body: {
      items: [
        {
          id: input.changeId,
          title: input.title,
          description: input.description,
          quantity: 1,
          unit_price: unitPriceFromCents(input.amountCents),
          currency_id: "BRL",
        },
      ],
      ...(testMode
        ? testBuyerEmail
          ? { payer: { email: testBuyerEmail } }
          : {}
        : { payer: { email: input.email } }),
      external_reference: input.changeId,
      metadata: {
        change_id: input.changeId,
        user_id: input.userId,
        from_plan: input.fromPlan,
        to_plan: input.toPlan,
        charge_kind: input.chargeKind,
        payment_mode: input.paymentMode,
      },
      back_urls: {
        success: input.successUrl,
        failure: input.cancelUrl,
        pending: input.successUrl,
      },
      auto_return: "approved",
      notification_url: input.notificationUrl,
      statement_descriptor: "TOQ TENNIS",
      // Preferência Pix quando pedido; cartão também disponível no Checkout Pro
      ...(input.paymentMode === "pix"
        ? {
            payment_methods: {
              excluded_payment_types: [{ id: "credit_card" }, { id: "debit_card" }, { id: "ticket" }],
              installments: 1,
            },
          }
        : {}),
    },
  });

  const initPoint = result.init_point ?? result.sandbox_init_point;
  if (!initPoint || !result.id) {
    throw new Error("Mercado Pago não retornou URL de checkout.");
  }

  return { id: String(result.id), initPoint };
}

type PreapprovalInput = {
  changeId: string;
  userId: string;
  email: string;
  reason: string;
  amountCents: number;
  fromPlan: UserPlan;
  toPlan: UserPlan;
  chargeKind: PlanChargeKind;
  backUrl: string;
};

/** Assinatura recorrente no cartão (cobrança mensal). */
export async function createCardPreapproval(input: PreapprovalInput) {
  const client = getMercadoPagoClient();
  const preapproval = new PreApproval(client);

  const result = await preapproval.create({
    body: {
      reason: input.reason,
      external_reference: input.changeId,
      payer_email: input.email,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: unitPriceFromCents(input.amountCents),
        currency_id: "BRL",
      },
      back_url: input.backUrl,
      status: "pending",
    },
  });

  const initPoint = result.init_point;
  if (!initPoint || !result.id) {
    throw new Error("Mercado Pago não retornou URL de assinatura.");
  }

  return { id: String(result.id), initPoint };
}

export async function fetchMercadoPagoPayment(paymentId: string) {
  const client = getMercadoPagoClient();
  const payment = new Payment(client);
  return payment.get({ id: paymentId });
}

export async function fetchMercadoPagoPreapproval(preapprovalId: string) {
  const client = getMercadoPagoClient();
  const preapproval = new PreApproval(client);
  return preapproval.get({ id: preapprovalId });
}
