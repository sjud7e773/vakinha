import { supabase } from "../lib/supabase"

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" })
  }

  const { amount } = req.body

  if (!amount || amount < 10) {
    return res.status(400).json({ error: "valor mínimo é 10 reais" })
  }

  // salvar no banco
  await supabase
    .from("donations")
    .insert({
      amount,
      status: "pending"
    })

  res.json({ success: true })
}