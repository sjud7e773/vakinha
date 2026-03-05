import logo from "@/assets/logo.png";
import seloSeguranca from "@/assets/selo-seguranca.png";
import googlePlay from "@/assets/google-play.jpg";
import appStore from "@/assets/app-store.jpg";
import { Instagram, Facebook, Youtube } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-[hsl(var(--vakinha-dark))] text-[hsl(0,0%,75%)] pt-12 pb-6">
      <div className="max-w-5xl mx-auto px-4">
        {/* Top: Logo + Social Icons */}
        <div className="flex items-center justify-between mb-10">
          <img src={logo} alt="Vakinha" className="h-10 brightness-0 invert" loading="eager" fetchPriority="high" decoding="sync" />
          <div className="flex items-center gap-3">
            <a href="#" className="hover:text-white transition-colors"><Instagram className="w-5 h-5" /></a>
            <span className="text-[hsl(0,0%,40%)]">|</span>
            <a href="#" className="hover:text-white transition-colors"><Facebook className="w-5 h-5" /></a>
            <span className="text-[hsl(0,0%,40%)]">|</span>
            <a href="#" className="hover:text-white transition-colors"><Youtube className="w-5 h-5" /></a>
            <span className="text-[hsl(0,0%,40%)]">|</span>
            <a href="#" className="hover:text-white transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <span className="text-[hsl(0,0%,40%)]">|</span>
            <a href="#" className="hover:text-white transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61.01 3.91.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
            </a>
          </div>
        </div>

        {/* Main grid: Links + Contact + App */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          {/* Links rápidos */}
          <div>
            <h4 className="text-primary font-bold text-sm mb-4">Links rápidos</h4>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
              <a href="#" className="hover:text-white transition-colors">Quem somos</a>
              <a href="#" className="hover:text-white transition-colors">Dúvidas frequentes</a>
              <a href="#" className="hover:text-white transition-colors">Vaquinhas</a>
              <a href="#" className="hover:text-white transition-colors">Taxas e prazos</a>
              <a href="#" className="hover:text-white transition-colors">Criar vaquinhas</a>
              <a href="#" className="hover:text-white transition-colors">Loja de corações</a>
              <a href="#" className="hover:text-white transition-colors">Login</a>
              <a href="#" className="hover:text-white transition-colors">Vakinha Premiada</a>
              <a href="#" className="hover:text-white transition-colors">Vaquinhas mais amadas</a>
              <a href="#" className="hover:text-white transition-colors">Blog do Vakinha</a>
              <a href="#" className="hover:text-white transition-colors">Política de privacidade</a>
              <a href="#" className="hover:text-white transition-colors">Mapa de posts do blog</a>
              <a href="#" className="hover:text-white transition-colors">Termos de uso</a>
              <a href="#" className="hover:text-white transition-colors">Segurança e transparência</a>
              <a href="#" className="hover:text-white transition-colors">Verificação de links</a>
              <a href="#" className="hover:text-white transition-colors">Busca por recibo</a>
            </div>
          </div>

          {/* Fale conosco */}
          <div>
            <h4 className="text-primary font-bold text-sm mb-4">Fale conosco</h4>
            <div className="text-sm space-y-2.5">
              <a href="#" className="block font-semibold text-[hsl(0,0%,90%)] hover:text-white transition-colors">Clique aqui para falar conosco</a>
              <p>De Segunda à Sexta</p>
              <p>Das 9:30 às 17:00</p>
            </div>
            <div className="mt-5">
              <img src={seloSeguranca} alt="Selo de Segurança" className="h-12" loading="eager" fetchPriority="high" decoding="sync" />
            </div>
          </div>

          {/* Baixe nosso App */}
          <div>
            <h4 className="text-primary font-bold text-sm mb-4">Baixe nosso App</h4>
            <div className="flex flex-col gap-3">
              <a href="#"><img src={googlePlay} alt="Disponível no Google Play" className="h-10" loading="eager" decoding="sync" /></a>
              <a href="#"><img src={appStore} alt="Baixar na App Store" className="h-10" loading="eager" decoding="sync" /></a>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-[hsl(0,0%,25%)] pt-6 text-center text-sm">
          © 2026 - Todos direitos reservados
        </div>
      </div>
    </footer>
  );
};

export default Footer;
