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

async function verifyWebhookSignature(req: Request, body: string): Promise<boolean> {
  const signature = req.headers.get("x-hoopay-signature") ?? req.headers.get("X-Hoopay-Signature");
  if (!signature) return false;
  
  const webhookSecret = Deno.env.get("HOOPAY_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.warn("[hoopay-pix] HOOPAY_WEBHOOK_SECRET not configured, skipping signature verification");
    return true;
  }
  
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBytes = hexToBytes(signature);
    const computed = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    return timingSafeEqual(new Uint8Array(computed), signatureBytes);
  } catch (e) {
    console.error("[hoopay-pix] Signature verification error:", e);
    return false;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

// ============== SISTEMA ANTI-SPAM E CACHE DE PIX ==============

// Configurações Anti-Spam
const ABUSE_PIX_LIMIT = 5; // máximo de PIX em 5 minutos
const ABUSE_WINDOW_MS = 5 * 60 * 1000; // 5 minutos
const ABUSE_BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutos de bloqueio

// Rate limiting em memória (BACKUP caso Supabase falhe)
const abuseMemory = new Map<string, { count: number; firstAttempt: number; blockedUntil?: number }>();

function checkAbuseMemory(key: string): { isBlocked: boolean; blockedUntil?: number } {
  const now = Date.now();
  const record = abuseMemory.get(key);
  
  if (!record) {
    // Primeira tentativa
    abuseMemory.set(key, { count: 1, firstAttempt: now });
    return { isBlocked: false };
  }
  
  // Se está bloqueado, verifica se já expirou
  if (record.blockedUntil) {
    if (now < record.blockedUntil) {
      return { isBlocked: true, blockedUntil: record.blockedUntil };
    } else {
      // Bloqueio expirou, resetar
      abuseMemory.set(key, { count: 1, firstAttempt: now });
      return { isBlocked: false };
    }
  }
  
  // Verifica se a janela de 5 minutos expirou
  if (now - record.firstAttempt > ABUSE_WINDOW_MS) {
    // Resetar contagem
    abuseMemory.set(key, { count: 1, firstAttempt: now });
    return { isBlocked: false };
  }
  
  // Incrementar contagem
  record.count++;
  
  // Verificar se atingiu limite
  if (record.count > ABUSE_PIX_LIMIT) {
    record.blockedUntil = now + ABUSE_BLOCK_DURATION_MS;
    console.warn(`[hoopay-pix] ABUSE MEMORY BLOCKED: ${key}, count: ${record.count}`);
    return { isBlocked: true, blockedUntil: record.blockedUntil };
  }
  
  abuseMemory.set(key, record);
  return { isBlocked: false };
}

// Helper para chamadas RPC do Supabase
async function supabaseRpc(
  supUrl: string,
  svcKey: string,
  functionName: string,
  params: Record<string, unknown>
): Promise<{ data: unknown; error: Error | null }> {
  try {
    const res = await fetch(`${supUrl}/rest/v1/rpc/${functionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: svcKey,
        Authorization: `Bearer ${svcKey}`,
      },
      body: JSON.stringify(params),
    });
    
    if (!res.ok) {
      const text = await res.text();
      return { data: null, error: new Error(`RPC ${functionName} failed: ${text}`) };
    }
    
    const data = await res.json();
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}

// Verifica se existe PIX ativo para reutilização
async function checkExistingPix(
  supUrl: string,
  svcKey: string,
  ip: string,
  fingerprint: string,
  operationType: string,
  amount: number,
  heartPlanId: number | null
): Promise<{ exists: boolean; pix: { qr_code_base64: string; copy_paste: string; expires_at: string; order_uuid: string } | null }> {
  const { data, error } = await supabaseRpc(supUrl, svcKey, "get_active_pix", {
    p_ip: ip,
    p_fingerprint: fingerprint || null,
    p_operation_type: operationType,
    p_amount: amount,
    p_heart_plan_id: heartPlanId,
  });
  
  if (error || !data || !Array.isArray(data) || data.length === 0) {
    return { exists: false, pix: null };
  }
  
  const pix = data[0];
  return {
    exists: true,
    pix: {
      qr_code_base64: pix.qr_code_base64,
      copy_paste: pix.copy_paste,
      expires_at: pix.expires_at,
      order_uuid: pix.order_uuid,
    },
  };
}

// Verifica e registra abuso
async function checkAbuse(
  supUrl: string,
  svcKey: string,
  ip: string,
  fingerprint: string
): Promise<{ isBlocked: boolean; blockedUntil: string | null; reason: string }> {
  const { data, error } = await supabaseRpc(supUrl, svcKey, "check_pix_abuse", {
    p_ip: ip,
    p_fingerprint: fingerprint || null,
  });
  
  if (error || !data || !Array.isArray(data) || data.length === 0) {
    return { isBlocked: false, blockedUntil: null, reason: "ok" };
  }
  
  const result = data[0];
  return {
    isBlocked: result.is_blocked,
    blockedUntil: result.blocked_until,
    reason: result.reason,
  };
}

// Salva PIX no cache
async function savePixToCache(
  supUrl: string,
  svcKey: string,
  ip: string,
  fingerprint: string,
  operationType: string,
  amount: number,
  heartPlanId: number | null,
  qrCode: string,
  copyPaste: string,
  expiresAt: string,
  orderUuid: string
): Promise<void> {
  await supabaseRpc(supUrl, svcKey, "save_pix_to_cache", {
    p_ip: ip,
    p_fingerprint: fingerprint || null,
    p_operation_type: operationType,
    p_amount: amount,
    p_heart_plan_id: heartPlanId,
    p_qr_code: qrCode,
    p_copy_paste: copyPaste,
    p_expires_at: expiresAt,
    p_order_uuid: orderUuid,
  });
}

// Marca PIX como pago (chamado pelo webhook)
async function markPixAsPaid(
  supUrl: string,
  svcKey: string,
  orderUuid: string
): Promise<void> {
  await supabaseRpc(supUrl, svcKey, "mark_pix_as_paid", {
    p_order_uuid: orderUuid,
  });
}

// ============== FIM SISTEMA ANTI-SPAM ==============

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

// ============ FACEBOOK PIXEL CONVERSION API ============
const FACEBOOK_PIXEL_ID = "1497055778126239";

// Envia evento Donate para Facebook Pixel via Conversion API
async function sendFacebookDonateEvent(
  amount: number,
  currency: string,
  eventId: string,
  eventTime: number
): Promise<void> {
  const accessToken = Deno.env.get("FACEBOOK_ACCESS_TOKEN");
  if (!accessToken) {
    console.warn("[Facebook Pixel] FACEBOOK_ACCESS_TOKEN not set, skipping event");
    return;
  }

  const payload = {
    data: [
      {
        event_name: "Donate",
        event_time: eventTime,
        event_id: eventId, // Deduplication key
        action_source: "website",
        user_data: {
          // Hash de dados anônimos (obrigatório para CAPI)
          client_ip_address: "0.0.0.0",
          client_user_agent: "Deno/Edge Function",
        },
        custom_data: {
          value: amount,
          currency: currency,
        },
      },
    ],
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${FACEBOOK_PIXEL_ID}/events?access_token=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Facebook Pixel] Failed to send event:", errorText);
    } else {
      const result = await response.json();
      console.log("[Facebook Pixel] Donate event sent:", { eventId, amount, currency, result });
    }
  } catch (error) {
    console.error("[Facebook Pixel] Error sending event:", error);
  }
}
// ============ END FACEBOOK PIXEL ============

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const isWebhook = isWebhookRequest(req);
  const authHeader = req.headers.get("Authorization") ?? "";
  const hasBearer = authHeader.startsWith("Bearer ");

  if (isWebhook) {
    try {
      const rawBody = await req.text();
      
      // Verify webhook signature
      const isValidSignature = await verifyWebhookSignature(req, rawBody);
      if (!isValidSignature) {
        console.warn("[hoopay-pix] Invalid webhook signature");
        return jsonResponse({ error: "Invalid signature" }, 401);
      }
      
      let body: Record<string, unknown> = {};
      try {
        if (rawBody) body = (JSON.parse(rawBody) as Record<string, unknown>) ?? {};
      } catch {
        console.warn("[hoopay-pix] Webhook body parse failed");
      }
      
      // Idempotency check - prevent duplicate processing
      const eventId = (body.event_id as string) ?? (body.id as string) ?? (body.orderUUID as string);
      if (eventId && isNonceUsed(`webhook:${eventId}`)) {
        console.log("[hoopay-pix] Duplicate webhook event, already processed:", eventId);
        return jsonResponse({ received: true, duplicate: true }, 200);
      }
      if (eventId) markNonceUsed(`webhook:${eventId}`);
      
      const status = (body.status as string) ?? (body.payment as Record<string, unknown>)?.status;
      const payment = body.payment as Record<string, unknown> | undefined;
      const amt = Number(body.amount ?? payment?.amount ?? 0);
      const isPaid = ["PAID", "paid", "CONFIRMED", "confirmed", "APPROVED", "approved"].includes(String(status));
      
      if (isPaid && amt > 0) {
        const supUrl = Deno.env.get("SUPABASE_URL");
        const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        
        // === FACEBOOK PIXEL - EVENTO DONATE ===
        // Envia evento apenas quando pagamento é confirmado
        // Usa event_id para deduplicação (mesmo ID do webhook)
        const fbEventId = eventId || `donate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await sendFacebookDonateEvent(amt, "BRL", fbEventId, Math.floor(Date.now() / 1000));
        // ======================================
        
        if (supUrl && svcKey) {
          // Marca PIX como pago no cache (atualiza controle de abuso)
          const orderUuid = (body.orderUUID ?? body.order_uuid) as string;
          if (orderUuid) {
            await markPixAsPaid(supUrl, svcKey, orderUuid);
          }
          
          // Use RPC for atomic increment to prevent race conditions
          const maxRetries = 3;
          let lastError = null;
          let success = false;
          
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              const r = await fetch(`${supUrl}/rest/v1/rpc/increment_donation_total`, {
                method: "POST",
                headers: { 
                  "Content-Type": "application/json", 
                  apikey: svcKey, 
                  Authorization: `Bearer ${svcKey}`,
                  "Prefer": "return=minimal"
                },
                body: JSON.stringify({ amount_reais: amt }),
              });
              
              if (r.ok) {
                console.log("[hoopay-pix] Donation recorded:", { amount: amt, eventId });
                success = true;
                break;
              } else {
                const errorText = await r.text();
                lastError = errorText;
                if (attempt < maxRetries) {
                  await new Promise((r) => setTimeout(r, 100 * attempt));
                }
              }
            } catch (e) {
              lastError = e;
              if (attempt < maxRetries) {
                await new Promise((r) => setTimeout(r, 100 * attempt));
              }
            }
          }
          
          if (!success && lastError) {
            console.error("[hoopay-pix] Webhook increment failed after retries:", lastError);
          }
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

  const supUrl = Deno.env.get("SUPABASE_URL");
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // === SISTEMA ANTI-SPAM EM MEMÓRIA (BACKUP PRINCIPAL) ===
  const abuseKey = `abuse:${clientIp}:${fp}`;
  const abuseCheckMemory = checkAbuseMemory(abuseKey);
  if (abuseCheckMemory.isBlocked) {
    console.warn(`[hoopay-pix] MEMORY BLOCK: ${abuseKey}, blocked until ${new Date(abuseCheckMemory.blockedUntil || 0).toISOString()}`);
    return jsonResponse({ error: "Não foi possível gerar o pagamento. Tente novamente mais tarde." }, 503);
  }

  // Verifica abuso no Supabase também (camada extra)
  if (supUrl && svcKey) {
    try {
      const abuseCheck = await checkAbuse(supUrl, svcKey, clientIp, fp);
      if (abuseCheck.isBlocked) {
        console.warn("[hoopay-pix] Supabase abuse block:", { ip: clientIp, fp, blockedUntil: abuseCheck.blockedUntil });
        return jsonResponse({ error: "Não foi possível gerar o pagamento. Tente novamente mais tarde." }, 503);
      }
    } catch (e) {
      console.error("[hoopay-pix] Supabase abuse check failed, using memory only:", e);
    }
  }

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
  
  // Corações não têm valor mínimo de R$10 - usam preço exato do plano
  const isHeartPurchase = body.is_heart_purchase === true;
  const heartPlanId = isHeartPurchase ? (body.heart_plan_id as number || 1) : null;
  const MIN_AMOUNT = isHeartPurchase ? 0.01 : 10;
  
  if (!isHeartPurchase && amount < MIN_AMOUNT) {
    return jsonResponse({ error: `Valor mínimo é R$ ${MIN_AMOUNT.toFixed(2).replace(".", ",")}` }, 400);
  }
  if (amount > 100000) return jsonResponse({ error: "Valor máximo de doação excedido." }, 400);

  // Verifica se existe PIX ativo para reutilizar
  if (supUrl && svcKey) {
    const operationType = isHeartPurchase ? "hearts" : "donation";
    const existingPix = await checkExistingPix(supUrl, svcKey, clientIp, fp, operationType, amount, heartPlanId);
    
    if (existingPix.exists && existingPix.pix) {
      console.log("[hoopay-pix] Reutilizando PIX existente:", { order_uuid: existingPix.pix.order_uuid });
      return jsonResponse({
        success: true,
        qr_code_base64: existingPix.pix.qr_code_base64,
        copy_paste: existingPix.pix.copy_paste,
        expires_at: existingPix.pix.expires_at,
        order_uuid: existingPix.pix.order_uuid,
        status: "pending",
        reused: true, // indica que é um PIX reutilizado
      }, 200);
    }
  }

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
      callbackURL: "https://mufcryvjppadwvqospgd.supabase.co/functions/v1/hoopay-pix?source=hoopay-webhook",
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

  // Salva PIX no cache para reutilização futura
  if (supUrl && svcKey) {
    const operationType = isHeartPurchase ? "hearts" : "donation";
    const orderUuid = (data.orderUUID ?? data.order_uuid) as string;
    if (orderUuid && pix.expiresAt) {
      await savePixToCache(
        supUrl, svcKey, clientIp, fp, operationType, amount, heartPlanId,
        pix.qrCodeBase64 || "", pix.copyPaste || "", pix.expiresAt, orderUuid
      );
      console.log("[hoopay-pix] PIX salvo no cache:", { order_uuid: orderUuid });
    }
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
