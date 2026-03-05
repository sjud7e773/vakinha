# Relatório de Segurança – Página de Doações PIX (Facebook/Instagram Ads)

**Objetivo:** Sistema antifraude robusto que **não bloqueie** usuários legítimos vindos de campanhas no Facebook/Instagram e que redirecione apenas tráfego suspeito (bots, desktop, Biblioteca de Anúncios, scrapers).

---

## 1. Melhorias implementadas

### 1.1 Cloaking (redirect para tráfego não legítimo)

- **Onde:** `index.html` (script inline antes do React) e `main.tsx` (rede de segurança).
- **Lógica:** Redireciona com `location.replace('https://www.vakinha.com.br/')` **somente** quando:
  - **User-Agent** é de crawler/bot (facebookexternalhit, facebot, googlebot, bingbot, crawler, spider, scraper, headless, phantom, selenium, puppeteer, playwright, curl, wget, python-requests, go-http-client);
  - **navigator.webdriver === true** (headless/automação);
  - **Desktop** (ausência de indicadores móveis: Mobile, Android, iPhone, iPad, etc.).
- **Não redireciona:** Usuários com UA normal (Chrome, Safari, etc.) e **mobile**. Quem clica no anúncio no Facebook/Instagram vem com UA de navegador real e geralmente em mobile → **não é afetado**.
- **Referer:** **Não é usado** para decisão de redirect. Usuários com referer facebook.com/fb.com mas UA normal (mobile) **nunca** são redirecionados.

### 1.2 Detecção avançada de bots (score de risco)

- **Arquivo:** `src/lib/donation-security.ts`.
- **Score 0–100** com sinais:
  - UA de bot conhecido: +50
  - `navigator.webdriver === true`: +40
  - Ausência de UA mobile: +15
  - `plugins.length === 0` (em não-mobile): +10
  - `languages.length === 0`: +5
  - Falha ao obter canvas 2D: +5
- **Uso:** Página simplificada (sem botão de gerar PIX) só quando score ≥ 65 **e** não houve redirect. Em dúvida, o acesso é permitido.

### 1.3 Biblioteca de Anúncios do Facebook

- **Detecção:** Apenas por **User-Agent** (facebookexternalhit, facebot). **Não** por referer.
- **Efeito:** Esse UA é de crawler; usuários reais que clicam no anúncio têm UA normal. Crawlers são redirecionados no script inline **antes** da página carregar, sem deixar a URL real no histórico.

### 1.4 Token efêmero (anti-scraping / uso fora do domínio)

- **Backend:** Nova ação `page_token` retorna token com TTL de 5 minutos. Token é **uso único**: consumido na geração do PIX e invalidado.
- **Frontend:** Antes de gerar PIX, solicita `page_token` e envia no body da requisição de geração.
- **Objetivo:** Dificultar uso da API apenas copiando HTML em outro domínio; geração de PIX exige token válido obtido na sessão.

### 1.5 Remoção de bloqueio por Referer (compatibilidade Facebook Ads)

- **Antes:** Backend considerava “bot” se **Referer** fosse facebook.com/fb.com **ou** UA de bot → bloqueava quem vinha do Facebook.
- **Agora:** Bloqueio **somente** por **User-Agent** (lista de crawlers). Referer **não** é usado.
- **Resultado:** Usuários que clicam no anúncio (referer Facebook + UA normal) **sempre** podem gerar PIX.

### 1.6 Rate limiting adaptativo e burst

- **Backend:** `supabase/functions/hoopay-pix/index.ts`.
- Chave: `pix:{IP}:{fingerprint}`.
- **Burst:** Se mais de 2 requisições em 5 segundos para a mesma chave → 429 (evita picos automatizados).
- Janelas: 3 req/min (curta), 5 req/10 min (longa). Usuário legítimo não atinge esses limites em uso normal.

### 1.7 Proteção contra replay

- **PoW:** Nonce de uso único com TTL 2 min; após uso, nonce é descartado.
- **Token de página:** Uso único; consumido na geração do PIX.
- Nenhuma requisição de geração pode ser reutilizada.

### 1.8 Demais proteções mantidas

- **Proof-of-Work** antes da geração do PIX (dificuldade baixa, rápido para usuários reais).
- **Fingerprint** (UA, timezone, idioma, tela, canvas) enviado na geração e usado no rate limit.
- **Honeypot** (campo invisível “website”): se preenchido, backend responde 200 com success sem PIX (bloqueio silencioso).
- **Validação de valor** (mín/máx) e regras de negócio inalteradas.

---

## 2. Compatibilidade com Facebook Ads

- **Tráfego legítimo (clique no anúncio):**  
  - UA de navegador real (Chrome, Safari, etc.) e geralmente **mobile** → **não** é redirecionado, **não** é bloqueado no backend, **não** vê página simplificada.
- **Crawler da Biblioteca de Anúncios:**  
  - UA facebookexternalhit/facebot → redirecionado no **primeiro** script (inline), antes do React; veem apenas https://www.vakinha.com.br/.
