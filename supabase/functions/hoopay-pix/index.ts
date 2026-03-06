import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-fingerprint",
};

const HOOPAY_API = "https://api.pay.hoopay.com.br";
const HOOPAY_FETCH_TIMEOUT_MS = 25_000;
const HOOPAY_RETRY_ATTEMPTS = 2;

const BOT_UA_PATTERNS = [
  "facebookexternalhit", "facebot", "googlebot", "bingbot", "crawler", "spider",
  "scraper", "slurp", "duckduckbot", "headless", "phantom", "selenium",
  "puppeteer", "playwright", "curl", "wget", "python-requests", "go-http-client",
  "java/", "bot",
];

type RateLimitWindow = { count: number; resetAt: number; lastRequestAt?: number };
type RateLimitState = { short: RateLimitWindow; long: RateLimitWindow };

const SHORT_WINDOW_MS = 60_000;
const LONG_WINDOW_MS = 10 * 60_000;
const SHORT_WINDOW_MAX = 3;
const LONG_WINDOW_MAX = 5;
const BURST_WINDOW_MS = 5_000;
const BURST_MAX = 2;
const POW_DIFFICULTY = 2;
const POW_NONCE_TTL_MS = 120_000;
const PAGE_TOKEN_TTL_MS = 5 * 60_000;

const rateLimitStore = new Map<string, RateLimitState>();
const usedNonces = new Map<string, number>();
const pageTokens = new Map<string, number>();

function isNonceUsed(nonce: string): boolean {
  const now = Date.now();
  for (const [n, t] of usedNonces) {
    if (t < now - POW_NONCE_TTL_MS) usedNonces.delete(n);
  }
  return usedNonces.has(nonce);
}

function markNonceUsed(nonce: string): void {
  usedNonces.set(nonce, Date.now());
}

function consumePageToken(token: string): boolean {
  const expiresAt = pageTokens.get(token);
  pageTokens.delete(token);
  const now = Date.now();
  for (const [t, exp] of pageTokens) {
    if (exp < now) pageTokens.delete(t);
  }
  return typeof expiresAt === "number" && expiresAt > now;
}

function evaluateRateLimit(id: string): { limited: boolean; reason?: string } {
  const now = Date.now();
  const existing = rateLimitStore.get(id);
  const shortResetAt = now + SHORT_WINDOW_MS;
  const longResetAt = now + LONG_WINDOW_MS;
  const state: RateLimitState = existing
    ? {
        short: existing.short.resetAt <= now ? { count: 0, resetAt: shortResetAt } : { ...existing.short },
        long: existing.long.resetAt <= now ? { count: 0, resetAt: longResetAt } : { ...existing.long },
      }
    : { short: { count: 0, resetAt: shortResetAt }, long: { count: 0, resetAt: longResetAt } };
  const burst = existing && (now - (existing.short.lastRequestAt ?? 0)) < BURST_WINDOW_MS;
  const nextShort = state.short.count + 1;
  const nextLong = state.long.count + 1;
  if (burst && nextShort > BURST_MAX) return { limited: true, reason: "burst" };
  if (nextShort > SHORT_WINDOW_MAX) return { limited: true, reason: "short" };
  if (nextLong > LONG_WINDOW_MAX) return { limited: true, reason: "long" };
  state.short.count = nextShort;
  state.short.lastRequestAt = now;
  state.long.count = nextLong;
  state.long.lastRequestAt = now;
  rateLimitStore.set(id, state);
  return { limited: false };
}

function isBotOrCrawlerRequest(req: Request): boolean {
  const ua = (req.headers.get("user-agent") ?? "").toLowerCase();
  return BOT_UA_PATTERNS.some((p) => ua.includes(p));
}

function randomNonce(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomPageToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyProofOfWork(nonce: string, solution: string, diff: number): Promise<boolean> {
  if (!nonce || !solution || diff < 0) return false;
  const msg = `${nonce}:${solution}`;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(msg));
  const hex = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex.startsWith("0".repeat(diff));
}

function jsonResponse(data: object, status: number, headers?: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...headers },
  });
}

function isWebhookRequest(req: Request): boolean {
  try {
    return new URL(req.url).searchParams.get("source") === "hoopay-webhook";
  } catch {
    return false;
  }
}

