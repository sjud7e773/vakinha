# Deploy na Vercel – Checklist Obrigatório

O erro **"Não foi possível iniciar a sessão"** acontece quando as variáveis de ambiente não estão configuradas na Vercel.

## 1. Variáveis de ambiente na Vercel

No projeto Vercel → Settings → Environment Variables, configure:

| Nome | Valor | Observação |
|------|-------|------------|
| `VITE_SUPABASE_URL` | `https://yxedewebfzpivfcfabes.supabase.co` | URL do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `eyJhbGci...` (anon key) | Chave pública do Supabase |

Depois, faça um novo deploy (ou Redeploy) para aplicar as variáveis.

## 2. Supabase – Edge Function hoopay-pix

Faça o deploy da função:

```bash
supabase functions deploy hoopay-pix
```

Configurar secrets:

```bash
supabase secrets set HOOPAY_CLIENT_ID=seu_client_id
supabase secrets set HOOPAY_CLIENT_SECRET=seu_client_secret
```

(SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem no projeto Supabase.)

## 3. Migration campaign_stats

No Supabase Dashboard → SQL Editor, execute o conteúdo de:

`supabase/migrations/20250305000000_campaign_stats.sql`

Ou use:

```bash
supabase db push
```

## 4. Teste do fluxo PIX

1. Abra o site na Vercel.
2. Selecione um valor e clique em Contribuir.
3. O PIX deve ser gerado (QR Code + copia e cola).

Se ainda falhar, confira no console do navegador (F12) as mensagens de erro e a resposta da função.
