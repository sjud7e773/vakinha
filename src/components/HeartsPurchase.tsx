import { useState } from "react";
import { X, Heart, Minus, Plus, Copy, Clock, CheckCircle, ArrowLeft } from "lucide-react";
import { createChargePix } from "@/lib/hoopay-direct";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import seloSeguranca from "@/assets/selo-seguranca.png";

const HEART_PLANS = [
  {
    id: 1,
    quantity: 1,
    price: 4.99,
    label: "Coração",
    description: "Corações para você destacar sua vaquinha.",
    isBestDeal: false,
  },
  {
    id: 2,
    quantity: 15,
    price: 19.99,
    label: "15 Corações",
    description: "Corações para você destacar sua vaquinha.",
    isBestDeal: false,
  },
  {
    id: 3,
    quantity: 100,
    price: 59.99,
    label: "100 Corações",
    description: "Corações para você destacar sua vaquinha.",
    isBestDeal: true,
  },
];

type Step = "plans" | "checkout" | "pix" | "thankyou";

interface PixData {
  qr_code_base64: string | null;
  copy_paste: string | null;
  expires_at: string | null;
}

interface HeartsPurchaseProps {
  isOpen: boolean;
  onClose: () => void;
}

const HeartsPurchase = ({ isOpen, onClose }: HeartsPurchaseProps) => {
  const [step, setStep] = useState<Step>("plans");
  const [selectedPlan, setSelectedPlan] = useState<(typeof HEART_PLANS)[0] | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [countdown, setCountdown] = useState(180);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleSelectPlan = (plan: (typeof HEART_PLANS)[0]) => {
    setSelectedPlan(plan);
    setQuantity(1);
    setStep("checkout");
  };

  const handleQuantityChange = (delta: number) => {
    const newQty = quantity + delta;
    if (newQty >= 1 && newQty <= 10) {
      setQuantity(newQty);
    }
  };

  const totalAmount = selectedPlan ? selectedPlan.price * quantity : 0;

  const handleBuy = async () => {
    if (!selectedPlan) return;

    setLoading(true);
    try {
      // Corações não têm valor mínimo - usam o preço exato do plano
      const result = await createChargePix(totalAmount, { 
        isHeartPurchase: true, 
        heartPlanId: selectedPlan.id 
      });

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
      toast({ title: "Erro ao processar pagamento", description: message, variant: "destructive" });
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

  const handlePaymentConfirmed = async () => {
    if (!selectedPlan) return;

    try {
      // Use RPC for atomic increment to prevent race conditions
      const heartsToAdd = selectedPlan.quantity * quantity;
      const amountToAdd = totalAmount;
      
      // Call the RPC function to atomically update stats
      const { error: rpcError } = await supabase.rpc("increment_campaign_stats", {
        hearts_to_add: heartsToAdd,
        amount_to_add: amountToAdd,
      });
      
      if (rpcError) {
        console.error("[HeartsPurchase] RPC error:", rpcError);
        // Fallback to direct update with retry logic
        await updateStatsWithRetry(heartsToAdd, amountToAdd);
      }

      setStep("thankyou");
    } catch (error) {
      console.error("[HeartsPurchase] Error updating stats:", error);
      // Still show thank you even if update fails
      setStep("thankyou");
    }
  };

  // Fallback function with retry logic for race condition prevention
  const updateStatsWithRetry = async (heartsToAdd: number, amountToAdd: number, maxRetries = 3): Promise<void> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Get current stats
        const { data: currentStats, error: fetchError } = await supabase
          .from("campaign_stats")
          .select("heart_count, total_raised")
          .eq("id", 1)
          .single();
        
        if (fetchError) throw fetchError;

        const newHeartCount = (currentStats?.heart_count ?? 0) + heartsToAdd;
        const newTotalRaised = (currentStats?.total_raised ?? 0) + amountToAdd;

        const { error: updateError } = await supabase
          .from("campaign_stats")
          .update({
            heart_count: newHeartCount,
            total_raised: newTotalRaised,
            updated_at: new Date().toISOString(),
          })
          .eq("id", 1);

        if (!updateError) return; // Success
        throw updateError;
      } catch (error) {
        if (attempt === maxRetries) {
          console.error("[HeartsPurchase] Failed to update stats after retries:", error);
          throw error;
        }
        // Exponential backoff
        await new Promise(r => setTimeout(r, 100 * Math.pow(2, attempt - 1)));
      }
    }
  };

  const handleClose = () => {
    setStep("plans");
    setSelectedPlan(null);
    setQuantity(1);
    setPixData(null);
    onClose();
  };

  if (!isOpen) return null;

  // Plans Selection Screen
  if (step === "plans") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="relative w-full max-w-[420px] bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content */}
          <div className="p-6">
            {/* Heart icon */}
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Heart className="w-6 h-6 text-primary fill-primary" />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-center text-lg font-bold text-gray-900 mb-1">
              Você não possui mais corações!
            </h2>
            <p className="text-center text-sm text-gray-600 mb-6">
              Escolha e compre um pacote de corações:
            </p>

            {/* Plans */}
            <div className="space-y-3">
              {HEART_PLANS.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => handleSelectPlan(plan)}
                  className="w-full flex items-center justify-between p-4 border-2 border-gray-200 rounded-xl hover:border-primary transition-all bg-white"
                >
                  <div className="flex items-center gap-3">
                    {/* Heart icon with quantity */}
                    <div className="relative">
                      <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                        <Heart className="w-6 h-6 text-white" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        x{plan.quantity}
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-gray-900 text-sm">{plan.label}</p>
                      <p className="text-xs text-gray-500">{plan.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {plan.isBestDeal && (
                      <span className="bg-primary text-white text-[10px] font-bold px-2 py-1 rounded-full">
                        Melhor oferta
                      </span>
                    )}
                    <span className="font-bold text-primary text-sm">
                      R$ {plan.price.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Checkout Screen
  if (step === "checkout") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="relative w-full max-w-[480px] bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center gap-3">
            <button
              onClick={() => setStep("plans")}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Voltar</span>
            </button>
            <div className="flex-1 flex justify-center">
              <img src={logo} alt="Vakinha" className="h-8" />
            </div>
            <div className="w-16" />
          </div>

          {/* Banner */}
          <div className="bg-primary/10 px-4 py-3 flex items-center justify-center gap-2">
            <span className="text-primary text-sm">🍀</span>
            <p className="text-sm text-primary font-medium text-center">
              Finalize e ganhe {selectedPlan?.quantity} NÚMEROS DA SORTE para concorrer no{" "}
              <span className="font-bold underline">Vakinha Premiada</span>
            </p>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Selected Plan */}
            <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-14 h-14 bg-primary rounded-lg flex items-center justify-center">
                    <Heart className="w-7 h-7 text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-primary text-white text-xs font-bold px-2 py-0.5 rounded">
                    x{selectedPlan?.quantity}
                  </div>
                </div>
                <div>
                  <p className="font-bold text-gray-900">{selectedPlan?.label}</p>
                </div>
              </div>
              <span className="font-bold text-primary text-lg">
                R$ {selectedPlan?.price.toFixed(2).replace(".", ",")}
              </span>
            </div>

            {/* Quantity */}
            <div className="flex items-center justify-center gap-4 mb-8">
              <button
                onClick={() => handleQuantityChange(-1)}
                disabled={quantity <= 1}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-xl font-bold w-8 text-center">{quantity}</span>
              <button
                onClick={() => handleQuantityChange(1)}
                disabled={quantity >= 10}
                className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Title */}
            <h2 className="text-lg font-bold text-gray-900 mb-6">Finalize sua compra:</h2>

            {/* Order Summary */}
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  {quantity}x {selectedPlan?.label}
                </span>
                <span className="font-semibold text-gray-900">
                  R$ {totalAmount.toFixed(2).replace(".", ",")}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2">
                <span className="text-gray-900">Total:</span>
                <span className="text-gray-900">
                  R$ {totalAmount.toFixed(2).replace(".", ",")}
                </span>
              </div>
            </div>

            {/* Terms */}
            <p className="text-xs text-gray-500 mt-4 mb-6">
              Ao clicar no botão abaixo você declara que é maior de 18 anos, leu e está de acordo com os{" "}
              <span className="text-primary font-semibold cursor-pointer">Termos, Taxas, Prazos e Regulamentos</span>.
            </p>

            {/* Payment Method - PIX only */}
            <div className="mb-6">
              <p className="text-sm font-semibold text-gray-900 mb-3">Forma de pagamento</p>
              <div className="inline-flex items-center gap-2 bg-primary text-white rounded-full px-4 py-2">
                <div className="w-5 h-5 rounded-full bg-white text-primary flex items-center justify-center text-xs font-bold">
                  $
                </div>
                <span className="font-bold text-sm">PIX</span>
              </div>
            </div>

            {/* Buy Button */}
            <button
              onClick={handleBuy}
              disabled={loading}
              className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Processando..." : "Finalizar Compra"}
            </button>
          </div>

          {/* Footer */}
          <div className="bg-gray-900 p-6">
            <div className="flex justify-center">
              <img src={seloSeguranca} alt="Selo de Segurança" className="h-10" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // PIX Screen
  if (step === "pix") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="relative w-full max-w-[480px] bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center gap-3">
            <button
              onClick={() => setStep("checkout")}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Voltar</span>
            </button>
            <div className="flex-1 flex justify-center">
              <img src={logo} alt="Vakinha" className="h-8" />
            </div>
            <div className="w-16" />
          </div>

          {/* Content */}
          <div className="p-6">
            <h2 className="text-center text-lg font-bold text-gray-900 mb-2">
              Pague R$ {totalAmount.toFixed(2).replace(".", ",")} e receba {selectedPlan?.quantity * quantity} corações 💚
            </h2>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-6">
              <Clock className="w-4 h-4" />
              <span>
                QR Code expira em:{" "}
                <strong className="text-gray-900">{formatCountdown()}</strong>
              </span>
            </div>

            {/* QR Code */}
            {pixData?.qr_code_base64 && (
              <div className="flex justify-center mb-5">
                <div className="border-2 border-gray-200 rounded-xl p-5 bg-white">
                  <img
                    src={`data:image/png;base64,${pixData.qr_code_base64}`}
                    alt="QR Code PIX"
                    className="w-52 h-52"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 text-sm text-primary mb-5">
              <div className="w-2 h-2 rounded-full bg-primary" />
              Escaneie o QR Code no app do seu banco
            </div>

            <div className="flex items-center gap-4 mb-5">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-sm text-gray-500">ou copie o código PIX</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {pixData?.copy_paste && (
              <div className="bg-gray-100 rounded-xl p-4 mb-5">
                <p className="text-xs text-gray-900 font-mono break-all">{pixData.copy_paste}</p>
              </div>
            )}

            <button
              onClick={handleCopyPix}
              className="w-full bg-primary text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              <Copy className="w-5 h-5" />
              {copied ? "Copiado!" : "Copiar Código PIX"}
            </button>

            <div className="mt-6 space-y-1">
              <p className="font-bold text-gray-900 text-sm">🎁 Como doar:</p>
              <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                <li>Toque em Copiar Código PIX</li>
                <li>Abra seu app do banco</li>
                <li>Vá em PIX → Copia e Cola</li>
                <li>Cole o código e confirme 💚</li>
              </ol>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-100">
            <div className="flex justify-center">
              <img src={seloSeguranca} alt="Selo" className="h-10" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Thank You Screen
  if (step === "thankyou") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="relative w-full max-w-[420px] bg-white rounded-2xl shadow-2xl overflow-hidden p-6">
          <div className="flex justify-center mb-8">
            <img src={logo} alt="Vakinha" className="h-10" />
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <CheckCircle className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Obrigado pela sua compra! 💚
            </h2>
            <p className="text-gray-500 text-sm mb-6 max-w-sm">
              Você adquiriu{" "}
              <strong className="text-gray-900">
                {selectedPlan?.quantity && quantity ? selectedPlan.quantity * quantity : 0} corações
              </strong>{" "}
              para destacar esta vaquinha.
            </p>
            <button
              onClick={handleClose}
              className="w-full bg-primary text-white py-4 rounded-xl font-bold hover:opacity-90 transition-opacity"
            >
              Voltar à campanha
            </button>
          </div>

          <div className="flex justify-center mt-8">
            <img src={seloSeguranca} alt="Selo de Segurança" className="h-10" />
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default HeartsPurchase;
