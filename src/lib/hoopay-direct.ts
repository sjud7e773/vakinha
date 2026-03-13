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
  console.log("[createChargePix] Chamando API local /api/create-pix", { amount });

  try {
    const res = await fetch("/api/create-pix", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount }),
    });

    console.log("[createChargePix] Resposta API local status:", res.status);

    const data = await res.json();
    console.log("[createChargePix] Resposta API local:", data);

    if (!res.ok) {
      return {
        success: false,
        qr_code_base64: null,
        copy_paste: null,
        expires_at: null,
        error: data.details || data.error || "Erro ao criar PIX",
      };
    }

    // Extrair dados PIX da resposta Hoopay
    const pix = extractPixFromResponse(data);
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
    console.error("[createChargePix] Erro:", e);
    return {
      success: false,
      qr_code_base64: null,
      copy_paste: null,
      expires_at: null,
      error: msg,
    };
  }
}