function extractPixFromHoopayResponse(data: Record<string, unknown>): {
  qrCodeBase64: string | null;
  copyPaste: string | null;
  expiresAt: string | null;
} {
  const charges: unknown[] = (data.payment as Record<string, unknown>)?.charges ?? (data.charges as unknown[]) ?? [];
  if (!Array.isArray(charges)) return { qrCodeBase64: null, copyPaste: null, expiresAt: null };
  const pix = charges.find(
    (c: unknown) => (c as Record<string, unknown>)?.type === "PIX" || (c as Record<string, unknown>)?.type === "pix"
  ) as Record<string, unknown> | undefined;
  if (!pix) return { qrCodeBase64: null, copyPaste: null, expiresAt: null };
  const qr = (pix.pixQrCode ?? pix.pix_qr_code ?? pix.qrCodeBase64) as string | undefined;
  const cp = (pix.pixPayload ?? pix.pix_payload ?? pix.copyPaste) as string | undefined;
  const ex = (pix.expireAt ?? pix.expire_at ?? pix.expiresAt) as string | undefined;
  return {
    qrCodeBase64: typeof qr === "string" ? qr : null,
    copyPaste: typeof cp === "string" ? cp : null,
    expiresAt: typeof ex === "string" ? ex : null,
  };
}

