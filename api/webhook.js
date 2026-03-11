export default async function handler(req, res) {

if (req.method !== "POST") {
return res.status(405).send("method not allowed")
}

const body = req.body

console.log("Pagamento recebido:", body)

res.status(200).send("ok")

}