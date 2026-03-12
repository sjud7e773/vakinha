import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const processedEvents = new Set();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }

  try {
    const body = req.body;
    
    console.log("[Webhook] Pagamento recebido:", body);

    const eventId = body.event_id || body.id || body.orderUUID;
    if (eventId && processedEvents.has(eventId)) {
      console.log("[Webhook] Evento duplicado ignorado:", eventId);
      return res.status(200).json({ received: true, duplicate: true });
    }
    if (eventId) processedEvents.add(eventId);

    const status = body.status || body.payment?.status;
    const amount = Number(body.amount || body.payment?.amount || 0);
    
    const isPaid = ["PAID", "paid", "CONFIRMED", "confirmed", "APPROVED", "approved"].includes(String(status));
    
    if (isPaid && amount > 0) {
      console.log("[Webhook] Pagamento confirmado:", { amount, status, eventId });

      const maxRetries = 3;
      let success = false;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const { error } = await supabase.rpc('increment_donation_total', {
            amount_reais: amount
          });
          
          if (!error) {
            console.log("[Webhook] Doação registrada:", { amount, eventId });
            success = true;
            break;
          } else {
            console.error(`[Webhook] Tentativa ${attempt} falhou:`, error);
            if (attempt < maxRetries) {
              await new Promise(r => setTimeout(r, 100 * attempt));
            }
          }
        } catch (e) {
          console.error(`[Webhook] Erro tentativa ${attempt}:`, e);
          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, 100 * attempt));
          }
        }
      }

      if (!success) {
        console.error("[Webhook] Falha ao registrar doação após todas as tentativas");
      }

      try {
        await sendFacebookPixelEvent(amount, "BRL", eventId);
      } catch (e) {
        console.error("[Webhook] Erro ao enviar evento Facebook:", e);
      }
    } else {
      console.log("[Webhook] Status não é pago ou valor inválido:", { status, amount });
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("[Webhook] Erro:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function sendFacebookPixelEvent(amount, currency, eventId) {
  const pixelId = process.env.FACEBOOK_PIXEL_ID || "1497055778126239";
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
  
  if (!accessToken) {
    console.warn("[Facebook Pixel] Access token não configurado");
    return;
  }

  const payload = {
    data: [{
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId || `purchase_${Date.now()}`,
      action_source: "website",
      user_data: {
        client_ip_address: "0.0.0.0",
        client_user_agent: "Vercel/Node.js",
      },
      custom_data: {
        value: amount,
        currency: currency,
      },
    }],
  };

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${accessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Facebook API error: ${errorText}`);
  }

  console.log("[Facebook Pixel] Evento Purchase enviado");
}