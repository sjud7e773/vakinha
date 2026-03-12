export default async function handler(req, res) {

if (req.method !== "POST") {
return res.status(405).json({ error: "method not allowed" })
}

const { amount } = req.body

if (!amount || amount < 10) {
return res.status(400).json({ error: "valor mínimo é 10 reais" })
}

const response = await fetch("https://api.pay.hoopay.com.br/charge", {

method: "POST",

headers: {
"Content-Type": "application/json",
"Authorization": "Basic " + Buffer.from(
process.env.HOOPAY_CLIENT_ID + ":" + process.env.HOOPAY_CLIENT_SECRET
).toString("base64")
},

body: JSON.stringify({

customer: {
email: "pix@cliente.com",
name: "Cliente",
phone: "11999999999",
document: ""
},

products: [
{
title: "PIX",
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
callbackURL: process.env.SITE_URL + "/api/webhook"
}

})

const data = await response.json()

return res.json(data)

}