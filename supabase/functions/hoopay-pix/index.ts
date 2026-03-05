import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-fingerprint",
};

const HOOPAY_API = "https://api.pay.hoopay.com.br";

/** User-Agent de bots/crawlers. NÃO bloqueamos por Referer para não afetar quem clicou no anúncio (UA normal). */
const BOT_UA_PATTERNS = [
  "facebookexternalhit",
  "facebot",
  "googlebot",
  "bingbot",
  "crawler",
  "spider",
  "scraper",
  "slurp",
  "duckduckbot",
  "headless",
  "phantom",
  "selenium",
  "puppeteer",
  "playwright",
  "curl",
  "wget",
  "python-requests",
  "go-http-client",
  "java/",
  "bot",
];

type RateLimitWindow = {
  count: number;
  resetAt: number;
  lastRequestAt?: number;
};

type RateLimitState = {
  short: RateLimitWindow;
  long: RateLimitWindow;
};

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

function evaluateRateLimit(identifier: string): { limited: boolean; reason?: string } {
  const now = Date.now();
  const existing = rateLimitStore.get(identifier);

  const shortResetAt = now + SHORT_WINDOW_MS;
  const longResetAt = now + LONG_WINDOW_MS;

  const state: RateLimitState = existing
    ? {
        short:
          existing.short.resetAt <= now
            ? { count: 0, resetAt: shortResetAt }
            : { ...existing.short, lastRequestAt: existing.short.lastRequestAt },
        long:
          existing.long.resetAt <= now
            ? { count: 0, resetAt: longResetAt }
            : { ...existing.long, lastRequestAt: existing.long.lastRequestAt },
      }
    : {
        short: { count: 0, resetAt: shortResetAt },
        long: { count: 0, resetAt: longResetAt },
      };

  const lastShort = state.short.lastRequestAt ?? 0;
  const burst = now - lastShort < BURST_WINDOW_MS;
  const nextShort = state.short.count + 1;
  const nextLong = state.long.count + 1;

  if (burst && nextShort > BURST_MAX) {
    return { limited: true, reason: "burst" };
  }

  if (nextShort > SHORT_WINDOW_MAX) {
    return { limited: true, reason: "short" };
  }

  if (nextLong > LONG_WINDOW_MAX) {
    return { limited: true, reason: "long" };
  }

  state.short.count = nextShort;
  state.short.lastRequestAt = now;
  state.long.count = nextLong;
  state.long.lastRequestAt = now;

  rateLimitStore.set(identifier, state);

  return { limited: false };
}

/** Apenas User-Agent. Referer NÃO é usado para não bloquear usuários legítimos do Facebook Ads. */
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

/** Valida solução PoW: SHA256(nonce + ":" + solution) deve começar com `difficulty` zeros. */
async function verifyProofOfWork(
  nonce: string,
  solution: string,
  difficulty: number
): Promise<boolean> {
  if (!nonce || !solution || difficulty < 0) return false;
  const message = `${nonce}:${solution}`;
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const prefix = "0".repeat(difficulty);
  return hex.startsWith(prefix);
}