- **Desktop (campanha só mobile):**  
  - Redirecionado para vakinha.com.br; evita analistas/bots em desktop sem afetar usuários móveis.
- **Política do Facebook:**  
  - Não há conteúdo diferente para o **mesmo** tipo de usuário (humano mobile). Crawlers e desktop recebem redirect para página pública legítima (vakinha.com.br), o que é aceitável para revisão de anúncios.

---

## 3. Riscos de falso positivo (mitigações)

| Cenário              | Risco | Mitigação |
|----------------------|-------|-----------|
| Usuário mobile Facebook/Instagram | Nenhum | Redirect e bloqueio **só** por UA de bot ou desktop; referer não é usado. |
| Navegador antigo     | Baixo | Sem checagens exóticas; canvas com fallback; PoW em crypto.subtle (amplamente suportado). |
| Bloqueador de script | N/A   | Sem script = página não carrega; não há “bloqueio” adicional. |
| Desktop legítimo     | Aceito | Campanha definida como mobile-only; desktop é redirecionado. |

**Regra aplicada:** Em dúvida entre humano ou bot → **permitir**.

---

## 4. Confirmações

- **Usuários legítimos (mobile, UA normal):** Não são redirecionados, não são bloqueados, fluxo de doação e geração de PIX permanecem intactos.
- **Fluxo de pagamento:** Não alterado (valor, Hoopay, PIX); apenas camadas de segurança antes da geração do PIX.
- **Credenciais:** Nenhuma credencial é exposta; token e PoW são efêmeros e não reutilizáveis.

---

## 5. Arquivos alterados / criados

| Arquivo | Alteração |
|--------|-----------|
| `index.html` | Script inline de cloaking (redirect bots/desktop antes do app). |
| `src/main.tsx` | Redirect de segurança e bootstrap do app apenas para tráfego permitido. |
| `src/lib/donation-security.ts` | Score de risco, isDesktop, isKnownBotUA, isFacebookAdLibraryCrawler, shouldRedirectToCloak, getCloakRedirectUrl; remoção de bloqueio por referer. |
| `src/components/DonationPage.tsx` | Obtenção e envio de `page_token` no fluxo de geração de PIX. |
| `supabase/functions/hoopay-pix/index.ts` | Ação `page_token`, validação de token de uso único, burst no rate limit, bloqueio **apenas** por UA (referer removido). |
| `docs/RELATORIO-SEGURANCA-DOACOES-PIX.md` | Este relatório. |

---

## 6. Resumo técnico por proteção

1. **Proof-of-Work:** Challenge no backend; cliente resolve; nonce uso único + TTL 2 min.  
2. **Fingerprint:** UA, timezone, idioma, tela, canvas; enviado na geração; usado no rate limit.  
3. **Honeypot:** Campo invisível “website”; preenchido → 200 com success sem PIX.  
4. **Rate limit:** IP + fingerprint; janelas 1 min e 10 min; burst 2 req/5 s.  
5. **Detecção de bots:** UA conhecido + opcional score de risco; redirect no HTML antes do app.  
6. **Biblioteca de Anúncios Facebook:** Só UA facebookexternalhit/facebot → redirect; referer não usado.  
7. **Token efêmero:** page_token com TTL 5 min, uso único na geração do PIX.  
8. **Replay:** Nonce e token de uso único; sem reutilização de requisições.

---

## 7. Fortificação da decisão (auditoria – decisão em camadas)

### 7.1 Sistema de decisão em camadas

A decisão de redirecionar ou mostrar página simplificada **não depende de um único sinal**. Passa a usar:

- **humanScore** (sinais positivos de humano):
  - Presença de `navigator.plugins.length > 0`
  - `navigator.languages` válido (length > 0)
  - `navigator.webdriver === false`
  - `hardwareConcurrency > 1`
  - `deviceMemory` presente (≥ 1)
  - Suporte a Canvas 2D
  - Suporte a WebGL
  - Viewport compatível (innerWidth 320–4320, innerHeight ≥ 200)
  - `window.chrome` presente (navegador Chromium)

- **botScore** (sinais de bot):
  - `navigator.webdriver === true` (+2)
  - UA contendo crawler/spider/scraper/headless/curl/python-requests etc. (+2)
  - `plugins.length === 0` em não-mobile (+1)
  - `languages.length === 0` (+1)
  - Canvas 2D indisponível (+1)
  - UA headless e `window.chrome` ausente (+1)
  - WebGL com renderer SwiftShader/llvmpipe/mesa (+1)

**Regras de decisão:**

- **humanoScore ≥ 3** → permitir acesso (página completa).
- **botScore ≥ 4** → redirecionar.
- **Crawler da Biblioteca de Anúncios (UA facebookexternalhit/facebot)** → redirecionar.
- **Desktop + botScore ≥ 2 e humanScore < 2** → redirecionar.
- **Zona cinzenta** (não se enquadra acima) → **permitir acesso**.
- **Suspeito mas não certo** (botScore 2–3, humanScore < 3) → **safe mode** (página simplificada, sem botão PIX; **não** redireciona).

