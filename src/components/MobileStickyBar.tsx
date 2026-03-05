import { Heart, Share2, Check } from "lucide-react";

interface MobileStickyBarProps {
  onDonate: () => void;
}

const MobileStickyBar = ({ onDonate }: MobileStickyBarProps) => {
  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: "Patas Fora da Corrente",
        text: "Ajude o abrigo Patas Fora da Corrente a se reerguer!",
        url: window.location.href,
      });
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border px-4 py-3 lg:hidden">
      <div className="flex items-center justify-center gap-2 mb-2">
        <Check className="w-4 h-4 text-primary" />
        <span className="text-xs font-bold text-primary tracking-wide">DOAÇÃO PROTEGIDA</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onDonate}
          className="flex-1 bg-primary text-primary-foreground py-3.5 rounded-lg font-bold text-base flex items-center justify-center gap-2"
        >
          <Heart className="w-5 h-5" />
          Quero Ajudar
        </button>
        <button
          onClick={handleShare}
          className="w-12 h-12 border-2 border-border rounded-lg flex items-center justify-center"
        >
          <Share2 className="w-5 h-5 text-foreground" />
        </button>
      </div>
    </div>
  );
};

export default MobileStickyBar;
