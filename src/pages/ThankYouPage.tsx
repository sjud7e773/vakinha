import { Link } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import logo from "@/assets/logo.png";
import seloSeguranca from "@/assets/selo-seguranca.png";

const ThankYouPage = () => {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const amount = params.get("amount");

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-5 py-6">
        <div className="flex justify-center mb-10">
          <img src={logo} alt="Vakinha" className="h-12" loading="eager" decoding="sync" />
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Obrigado pela sua doação! 💚</h1>
          <p className="text-muted-foreground text-sm mb-6 max-w-sm">
            {amount
              ? <>Sua contribuição de <strong className="text-foreground">R$ {Number(amount).toFixed(2).replace(".", ",")}</strong> ajuda a transformar vidas.</>
              : "Sua contribuição ajuda a transformar vidas."}
          </p>
          <Link to="/" className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-extrabold text-center hover:opacity-90 transition-opacity inline-block">
            Voltar à campanha
          </Link>
        </div>
        <div className="flex justify-center mt-10">
          <img src={seloSeguranca} alt="Selo" className="h-10" loading="eager" decoding="sync" />
        </div>
      </div>
    </div>
  );
};

export default ThankYouPage;
