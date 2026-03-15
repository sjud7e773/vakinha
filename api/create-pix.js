export default async function handler(req, res) {
  console.log("[create-pix] Request recebida", { method: req.method, body: req.body });

  if (req.method !== "POST") {
    console.log("[create-pix] Método não permitido:", req.method);
    return res.status(405).json({ error: "method not allowed" });
  }

  const { amount } = req.body;
  console.log("[create-pix] Amount recebido:", amount);

  if (!amount || amount < 10) {
    console.log("[create-pix] Valor inválido:", amount);
    return res.status(400).json({ error: "valor mínimo é 10 reais" });
  }

  // Verificar variáveis de ambiente
  const clientId = process.env.HOOPAY_CLIENT_ID;
  const clientSecret = process.env.HOOPAY_CLIENT_SECRET;
  let siteUrl = process.env.SITE_URL || process.env.VERCEL_URL || "https://vakinha-vaquinha-emergencia-no-abrigo-patas-fora-da-corrente.vercel.app";
  
  // Garantir que siteUrl tenha https:// no início
  if (siteUrl && !siteUrl.startsWith("http")) {
    siteUrl = "https://" + siteUrl;
  }

  console.log("[create-pix] Variáveis de ambiente:", {
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    siteUrl: siteUrl,
  });

  if (!clientId || !clientSecret) {
    console.error("[create-pix] CREDENCIAIS HOOPAY NÃO CONFIGURADAS!");
    return res.status(500).json({ 
      error: "configuracao incompleta", 
      details: "HOOPAY_CLIENT_ID ou HOOPAY_CLIENT_SECRET não configurados" 
    });
  }

  const auth = Buffer.from(clientId + ":" + clientSecret).toString("base64");
  const callbackURL = siteUrl + "/api/webhook";
  
  // Capturar IP real do cliente
  const clientIP = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "0.0.0.0";

  console.log("[create-pix] Criando cobrança Hoopay...", { callbackURL, clientIP });

  // Payload correto baseado no Postman da Hoopay
  const payload = {
    customer: {
      name: "Donor",
      email: "donor@donation.com",
      phone: "11999999999",
      document: ""
    },
    products: [
      {
        title: "Doacao",
        price: amount,
        quantity: 1
      }
    ],
    payments: [
      {
        type: "pix",
        amount: amount
      }
    ],
    data: {
      ip: clientIP,
      callbackURL: callbackURL
    }
  };

  // Endpoint correto conforme Postman: POST /charge
  const hoopayUrl = "https://api.pay.hoopay.com.br/charge";
  
  console.log("[create-pix] Endpoint Hoopay:", hoopayUrl);
  console.log("[create-pix] Payload enviado para Hoopay:", JSON.stringify(payload, null, 2));
  console.log("[create-pix] Headers enviados:", {
    "Content-Type": "application/json",
    "Authorization": "Basic " + auth.substring(0, 20) + "..."
  });

  try {
    const response = await fetch(hoopayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + auth
      },
      body: JSON.stringify(payload)
    });

    console.log("[create-pix] Resposta Hoopay status:", response.status);

    const data = await response.json();
    console.log("[create-pix] Resposta Hoopay data:", JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error("[create-pix] Erro Hoopay:", data);
      return res.status(response.status).json({
        error: "Hoopay error",
        details: data,
        status: response.status
      });
    }

    // Extrair dados PIX da resposta conforme Postman
    const charge = data.payment?.charges?.[0];
    if (!charge || !charge.pixPayload || !charge.pixQrCode) {
      console.error("[create-pix] Dados PIX não encontrados na resposta:", charge);
      return res.status(500).json({
        error: "Dados PIX não encontrados",
        details: "Resposta não contém pixPayload ou pixQrCode",
        charge: charge
      });
    }

    const pixData = {
      pixPayload: charge.pixPayload,
      pixQrCode: charge.pixQrCode,
      expireAt: charge.expireAt,
      orderUUID: data.orderUUID
    };

    console.log("[create-pix] PIX criado com sucesso!", pixData);
    return res.json(pixData);
  } catch (error) {
    console.error("[create-pix] Erro ao criar PIX:", error.message);
    return res.status(500).json({
      error: "Erro ao criar PIX",
      details: error.message
    });
  }
}