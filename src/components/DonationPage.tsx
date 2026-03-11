import { useState, useMemo } from "react";
import { ArrowLeft, Heart, Gift, ShoppingBasket, Copy, Clock, CheckCircle } from "lucide-react";
import avatar1 from "@/assets/avatar-1.jpg";
import avatar2 from "@/assets/avatar-2.jpg";
import avatar3 from "@/assets/avatar-3.jpg";
import avatar4 from "@/assets/avatar-4.jpg";
import avatar5 from "@/assets/avatar-5.jpg";
import seloSeguranca from "@/assets/selo-seguranca.png";
import logo from "@/assets/logo.png";
import { useToast } from "@/hooks/use-toast";
import { shouldShowSimplifiedDonationPage } from "@/lib/donation-security";
import { createChargePix } from "@/lib/hoopay-direct";

const PRESET_VALUES = [20, 30, 50, 75, 100, 200, 500, 750, 1000];

const TURBINE_OPTIONS = [
  { icon: Heart, label: "10 corações", price: 10 },
  { icon: Gift, label: "Ajudar Uma Vida a Florescer", price: 25 },
  { icon: ShoppingBasket, label: "Doar cesta básica", price: 65 },
];

type Step = "value" | "turbine" | "pix" | "thankyou";

interface PixData {
  qr_code_base64: string | null;
  copy_paste: string | null;
  expires_at: string | null;
}

interface DonationPageProps {
  onBack: () => void;
}

const HONEYPOT_FIELD_NAME = "website";
const MIN_AMOUNT = 10;
const MAX_AMOUNT = 100_000;

function validateAmount(amount: number): { valid: boolean; error?: string } {
  if (typeof amount !== "number" || Number.isNaN(amount)) return { valid: false, error: "Valor inválido." };
  if (amount < MIN_AMOUNT) return { valid: false, error: `Valor mínimo é R$ ${MIN_AMOUNT.toFixed(2).replace(".", ",")}` };
  if (amount > MAX_AMOUNT) return { valid: false, error: "Valor máximo excedido." };
  return { valid: true };
}

