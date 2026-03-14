export default async function handler(req, res) {
  // Log inicial para confirmar que a função foi invocada
  console.log("[create-pix] === FUNÇÃO INICIADA ===");
  console.log("[create-pix] Timestamp:", new Date().toISOString());
  console.log("[create-pix] Node version:", process.version);
  
  // Log de todas as propriedades do request
  console.log("[create-pix] Request method:", req.method);
  console.log("[create-pix] Request url:", req.url);
  console.log("[create-pix] Request headers:", JSON.stringify(req.headers, null, 2));
  
  // Verificar Content-Type
  const contentType = req.headers['content-type'] || '';
  console.log("[create-pix] Content-Type:", contentType);

  if (req.method !== "POST") {
    console.log("[create-pix] ERRO: Método não permitido:", req.method);
    return res.status(405).json({ error: "method not allowed", allowed: ["POST"] });
  }

  // Parse body manualmente se necessário
  let body = req.body;
  if (!body && req.method === "POST") {
    console.log("[create-pix] req.body vazio, tentando parse manual...");
    // Body pode não estar parseado
    try {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const rawBody = Buffer.concat(chunks).toString();
      console.log("[create-pix] Raw body:", rawBody);
      body = JSON.parse(rawBody);
    } catch (e) {
      console.error("[create-pix] Erro ao parse body:", e);
    }
  }
  
  console.log("[create-pix] Body parseado:", JSON.stringify(body, null, 2));

  const { amount } = body || {};
  console.log("[create-pix] Amount extraído:", amount, "tipo:", typeof amount);

  if (!amount || typeof amount !== 'number' || amount < 10) {
    console.log("[create-pix] ERRO: Valor inválido:", amount, "tipo:", typeof amount);
    return res.status(400).json({ 
      error: "valor invalido", 
      details: "O valor deve ser um número maior ou igual a 10 reais",
      received: amount,
      type: typeof amount
    });
  }

  // Verificar variáveis de ambiente
  const clientId = process.env.HOOPAY_CLIENT_ID;
  const clientSecret = process.env.HOOPAY_CLIENT_SECRET;
  const siteUrl = process.env.SITE_URL || process.env.VERCEL_URL || "https://vakinha-vaquinha-emergencia-no-abrigo-patas-fora-da-corrente.vercel.app";

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