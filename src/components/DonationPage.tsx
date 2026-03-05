import { useState, useMemo } from "react";
import { ArrowLeft, Heart, Gift, ShoppingBasket, Copy, Clock } from "lucide-react";
import avatar1 from "@/assets/avatar-1.jpg";
import avatar2 from "@/assets/avatar-2.jpg";
import avatar3 from "@/assets/avatar-3.jpg";
import avatar4 from "@/assets/avatar-4.jpg";
import avatar5 from "@/assets/avatar-5.jpg";
import seloSeguranca from "@/assets/selo-seguranca.png";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  shouldShowSimplifiedDonationPage,
  getBrowserFingerprint,
  solveProofOfWork,
} from "@/lib/donation-security";

const PRESET_VALUES = [20, 30, 50, 75, 100, 200, 500, 750, 1000];

const TURBINE_OPTIONS = [
  { icon: Heart, label: "10 corações", price: 10 },
  { icon: Gift, label: "Ajudar Uma Vida a Florescer", price: 25 },
  { icon: ShoppingBasket, label: "Doar cesta básica", price: 65 },
];

type Step = "value" | "turbine" | "pix";

interface PixData {
  qr_code_base64: string | null;
  copy_paste: string | null;
  expires_at: string | null;
}

interface DonationPageProps {
  onBack: () => void;
}

/** Campo honeypot: nome "website" para parecer inofensivo; bots que preenchem tudo o preenchem. */
const HONEYPOT_FIELD_NAME = "website";