function jsonResponse(data: object, status: number, headers?: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...headers },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const isClientInvocation = authHeader.startsWith("Bearer ");

    if (!isClientInvocation) {
      return jsonResponse({ success: true, received: true }, 200);
    }

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: "Corpo da requisição inválido." }, 400);
    }

    if (body.action === "challenge") {
      return jsonResponse(
        {
          nonce: randomNonce(),
          difficulty: POW_DIFFICULTY,
        },
        200
      );
    }

    /** Token efêmero para vincular sessão e dificultar uso da API fora da página. */
    if (body.action === "page_token") {
      const token = randomPageToken();
      pageTokens.set(token, Date.now() + PAGE_TOKEN_TTL_MS);
      return jsonResponse(
        { token, expires_at: Date.now() + PAGE_TOKEN_TTL_MS },
        200
      );
    }

    // --- Geração de PIX: validações de segurança ---
    const ipHeader = req.headers.get("x-forwarded-for") ?? "";
    const clientIp = ipHeader.split(",")[0].trim() || "unknown";
    const fingerprint =
      (body.fingerprint as string) || req.headers.get("x-fingerprint") || "na";
    const rateLimitKey = `pix:${clientIp}:${fingerprint}`;

    // Honeypot: campo invisível preenchido = bot → bloqueio silencioso (retorna success sem PIX real)
    const honeypot = (body.website as string) ?? "";
    if (typeof honeypot === "string" && honeypot.trim() !== "") {
      return jsonResponse(
        {
          success: true,
          qr_code_base64: null,
          copy_paste: null,
          expires_at: null,
        },
        200
      );
    }

    if (isBotOrCrawlerRequest(req)) {
      return jsonResponse({ success: false }, 200);
    }

    const pageToken = (body.page_token as string) ?? "";
    if (!pageToken || !consumePageToken(pageToken)) {
      return jsonResponse(
        { error: "Sessão expirada. Atualize a página e tente novamente." },
        400
      );
    }

    const rateLimitResult = evaluateRateLimit(rateLimitKey);
    if (rateLimitResult.limited) {
      return jsonResponse(
        {
          error:
            "Limite de geração de PIX atingido. Aguarde alguns minutos antes de tentar novamente.",
        },
        429
      );
    }

    // Validação Proof-of-Work (nonce de uso único para evitar replay)
    const powNonce = body.pow_nonce as string | undefined;
    const powSolution = body.pow_solution as string | undefined;
    if (!powNonce || !powSolution) {
      return jsonResponse(
        { error: "Desafio de segurança inválido. Atualize a página e tente novamente." },
        400
      );
    }
    if (isNonceUsed(powNonce)) {
      return jsonResponse(
        { error: "Desafio já utilizado. Atualize a página e tente novamente." },
        400
      );
    }
    if (!(await verifyProofOfWork(powNonce, powSolution, POW_DIFFICULTY))) {
      return jsonResponse(
        { error: "Desafio de segurança inválido. Atualize a página e tente novamente." },
        400
      );
    }
    markNonceUsed(powNonce);

    const clientId = Deno.env.get("HOOPAY_CLIENT_ID");
    const clientSecret = Deno.env.get("HOOPAY_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      console.error("Hoopay credentials not configured");
      return jsonResponse({ error: "Erro ao configurar o meio de pagamento." }, 500);
    }

    const {
      amount,
      donor_name,
      donor_email,
      donor_phone,
      donor_document,
    } = body as {
      amount?: number;
      donor_name?: string;
      donor_email?: string;
      donor_phone?: string;
      donor_document?: string;
    };

    if (!amount || typeof amount !== "number" || Number.isNaN(amount)) {
      return jsonResponse({ error: "Valor da doação inválido." }, 400);
    }

    if (amount < 1) {
      return jsonResponse({ error: "Valor mínimo é R$ 1,00" }, 400);
    }

    if (amount > 100000) {
      return jsonResponse({ error: "Valor máximo de doação excedido." }, 400);
    }

    const basicAuth = btoa(`${clientId}:${clientSecret}`);

    const customerObj: Record<string, string> = {
      email: donor_email || "doador@vakinha.com",
      name: donor_name || "Doador Anônimo",
      phone: donor_phone || "11912345678",
    };

    if (donor_document) {
      customerObj.document = donor_document;
    }

    const chargeBody = {
      amount,
      customer: customerObj,
      products: [
        {
          title: "Doação",
          amount,
          quantity: 1,
        },
      ],
      payments: [
        {
          amount,
          type: "pix",
        },
      ],
      data: {
        ip: clientIp,
        callbackURL:
          "https://yxedewebfzpivfcfabes.supabase.co/functions/v1/hoopay-pix?source=hoopay-webhook",
      },
    };

    const res = await fetch(`${HOOPAY_API}/charge`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chargeBody),
    });

    const responseText = await res.text();

    if (!res.ok) {
      console.error("Hoopay charge failed", { status: res.status });
      return jsonResponse(
        { error: "Falha ao criar cobrança PIX. Tente novamente em instantes." },
        502
      );
    }

    const data = JSON.parse(responseText);
    const pixCharge = data.payment?.charges?.find(
      (c: { type?: string }) => c.type === "PIX"
    );

    return jsonResponse(
      {
        success: true,
        qr_code_base64: pixCharge?.pixQrCode || null,
        copy_paste: pixCharge?.pixPayload || null,
        expires_at: pixCharge?.expireAt || null,
        order_uuid: data.orderUUID || null,
        status: data.payment?.status || null,
      },
      200
    );
  } catch (error: unknown) {
    console.error("Hoopay PIX error:", error);
    return jsonResponse(
      {
        error:
          "Erro interno ao gerar PIX. Tente novamente em alguns instantes.",
      },
      500
    );
  }
});