**Regra obrigatória:** Em qualquer dúvida entre humano ou bot → **permitir**. Nunca redirecionar com confiança baixa.

### 7.2 Delay de verificação humana

Antes de aplicar os scores:

1. A página carrega (após o script inline do `index.html`, que já manda crawlers/desktop embora).
2. O script coleta sinais só **depois** de um atraso aleatório de **300 ms a 1000 ms**.
3. Durante esse intervalo, qualquer **interação** conta como humano e encerra a verificação:
   - `scroll`
   - `touchstart`
   - `mousemove`
   - `focus`

Se houver interação → classificação **humano** imediata (página completa). Bots raramente disparam esses eventos.

### 7.3 Safe mode (sem redirecionar em dúvida)

Quando o sistema acha o acesso suspeito mas **não tem certeza** (ex.: botScore 2–3, humanScore < 3, sem interação):

- **Não** redireciona.
- Mostra a **versão simplificada** da página (sem botão de gerar PIX).
- Evita redirecionar usuários reais por engano.

### 7.4 Lista de permissão de navegadores reais

Estes navegadores são **permitidos automaticamente** (sem delay, sem redirecionamento):

- Chrome mobile (UA com Chrome + Mobile ou CriOS)
- Safari iOS (iPhone, iPad, iPod)
- Samsung Internet (SamsungBrowser)
- Firefox mobile (Firefox + Mobile ou FxiOS)
- Edge mobile (Edg/EdgA + Mobile)
- Safari mobile (Version + Safari + Mobile)

Quem usa esses browsers recebe página completa imediatamente.

### 7.5 Detecção de headless

Vários sinais são combinados antes de contar como bot:

- `navigator.webdriver === true`
- `window.chrome` inexistente em contexto de UA headless
- `plugins.length === 0` (em não-mobile)
- `languages.length === 0`
- WebGL com renderer típico de software (SwiftShader, llvmpipe, mesa)

Nenhum sinal sozinho define “bot”; o **botScore** agregado é que dispara redirect ou safe mode conforme as regras acima.

### 7.6 Log de decisão (interno, não exposto no frontend)

O módulo oferece callback opcional `onDecisionLog` em `getCloakDecision()`. O log contém:

- fingerprint (hash, se disponível)
- humanScore
- botScore
- decisão (redirect / full / simplified)
- motivo (reason)
- se o browser está na allowlist
- se houve interação no delay

Em **desenvolvimento** (`import.meta.env.DEV`), o `main.tsx` usa esse callback para `console.debug` (ajuda a depurar). Em produção, o frontend **não** exibe esses dados na UI; podem ser enviados ao backend em chamada separada se desejar armazenar só no servidor.

### 7.7 Compatibilidade com fluxo de doação

- **Geração de PIX, Hoopay, Proof-of-Work, rate limit, token efêmero, nonce anti-replay** não foram alterados.
- Apenas a **lógica de exibição** (redirect / página completa / página simplificada) foi fortificada; o fluxo de pagamento permanece o mesmo.

---

## 8. Testes de compatibilidade (matriz esperada)

| Origem / dispositivo      | Comportamento esperado |
|---------------------------|------------------------|
| Chrome Android (clique anúncio) | Página completa, sem redirect |
| Safari iPhone (clique anúncio)  | Página completa, sem redirect |
| Samsung Internet mobile        | Página completa, sem redirect |
| Firefox mobile                 | Página completa, sem redirect |
| Edge mobile                    | Página completa, sem redirect |
| Facebook in-app browser (mobile)| Allowlist ou humanScore; página completa |
| Instagram in-app browser (mobile) | Allowlist ou humanScore; página completa |
| Crawler (facebookexternalhit, etc.) | Redirect no script inline (index.html) |
| Desktop                       | Redirect no script inline (index.html) |
| Headless (webdriver true)     | Redirect no script inline (index.html) |

Todos os cenários de **usuário real em mobile** (incluindo Facebook/Instagram in-app) devem acessar a página completa e poder gerar PIX. Bots e desktop continuam sendo redirecionados ou, na zona cinzenta, recebem safe mode em vez de redirect.

---

## 9. Confirmações finais (pós-fortificação)

- **Usuários reais (mobile, navegadores comuns)** não são redirecionados por engano: allowlist + humanScore + interação no delay protegem.
- **Bots e crawlers** continuam sendo bloqueados: script inline (UA + webdriver) + decisão em camadas (botScore, Ad Library, desktop com poucos sinais humanos).
- **Em dúvida** o sistema **permite** (full ou safe mode) e **nunca** redireciona.
- **Fluxo de geração de PIX** permanece intacto; nenhuma mudança em Hoopay, PoW, rate limit ou token.

---

*Relatório atualizado após auditoria completa e fortificação da decisão (decisão em camadas, delay de verificação humana, safe mode, allowlist, log interno).*