async function hoopayCharge(
  basicAuth: string,
  chargeBody: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data?: Record<string, unknown>; rawText?: string }> {
  let lastErr: Error | null = null;
  let lastStatus = 0;
  let lastText = "";
  for (let attempt = 1; attempt <= HOOPAY_RETRY_ATTEMPTS; attempt++) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), HOOPAY_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${HOOPAY_API}/charge`, {
        method: "POST",
        headers: { Authorization: `Basic ${basicAuth}`, "Content-Type": "application/json" },
        body: JSON.stringify(chargeBody),
        signal: ctrl.signal,
      });
      clearTimeout(tid);
      const text = await res.text();
      if (!res.ok) {
        lastStatus = res.status;
        lastText = text;
        if (attempt < HOOPAY_RETRY_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 800 * attempt));
          continue;
        }
        return { ok: false, status: res.status, rawText: text };
      }
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(text) as Record<string, unknown>;
      } catch {
        console.error("[hoopay-pix] Invalid JSON:", text?.slice(0, 200));
        return { ok: false, status: res.status, rawText: text };
      }
      return { ok: true, status: res.status, data: parsed };
    } catch (e) {
      clearTimeout(tid);
      lastErr = e instanceof Error ? e : new Error(String(e));
      console.error(`[hoopay-pix] Attempt ${attempt}/${HOOPAY_RETRY_ATTEMPTS} failed:`, lastErr.message);
      if (attempt < HOOPAY_RETRY_ATTEMPTS) await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
  return { ok: false, status: lastStatus || 502, rawText: lastText || (lastErr?.message ?? "Unknown") };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const isWebhook = isWebhookRequest(req);
  const authHeader = req.headers.get("Authorization") ?? "";
  const hasBearer = authHeader.startsWith("Bearer ");

  if (isWebhook) {
    try {
      let body: Record<string, unknown> = {};
      try {
        const t = await req.text();
        if (t) body = (JSON.parse(t) as Record<string, unknown>) ?? {};
      } catch {
        console.warn("[hoopay-pix] Webhook body parse failed");
      }
      const status = (body.status as string) ?? (body.payment as Record<string, unknown>)?.status;
      const payment = body.payment as Record<string, unknown> | undefined;
      const amt = Number(body.amount ?? payment?.amount ?? 0);
      const isPaid = ["PAID", "paid", "CONFIRMED", "confirmed"].includes(String(status));
      if (isPaid && amt > 0) {
        const supUrl = Deno.env.get("SUPABASE_URL");
        const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (supUrl && svcKey) {
          const r = await fetch(`${supUrl}/rest/v1/rpc/increment_donation_total`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: svcKey, Authorization: `Bearer ${svcKey}` },
            body: JSON.stringify({ amount_reais: amt }),
          });
          if (!r.ok) console.warn("[hoopay-pix] Webhook increment failed", await r.text());
        }
      }
      return jsonResponse({ received: true }, 200);
    } catch (e) {
      console.error("[hoopay-pix] Webhook error:", e);
      return jsonResponse({ received: false }, 500);
    }
  }

  if (!hasBearer) {
    console.warn("[hoopay-pix] Missing Authorization Bearer");
    return jsonResponse(
      { error: "Não autorizado. Verifique se as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY estão configuradas na Vercel. Atualize a página e tente novamente." },
      401
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Corpo da requisição inválido." }, 400);
  }

  if (body.action === "challenge") {
    return jsonResponse({ nonce: randomNonce(), difficulty: POW_DIFFICULTY }, 200);
  }

  if (body.action === "page_token") {
    const token = randomPageToken();
    pageTokens.set(token, Date.now() + PAGE_TOKEN_TTL_MS);
    return jsonResponse({ token, expires_at: Date.now() + PAGE_TOKEN_TTL_MS }, 200);
  }

  const ipHeader = req.headers.get("x-forwarded-for") ?? "";
  const clientIp = ipHeader.split(",")[0].trim() || "unknown";
  const fp = (body.fingerprint as string) ?? req.headers.get("x-fingerprint") ?? "na";
  const rlKey = `pix:${clientIp}:${fp}`;

  const honeypot = (body.website as string) ?? "";
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return jsonResponse({ success: true, qr_code_base64: null, copy_paste: null, expires_at: null }, 200);
  }

  if (isBotOrCrawlerRequest(req)) return jsonResponse({ success: false }, 200);

  const pageToken = (body.page_token as string) ?? "";
  if (!pageToken || !consumePageToken(pageToken)) {
    return jsonResponse({ error: "Sessão expirada. Atualize a página e tente novamente." }, 400);
  }

  const rl = evaluateRateLimit(rlKey);
  if (rl.limited) {
    return jsonResponse({ error: "Limite de geração de PIX atingido. Aguarde alguns minutos." }, 429);
  }

  const powNonce = body.pow_nonce as string | undefined;
  const powSol = body.pow_solution as string | undefined;
  if (!powNonce || !powSol) {
    return jsonResponse({ error: "Desafio de segurança inválido. Atualize a página e tente novamente." }, 400);
  }
  if (isNonceUsed(powNonce)) {
    return jsonResponse({ error: "Desafio já utilizado. Atualize a página e tente novamente." }, 400);
  }
  if (!(await verifyProofOfWork(powNonce, powSol, POW_DIFFICULTY))) {
    return jsonResponse({ error: "Desafio de segurança inválido. Atualize a página e tente novamente." }, 400);
  }
  markNonceUsed(powNonce);

  const clientId = Deno.env.get("HOOPAY_CLIENT_ID");
  const clientSecret = Deno.env.get("HOOPAY_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    console.error("[hoopay-pix] HOOPAY_CLIENT_ID or HOOPAY_CLIENT_SECRET not set");
    return jsonResponse({ error: "Erro ao configurar o meio de pagamento." }, 500);
  }

  const amount = body.amount as number | undefined;
  if (amount == null || typeof amount !== "number" || Number.isNaN(amount)) {
    return jsonResponse({ error: "Valor da doação inválido." }, 400);
  }
  if (amount < 1) return jsonResponse({ error: "Valor mínimo é R$ 1,00" }, 400);
  if (amount > 100000) return jsonResponse({ error: "Valor máximo de doação excedido." }, 400);

  const basicAuth = btoa(`${clientId}:${clientSecret}`);
  const donor_name = (body.donor_name as string) ?? "Doador Anônimo";
  const donor_email = (body.donor_email as string) ?? "doador@vakinha.com";
  const donor_phone = (body.donor_phone as string) ?? "11912345678";
  const donor_doc = body.donor_document as string | undefined;

  const customer: Record<string, string> = { email: donor_email, name: donor_name, phone: donor_phone };
  if (donor_doc) customer.document = donor_doc;

  const chargeBody = {
    amount,
    customer,
    products: [{ title: "Doação", amount, quantity: 1 }],
    payments: [{ amount, type: "pix" }],
    data: {
      ip: clientIp,
      callbackURL: "https://kedpzpmswblzefavjunt.supabase.co/functions/v1/hoopay-pix?source=hoopay-webhook",
    },
  };

  const result = await hoopayCharge(basicAuth, chargeBody);

  if (!result.ok) {
    console.error("[hoopay-pix] Hoopay API error", { status: result.status, sample: String(result.rawText).slice(0, 150) });
    return jsonResponse({ error: "Falha ao criar cobrança PIX. Tente novamente em instantes." }, 502);
  }

  const data = result.data as Record<string, unknown>;
  const pix = extractPixFromHoopayResponse(data);
  if (!pix.qrCodeBase64 && !pix.copyPaste) {
    console.error("[hoopay-pix] Hoopay response missing PIX data", { keys: data ? Object.keys(data) : [] });
    return jsonResponse({ error: "Resposta do gateway sem dados PIX. Tente novamente." }, 502);
  }

  return jsonResponse({
    success: true,
    qr_code_base64: pix.qrCodeBase64,
    copy_paste: pix.copyPaste,
    expires_at: pix.expiresAt,
    order_uuid: (data.orderUUID ?? data.order_uuid) ?? null,
    status: (data.payment as Record<string, unknown>)?.status ?? null,
  }, 200);
});