const DonationPage = ({ onBack }: DonationPageProps) => {
  const [step, setStep] = useState<Step>("value");
  const [amount, setAmount] = useState<number>(0);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedTurbine, setSelectedTurbine] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [countdown, setCountdown] = useState(180);
  const [copied, setCopied] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const { toast } = useToast();

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
    // Valida o VALOR TOTAL (doação + turbina), não apenas o valor base
    if (totalAmount < MIN_AMOUNT) {
      toast({ title: `Valor mínimo total é R$ ${MIN_AMOUNT.toFixed(2).replace(".", ",")}`, variant: "destructive" });
      return;
    }
    if (selectedTurbine === null) setStep("turbine");
    else processPayment();
  };

  const handleSkipTurbine = () => processPayment();

  const handleSelectTurbine = (index: number) => {
    setSelectedTurbine(index);
    processPayment(TURBINE_OPTIONS[index].price);
  };

  const processPayment = async (extraAmount = 0) => {
    setLoading(true);
    try {
      const finalAmount = amount + (selectedTurbine !== null ? TURBINE_OPTIONS[selectedTurbine].price : 0) + extraAmount;

      const validation = validateAmount(finalAmount);
      if (!validation.valid) {
        toast({ title: validation.error, variant: "destructive" });
        return;
      }

      const result = await createChargePix(finalAmount);

      if (result.success && (result.qr_code_base64 || result.copy_paste)) {
        setPixData({
          qr_code_base64: result.qr_code_base64 ?? null,
          copy_paste: result.copy_paste ?? null,
          expires_at: result.expires_at ?? null,
        });
        setStep("pix");
        startCountdown();
      } else {
        throw new Error(result.error ?? "Não foi possível gerar o PIX. Tente novamente.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Tente novamente.";
      if (import.meta.env.DEV) console.error("[DonationPage] Payment error:", err);
      toast({ title: "Erro ao processar pagamento", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const startCountdown = () => {
    setCountdown(180);
    const interval = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
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

  if (step === "thankyou") {
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
            <h2 className="text-xl font-bold text-foreground mb-2">Obrigado pela sua doação! 💚</h2>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm">
              Sua contribuição de <strong className="text-foreground">R$ {totalAmount.toFixed(2).replace(".", ",")}</strong> ajuda a transformar vidas.
            </p>
            <button onClick={onBack} className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-extrabold hover:opacity-90 transition-opacity">
              Voltar à campanha
            </button>
          </div>
          <div className="flex justify-center mt-10">
            <img src={seloSeguranca} alt="Selo de Segurança" className="h-10" loading="eager" decoding="sync" />
          </div>
        </div>
      </div>
    );
  }

  if (step === "pix") {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-lg mx-auto px-5 py-6">
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <div className="flex justify-center mb-8">
            <img src={logo} alt="Vakinha" className="h-12" loading="eager" decoding="sync" />
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
          <button onClick={handleCopyPix} className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity mb-3">
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
          <div className="flex justify-center mt-8">
            <img src={seloSeguranca} alt="Selo" className="h-10" loading="eager" decoding="sync" />
          </div>
        </div>
      </div>
    );
  }

  if (step === "turbine") {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
        <div className="bg-background w-full max-w-lg rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-center mb-5">
            <img src={logo} alt="Vakinha" className="h-10" loading="eager" decoding="sync" />
          </div>
          <h3 className="text-center text-lg font-bold text-foreground mb-1">Turbine sua doação! 💚</h3>
          <p className="text-center text-sm text-muted-foreground mb-6">
            Você pode ajudar MUITO MAIS adicionando um dos itens abaixo:
          </p>
          <div className="space-y-3 mb-5">
            {TURBINE_OPTIONS.map((opt, i) => (
              <button key={i} onClick={() => handleSelectTurbine(i)} disabled={loading} className="w-full flex items-center justify-between p-4 border border-border rounded-xl hover:border-primary transition-colors">
                <div className="flex items-center gap-3">
                  <opt.icon className="w-6 h-6 text-primary" />
                  <span className="font-semibold text-foreground text-sm">{opt.label}</span>
                </div>
                <span className="text-primary font-bold text-sm">+R$ {opt.price.toFixed(2).replace(".", ",")}</span>
              </button>
            ))}
          </div>
          <button onClick={handleSkipTurbine} disabled={loading} className="w-full py-3.5 bg-muted text-muted-foreground rounded-xl text-sm font-medium hover:bg-muted/80">
            {loading ? "Processando..." : `Não, obrigado. Continuar com R$ ${amount.toFixed(2).replace(".", ",")}`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-5 py-6">
        <input type="text" name={HONEYPOT_FIELD_NAME} value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="absolute opacity-0 pointer-events-none h-0 w-0 overflow-hidden -left-[9999px]" />
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="flex justify-center mb-10">
          <img src={logo} alt="Vakinha" className="h-12" loading="eager" decoding="sync" />
        </div>
        <h2 className="text-base font-bold text-foreground mb-5">Valor da contribuição</h2>
        <div className="flex items-center border border-border rounded-xl mb-5 overflow-hidden">
          <span className="px-5 py-4 bg-muted text-muted-foreground font-bold text-sm border-r border-border">R$</span>
          <input type="text" inputMode="decimal" value={customAmount} onChange={handleCustomChange} placeholder="0,00" className="flex-1 px-5 py-4 text-foreground bg-background outline-none text-base font-semibold" />
        </div>
        <div className="grid grid-cols-3 gap-3 mb-8 overflow-visible">
          {PRESET_VALUES.map((val) => (
            <button key={val} onClick={() => handleSelectPreset(val)} className={`relative py-4 rounded-xl border text-sm font-bold transition-all overflow-visible ${amount === val ? "border-primary text-primary bg-primary/5" : "border-border text-foreground hover:border-primary/50"}`}>
              R$ {val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              {val === 100 && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-primary text-primary-foreground text-[10px] px-2.5 py-0.5 rounded-full font-extrabold z-10">Doe com Amor 💛</span>}
            </button>
          ))}
        </div>
        <h3 className="text-base font-bold text-foreground mb-3">Forma de pagamento</h3>
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 border-2 border-primary rounded-full px-5 py-2.5 text-primary text-sm font-bold bg-primary/5">
            <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-extrabold">$</div>
            PIX
          </div>
        </div>
        <h3 className="text-base font-bold text-foreground mb-1">Turbine sua doação</h3>
        <p className="text-sm text-muted-foreground mb-4">Ajude MUITO MAIS turbinando sua doação 💚</p>
        <div className="grid grid-cols-3 gap-3 mb-8">
          {TURBINE_OPTIONS.map((opt, i) => (
            <button key={i} onClick={() => setSelectedTurbine(selectedTurbine === i ? null : i)} className={`flex flex-col items-center p-4 rounded-xl border transition-all ${selectedTurbine === i ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${selectedTurbine === i ? "bg-primary/10" : "bg-muted"}`}>
                <opt.icon className={`w-6 h-6 ${selectedTurbine === i ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <span className="text-xs text-foreground font-semibold text-center">{opt.label}</span>
              <span className="text-primary font-bold text-xs mt-1.5">+R$ {opt.price.toFixed(2).replace(".", ",")}</span>
            </button>
          ))}
        </div>
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
        {simplifiedMode ? (
          <div className="w-full bg-muted text-muted-foreground py-4 rounded-xl font-medium text-center mb-5">Para doar, acesse por um navegador comum.</div>
        ) : (
          <button onClick={handleContribute} disabled={loading || totalAmount < MIN_AMOUNT} className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-extrabold disabled:opacity-50 hover:opacity-90 transition-opacity mb-5">
            {loading ? "PROCESSANDO..." : "CONTRIBUIR"}
          </button>
        )}
        <div className="flex items-center justify-center gap-1 mb-4">
          <div className="flex -space-x-2">
            {[avatar1, avatar2, avatar3, avatar4, avatar5].map((src, i) => (
              <img key={i} src={src} alt="Apoiador" className="w-8 h-8 rounded-full border-2 border-background object-cover" loading="eager" decoding="sync" />
            ))}
          </div>
          <span className="text-sm text-muted-foreground ml-2">+1.542 apoiadores</span>
        </div>
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="text-xs text-muted-foreground">Valor mínimo total: R$ 10,00 (doação + turbina)</span>
        </div>
        <p className="text-xs text-center text-muted-foreground mb-6">
          Ao clicar no botão acima você declara que é maior de 18 anos e está de acordo com os <span className="text-primary font-semibold cursor-pointer">Termos</span>.
        </p>
        <div className="border border-border rounded-xl p-5 flex items-center justify-center gap-3 mb-5">
          <img src={seloSeguranca} alt="Selo de Segurança" className="h-10 flex-shrink-0" loading="eager" decoding="sync" />
        </div>
        <p className="text-xs text-center text-muted-foreground pb-8">Informamos que o preenchimento estará disponível após a conclusão desta doação.</p>
      </div>
    </div>
  );
};

export default DonationPage;
