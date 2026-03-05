import logo from "@/assets/logo.png";
import { Search, Menu, ChevronDown, X } from "lucide-react";
import { useState } from "react";

interface HeaderProps {
  onDonate?: () => void;
}

const DROPDOWNS = {
  "Como ajudar": ["Vaquinhas", "Causas", "ONGs"],
  "Descubra": ["Mais amadas", "Soluções para ONGs", "Eventos do Vakinha", "Blog"],
  "Como funciona": ["O Vakinha", "Corações do Vakinha", "Vakinha Premiada", "Segurança e Transparência", "Equipes"],
} as const;

type DropdownKey = keyof typeof DROPDOWNS;

const Header = ({ onDonate }: HeaderProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileDropdown, setMobileDropdown] = useState<DropdownKey | null>(null);

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-[72px]">
        <img src={logo} alt="Vakinha" className="h-10 md:h-14" loading="eager" fetchPriority="high" decoding="sync" />

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-8 text-[15px] font-bold text-foreground">
          {(Object.keys(DROPDOWNS) as DropdownKey[]).map((label) => (
            <div key={label} className="relative group">
              <button className="flex items-center gap-1 hover:text-primary transition-colors py-6">
                {label} <ChevronDown className="w-4 h-4 transition-transform duration-200 group-hover:rotate-180" />
              </button>
              <div className="absolute top-full left-0 pt-0 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200 z-50">
                <div className="bg-background border border-border rounded-lg shadow-lg py-2 min-w-[200px]">
                  {DROPDOWNS[label].map((item) => (
                    <button
                      key={item}
                      className="block w-full text-left px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-5">
          <button className="flex items-center gap-1.5 text-[15px] font-bold text-primary hover:opacity-80 transition-opacity">
            Buscar <Search className="w-4 h-4" />
          </button>
          <button className="text-[15px] font-bold text-primary hover:opacity-80 transition-opacity">
            Minha conta
          </button>
          <button onClick={onDonate} className="bg-primary text-primary-foreground px-6 py-2.5 rounded-full font-extrabold text-[15px] hover:opacity-90 transition-opacity">
            Faz uma vaquinha!
          </button>
        </div>

        {/* Mobile menu button */}
        <button
          className="lg:hidden p-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-background border-t border-border p-4 space-y-1">
          {(Object.keys(DROPDOWNS) as DropdownKey[]).map((label) => (
            <div key={label}>
              <button
                onClick={() => setMobileDropdown(mobileDropdown === label ? null : label)}
                className="flex items-center justify-between w-full py-2 font-semibold"
              >
                {label}
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${mobileDropdown === label ? "rotate-180" : ""}`} />
              </button>
              {mobileDropdown === label && (
                <div className="pl-4 pb-2 space-y-1">
                  {DROPDOWNS[label].map((item) => (
                    <button key={item} className="block w-full text-left py-1.5 text-sm text-muted-foreground hover:text-foreground">
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          <button className="block w-full text-left py-2 text-primary font-semibold">Buscar</button>
          <button className="block w-full text-left py-2 text-primary font-semibold">Minha conta</button>
          <button onClick={() => { setMobileMenuOpen(false); onDonate?.(); }} className="w-full bg-primary text-primary-foreground py-3 rounded-full font-bold text-sm mt-2">
            Faz uma vaquinha!
          </button>
        </div>
      )}
    </header>
  );
};

export default Header;
