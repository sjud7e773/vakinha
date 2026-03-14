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

  console.log("[create-pix] Criando cobrança Hoopay...", { callbackURL });

  const payload = {
    customer: {
      email: "pix@cliente.com",
      name: "Cliente",
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
      ip: "127.0.0.1",
      callbackURL: callbackURL
    }
  };

  console.log("[create-pix] Payload:", JSON.stringify(payload, null, 2));

  try {
    const response = await fetch("https://api.pay.hoopay.com.br/charge", {
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
        error: "hoopay request failed",
        details: data.message || data.error || "Erro na API Hoopay",
        status: response.status
      });
    }

    console.log("[create-pix] PIX criado com sucesso!");
    return res.json(data);

  } catch (error) {
    console.error("[create-pix] Erro inesperado:", error);
    return res.status(500).json({
      error: "internal server error",
      details: error.message || "Erro desconhecido"
    });
  }
}