const DonationPage = ({ onBack }: DonationPageProps) => {
  const [step, setStep] = useState<Step>("value");
  const [amount, setAmount] = useState<number>(0);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedTurbine, setSelectedTurbine] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [countdown, setCountdown] = useState(180);
  const [copied, setCopied] = useState(false);
  /** Honeypot: usuários reais nunca focam/preenchem; bots costumam preencher todos os campos. */
  const [honeypot, setHoneypot] = useState("");
  const { toast } = useToast();

  /** Página simplificada para bots/crawlers: sem botão de gerar PIX, sem quebrar indexação. */
  const simplifiedMode = useMemo(() => shouldShowSimplifiedDonationPage(), []);

  const totalAmount = amount + (selectedTurbine !== null ? TURBINE_OPTIONS[selectedTurbine].price : 0);

  const handleSelectPreset = (val: number) => {
    setAmount(val);
    setCustomAmount(val.toFixed(2).replace(".", ","));
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9,]/g, "");
    setCustomAmount(raw);
    const num = parseFloat(raw.replace(",", "."));
    setAmount(isNaN(num) ? 0 : num);
  };

  const handleContribute = () => {
    if (amount < 1) {
      toast({ title: "Valor mínimo é R$ 1,00", variant: "destructive" });
      return;
    }
    if (selectedTurbine === null) {
      setStep("turbine");
    } else {
      processPayment();
    }
  };

  const handleSkipTurbine = () => {
    processPayment();
  };

  const handleSelectTurbine = (index: number) => {
    setSelectedTurbine(index);
    processPayment(TURBINE_OPTIONS[index].price);
  };

  const processPayment = async (extraAmount = 0) => {
    setLoading(true);
    try {
      const finalAmount =
        amount +
        (selectedTurbine !== null ? TURBINE_OPTIONS[selectedTurbine].price : 0) +
        extraAmount;

      // 1) Token efêmero de sessão (vincula à página, dificulta uso da API fora do domínio)
      const { data: tokenData, error: tokenError } =
        await supabase.functions.invoke("hoopay-pix", {
          body: { action: "page_token" },
        });
      if (tokenError || !tokenData?.token) {
        throw new Error("Não foi possível iniciar a sessão. Tente novamente.");
      }
      const pageToken = tokenData.token as string;

      // 2) Desafio Proof-of-Work
      const { data: challengeData, error: challengeError } =
        await supabase.functions.invoke("hoopay-pix", {
          body: { action: "challenge" },
        });
      if (challengeError) throw challengeError;
      const nonce = challengeData?.nonce;
      const difficulty = challengeData?.difficulty ?? 2;
      if (!nonce) throw new Error("Não foi possível obter o desafio de segurança.");

      const powSolution = await solveProofOfWork(nonce, difficulty);
      const fingerprint = await getBrowserFingerprint();

      // 3) Gerar PIX (backend valida token, PoW, fingerprint, honeypot)
      const { data, error } = await supabase.functions.invoke("hoopay-pix", {
        body: {
          amount: finalAmount,
          pow_nonce: nonce,
          pow_solution: powSolution,
          fingerprint,
          page_token: pageToken,
          [HONEYPOT_FIELD_NAME]: honeypot,
        },
      });

      if (error) throw error;

      const hasPixPayload =
        data?.success &&
        (data?.qr_code_base64 || data?.copy_paste);

      if (hasPixPayload) {
        setPixData({
          qr_code_base64: data.qr_code_base64 ?? null,
          copy_paste: data.copy_paste ?? null,
          expires_at: data.expires_at ?? null,
        });
        setStep("pix");
        startCountdown();
      } else {
        throw new Error(
          data?.error || "Não foi possível gerar o PIX. Tente novamente."
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Tente novamente.";
      console.error("Payment error:", err);
      toast({
        title: "Erro ao processar pagamento",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const startCountdown = () => {
    setCountdown(180);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const formatCountdown = () => {
    const min = Math.floor(countdown / 60);
    const sec = countdown % 60;
    return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const handleCopyPix = () => {
    if (pixData?.copy_paste) {
      navigator.clipboard.writeText(pixData.copy_paste);
      setCopied(true);
      toast({ title: "Código PIX copiado!" });
      setTimeout(() => setCopied(false), 3000);
    }
  };

  /* ===================== PIX SCREEN ===================== */
  if (step === "pix") {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-lg mx-auto px-5 py-6">
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>

          <div className="flex justify-center mb-8">
            <img src={logo} alt="Vakinha" className="h-12" loading="eager" fetchPriority="high" decoding="sync" />
          </div>

          <h2 className="text-center text-lg font-bold text-foreground mb-2">
            Doe R$ {totalAmount.toFixed(2).replace(".", ",")} e ajude a transformar vidas 💚
          </h2>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-6">
            <Clock className="w-4 h-4" />
            <span>QR Code expira em: <strong className="text-foreground">{formatCountdown()}</strong></span>
          </div>

          {pixData?.qr_code_base64 && (
            <div className="flex justify-center mb-5">
              <div className="border-2 border-border rounded-xl p-5 bg-white">
                <img src={`data:image/png;base64,${pixData.qr_code_base64}`} alt="QR Code PIX" className="w-52 h-52" loading="eager" decoding="sync" />
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 text-sm text-primary mb-5">
            <div className="w-2 h-2 rounded-full bg-primary" />
            Escaneie o QR Code no app do seu banco
          </div>

          <div className="flex items-center gap-4 mb-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted-foreground">ou copie o código PIX</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {pixData?.copy_paste && (
            <div className="bg-muted rounded-xl p-4 mb-5">
              <p className="text-xs text-foreground font-mono break-all">{pixData.copy_paste}</p>
            </div>
          )}

          <button
            onClick={handleCopyPix}
            className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Copy className="w-5 h-5" />
            {copied ? "Copiado!" : "Copiar Código PIX"}
          </button>

          <div className="mt-8 space-y-1">
            <p className="font-bold text-foreground text-sm">🎁 Como doar:</p>
            <ol className="text-sm text-foreground space-y-1 list-decimal list-inside">
              <li>Toque em Copiar Código PIX</li>
              <li>Abra seu app do banco</li>
              <li>Vá em PIX → Copia e Cola</li>
              <li>Cole o código e confirme 💚</li>
            </ol>
          </div>

          <div className="flex items-center justify-center mt-8">
            <img src={seloSeguranca} alt="Selo de Segurança" className="h-10" loading="eager" fetchPriority="high" decoding="sync" />
          </div>
        </div>
      </div>
    );
  }

  /* ===================== TURBINE MODAL ===================== */
  if (step === "turbine") {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center">
        <div className="bg-background w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-6 animate-in slide-in-from-bottom">
          <div className="flex justify-center mb-5">
            <img src={logo} alt="Vakinha" className="h-10" loading="eager" fetchPriority="high" decoding="sync" />
          </div>
          <h3 className="text-center text-lg font-bold text-foreground mb-1">
            Turbine sua doação! 💚
          </h3>
          <p className="text-center text-sm text-muted-foreground mb-6">
            Você pode ajudar MUITO MAIS adicionando um dos itens abaixo:
          </p>

          <div className="space-y-3 mb-5">
            {TURBINE_OPTIONS.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleSelectTurbine(i)}
                disabled={loading}
                className="w-full flex items-center justify-between p-4 border border-border rounded-xl hover:border-primary transition-colors"
              >
                <div className="flex items-center gap-3">
                  <opt.icon className="w-6 h-6 text-primary" />
                  <span className="font-semibold text-foreground text-sm">{opt.label}</span>
                </div>
                <span className="text-primary font-bold text-sm">+R$ {opt.price.toFixed(2).replace(".", ",")}</span>
              </button>
            ))}
          </div>

          <button
            onClick={handleSkipTurbine}
            disabled={loading}
            className="w-full py-3.5 bg-muted text-muted-foreground rounded-xl text-sm font-medium hover:bg-muted/80 transition-colors"
          >
            {loading ? "Processando..." : `Não, obrigado. Continuar com R$ ${amount.toFixed(2).replace(".", ",")}`}
          </button>
        </div>
      </div>
    );
  }

  /* ===================== VALUE SELECTION ===================== */
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-5 py-6">
        {/* Honeypot anti-bot: invisível para usuários; bots que preenchem tudo o preenchem e o backend bloqueia. */}
        <input
          type="text"
          name={HONEYPOT_FIELD_NAME}
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          className="absolute opacity-0 pointer-events-none h-0 w-0 overflow-hidden -left-[9999px]"
          style={{ position: "absolute" }}
        />

        {/* Back button */}
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        {/* Logo */}
        <div className="flex justify-center mb-10">
          <img src={logo} alt="Vakinha" className="h-12" loading="eager" fetchPriority="high" decoding="sync" />
        </div>

        {/* Value section */}
        <h2 className="text-base font-bold text-foreground mb-5">Valor da contribuição</h2>

        {/* Custom amount input */}
        <div className="flex items-center border border-border rounded-xl mb-5 overflow-hidden">
          <span className="px-5 py-4 bg-muted text-muted-foreground font-bold text-sm border-r border-border">R$</span>
          <input
            type="text"
            inputMode="decimal"
            value={customAmount}
            onChange={handleCustomChange}
            placeholder="0,00"
            className="flex-1 px-5 py-4 text-foreground bg-background outline-none text-base font-semibold"
          />
        </div>

        {/* Preset values grid */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {PRESET_VALUES.map((val) => (
            <button
              key={val}
              onClick={() => handleSelectPreset(val)}
              className={`relative py-4 rounded-xl border text-sm font-bold transition-all ${
                amount === val
                  ? "border-primary text-primary bg-primary/5 shadow-sm"
                  : "border-border text-foreground hover:border-primary/50"
              }`}
            >
              R$ {val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              {val === 100 && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] px-2.5 py-0.5 rounded-full font-extrabold whitespace-nowrap">
                  Doe com Amor 💛
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Payment method */}
        <h3 className="text-base font-bold text-foreground mb-3">Forma de pagamento</h3>
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 border-2 border-primary rounded-full px-5 py-2.5 text-primary text-sm font-bold bg-primary/5">
            <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-extrabold">$</div>
            PIX
          </div>
        </div>

        {/* Turbine section */}
        <h3 className="text-base font-bold text-foreground mb-1">Turbine sua doação</h3>
        <p className="text-sm text-muted-foreground mb-4">Ajude MUITO MAIS turbinando sua doação 💚</p>

        <div className="grid grid-cols-3 gap-3 mb-8">
          {TURBINE_OPTIONS.map((opt, i) => (
            <button
              key={i}
              onClick={() => setSelectedTurbine(selectedTurbine === i ? null : i)}
              className={`flex flex-col items-center p-4 rounded-xl border transition-all ${
                selectedTurbine === i
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                selectedTurbine === i ? "bg-primary/10" : "bg-muted"
              }`}>
                <opt.icon className={`w-6 h-6 ${selectedTurbine === i ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <span className="text-xs text-foreground font-semibold text-center leading-tight">{opt.label}</span>
              <span className="text-primary font-bold text-xs mt-1.5">+R$ {opt.price.toFixed(2).replace(".", ",")}</span>
            </button>
          ))}
        </div>

        {/* Summary */}
        <div className="space-y-2 mb-5 border-t border-border pt-5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Contribuição:</span>
            <span className="text-foreground font-semibold">R$ {amount.toFixed(2).replace(".", ",")}</span>
          </div>
          {selectedTurbine !== null && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Turbinar:</span>
              <span className="text-foreground font-semibold">R$ {TURBINE_OPTIONS[selectedTurbine].price.toFixed(2).replace(".", ",")}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-extrabold pt-1">
            <span className="text-foreground">Total:</span>
            <span className="text-primary">R$ {totalAmount.toFixed(2).replace(".", ",")}</span>
          </div>
        </div>

        {/* Contribute button (oculto em modo simplificado para bots/crawlers) */}
        {simplifiedMode ? (
          <div
            className="w-full bg-muted text-muted-foreground py-4 rounded-xl font-medium text-base text-center mb-5"
            role="status"
          >
            Para doar, acesse por um navegador comum. Não é possível gerar PIX nesta visualização.
          </div>
        ) : (
          <button
            onClick={handleContribute}
            disabled={loading || amount < 1}
            className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-extrabold text-base disabled:opacity-50 hover:opacity-90 transition-opacity mb-5"
          >
            {loading ? "PROCESSANDO..." : "CONTRIBUIR"}
          </button>
        )}

        {/* Supporters */}
        <div className="flex items-center justify-center gap-1 mb-4">
          <div className="flex -space-x-2">
            {[avatar1, avatar2, avatar3, avatar4, avatar5].map((src, i) => (
              <img
                key={i}
                src={src}
                alt="Apoiador"
                className="w-8 h-8 rounded-full border-2 border-background object-cover"
                loading="eager"
                fetchPriority="high"
                decoding="sync"
              />
            ))}
          </div>
          <span className="text-sm text-muted-foreground ml-2">+1.542 apoiadores</span>
        </div>

        <p className="text-xs text-center text-muted-foreground mb-6">
          Ao clicar no botão acima você declara que é maior de 18 anos, leu e está de acordo com os{" "}
          <span className="text-primary font-semibold cursor-pointer">Termos, Taxas e Prazos</span>.
        </p>

        {/* Security badge */}
        <div className="border border-border rounded-xl p-5 flex items-center gap-3 mb-5">
          <img src={seloSeguranca} alt="Selo de Segurança" className="h-10 flex-shrink-0" loading="eager" fetchPriority="high" decoding="sync" />
        </div>

        <p className="text-xs text-center text-muted-foreground pb-8">
          Informamos que o preenchimento do seu cadastro completo estará disponível em seu painel pessoal na plataforma após a conclusão desta doação.
        </p>
      </div>
    </div>
  );
};

export default DonationPage;
