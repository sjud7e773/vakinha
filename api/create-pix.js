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

  const payload = {
    customer: {
      name: "Donor",
      email: "donor@donation.com"
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
      callbackURL: callbackURL,
      ip: clientIP
    }
  };

  // Tentar endpoints alternativos da Hoopay com base na documentação
  const possibleEndpoints = [
    "https://api.pay.hoopay.com.br/checkout",
    "https://api.pay.hoopay.com.br/checkout/pix",
    "https://api.pay.hoopay.com.br/v1/checkout",
    "https://api.pay.hoopay.com.br/v1/checkout/pix",
    "https://api.pay.hoopay.com.br/pix/checkout",
    "https://api.pay.hoopay.com.br/payment",
    "https://api.pay.hoopay.com.br/payment/pix",
    "https://api.pay.hoopay.com.br/charge",
    "https://api.pay.hoopay.com.br/charges"
  ];

  let response;
  let workingEndpoint = null;
  
  for (const endpoint of possibleEndpoints) {
    console.log("[create-pix] Testando endpoint:", endpoint);
    
    try {
      const testResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Basic " + auth
        },
        body: JSON.stringify(payload)
      });
      
      console.log(`[create-pix] Endpoint ${endpoint} status:`, testResponse.status);
      
      if (testResponse.status !== 404) {
        response = testResponse;
        workingEndpoint = endpoint;
        console.log(`[create-pix] Endpoint funcionando encontrado: ${endpoint}`);
        break;
      }
    } catch (error) {
      console.log(`[create-pix] Erro ao testar ${endpoint}:`, error.message);
    }
  }
  
  if (!response || !workingEndpoint) {
    console.error("[create-pix] Nenhum endpoint funcionou!");
    return res.status(500).json({
      error: "Nenhum endpoint Hoopay disponível",
      details: "Todos os endpoints testados retornaram 404",
      testedEndpoints: possibleEndpoints
    });
  }

  console.log("[create-pix] Endpoint Hoopay usado:", workingEndpoint);
  console.log("[create-pix] Payload enviado:", JSON.stringify(payload, null, 2));
  console.log("[create-pix] Headers enviados:", {
    "Content-Type": "application/json",
    "Authorization": "Basic " + auth.substring(0, 20) + "..."
  });

  console.log("[create-pix] Resposta Hoopay status:", response.status);

  const data = await response.json();
  console.log("[create-pix] Resposta Hoopay data:", JSON.stringify(data, null, 2));

  if (!response.ok) {
    console.error("[create-pix] Erro Hoopay:", data);
    return res.status(response.status).json({
      error: "Hoopay error",
      details: data,
      status: response.status,
      endpoint: workingEndpoint
    });
  }

  console.log("[create-pix] PIX criado com sucesso!");
  return res.json(data);
}