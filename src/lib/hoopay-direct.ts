/**
 * Integração direta temporária com API Hoopay.
 * NOTA: Solução temporária - migrar para Edge Function quando possível.
 */

const API_BASE = "https://api.pay.hoopay.com.br";
const CHARGE_ENDPOINT = "/charge";

export interface PixChargeResult {
  success: boolean;
  qr_code_base64: string | null;
  copy_paste: string | null;
  expires_at: string | null;
  error?: string;
}

function extractPixFromResponse(data: Record<string, unknown>): {
  qrCodeBase64: string | null;
  copyPaste: string | null;
  expiresAt: string | null;
} {
  const charges: unknown[] =
    (data.payment as Record<string, unknown>)?.charges ?? (data.charges as unknown[]) ?? [];
  if (!Array.isArray(charges)) return { qrCodeBase64: null, copyPaste: null, expiresAt: null };
  const pix = charges.find(
    (c: unknown) =>
      (c as Record<string, unknown>)?.type === "PIX" ||
      (c as Record<string, unknown>)?.type === "pix"
  ) as Record<string, unknown> | undefined;
  if (!pix) return { qrCodeBase64: null, copyPaste: null, expiresAt: null };
  const qr =
    (pix.pixQrCode ?? pix.pix_qr_code ?? pix.qrCodeBase64) as string | undefined;
  const cp =
    (pix.pixPayload ?? pix.pix_payload ?? pix.copyPaste) as string | undefined;
  const ex =
    (pix.expireAt ?? pix.expire_at ?? pix.expiresAt) as string | undefined;
  return {
    qrCodeBase64: typeof qr === "string" ? qr : null,
    copyPaste: typeof cp === "string" ? cp : null,
    expiresAt: typeof ex === "string" ? ex : null,
  };
}

export interface PixChargeOptions {
  isHeartPurchase?: boolean;
  heartPlanId?: number;
}

export async function createChargePix(amount: number, options?: PixChargeOptions): Promise<PixChargeResult> {
  const auth = _resolveAuth();
  // IMPORTANTE: NUNCA enviar is_heart_purchase ou heart_plan_id para API Hoopay
  // Esses campos são apenas para uso interno da Edge Function
  const body = {
    amount,
    customer: {
      email: "doador@vakinha.com",
      name: "Doador Anônimo",
      phone: "11912345678",
    },
    products: [{ title: options?.isHeartPurchase ? "Corações" : "Doação", amount, quantity: 1 }],
    payments: [{ amount, type: "pix" }],
    data: {
      ip: "0.0.0.0",
      callbackURL: "https://mufcryvjppadwvqospgd.supabase.co/functions/v1/hoopay-pix?source=hoopay-webhook",
    },
  };

  try {
    const res = await fetch(`${API_BASE}${CHARGE_ENDPOINT}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return {
        success: false,
        qr_code_base64: null,
        copy_paste: null,
        expires_at: null,
        error: "Resposta inválida da API.",
      };
    }

    if (!res.ok) {
      const errMsg =
        (parsed.message as string) ??
        (parsed.error as string) ??
        text?.slice(0, 100) ??
        "Erro ao criar cobrança.";
      return {
        success: false,
        qr_code_base64: null,
        copy_paste: null,
        expires_at: null,
        error: String(errMsg),
      };
    }

    const pix = extractPixFromResponse(parsed);
    if (!pix.qrCodeBase64 && !pix.copyPaste) {
      return {
        success: false,
        qr_code_base64: null,
        copy_paste: null,
        expires_at: null,
        error: "Resposta sem dados PIX.",
      };
    }

    return {
      success: true,
      qr_code_base64: pix.qrCodeBase64,
      copy_paste: pix.copyPaste,
      expires_at: pix.expiresAt,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro de rede.";
    return {
      success: false,
      qr_code_base64: null,
      copy_paste: null,
      expires_at: null,
      error: msg,
    };
  }
}

function _resolveAuth(): string {
  const clientId = import.meta.env.VITE_HOOPAY_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_HOOPAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("[Hoopay] VITE_HOOPAY_CLIENT_ID e VITE_HOOPAY_CLIENT_SECRET devem estar configurados");
    return "";
  }
  return typeof btoa !== "undefined" ? btoa(`${clientId}:${clientSecret}`) : "";
}
