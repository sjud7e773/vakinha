import { useState } from "react";
import { Heart, Share2, Check, ChevronDown, ChevronUp, MapPin, Star, Zap, Award, Trophy } from "lucide-react";
import heroImage from "@/assets/hero-image.jpg";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const TABS = ["Sobre", "Atualizações", "Quem ajudou", "Vakinha Premiada", "Selos recebidos"] as const;
type TabType = typeof TABS[number];

const FAQ_ITEMS = [
  {
    question: "Como ajudar Patas Fora da Corrente?",
    answer: "Você pode ajudar fazendo uma doação diretamente nesta página clicando no botão 'Quero Ajudar'. Também aceitamos doações via PIX, transferência bancária ou doações de ração, medicamentos e materiais de construção para reconstruir o abrigo."
  },
  {
    question: "Quando a vaquinha foi criada?",
    answer: "Esta vaquinha foi criada em 27 de dezembro de 2025 com o objetivo de arrecadar fundos para manter o abrigo funcionando e cuidar dos 322 animais que dependem de nós. Agora, após a tempestade que destruiu parte do abrigo, a necessidade é ainda maior."
  },
  {
    question: "Qual a meta da vaquinha?",
    answer: "Nossa meta é arrecadar R$ 15.000 para reconstruir o abrigo danificado pela tempestade, comprar alimentos novos (o estoque foi destruído), pagar o tratamento veterinário dos animais feridos e cobrir os custos regulares de manutenção."
  },
  {
    question: "Quanto a vaquinha já arrecadou?",
    answer: "Até o momento, já arrecadamos R$ 1.498,00, o que representa 10% da nossa meta. Precisamos muito da sua ajuda para reconstruir o abrigo e cuidar dos animais feridos!"
  }
];

interface CampaignPageProps {
  onDonate?: () => void;
}

const CampaignPage = ({ onDonate }: CampaignPageProps) => {
  const [activeTab, setActiveTab] = useState<TabType>("Sobre");
  const [liked, setLiked] = useState(false);

  const raised = 1498;
  const goal = 15000;
  const progress = (raised / goal) * 100;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left column - Image & content */}
        <div className="flex-1 min-w-0">
          {/* Hero Image */}
          <div className="relative rounded-lg overflow-hidden mb-4">
            <img
              src={heroImage}
              alt="Abrigo Patas Fora da Corrente"
              className="w-full aspect-[4/3] object-cover"
              loading="eager"
              fetchPriority="high"
              decoding="sync"
            />
            <button
              onClick={() => setLiked(!liked)}
              className="absolute top-4 right-4 w-10 h-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors"
            >
              <Heart className={`w-5 h-5 ${liked ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
            </button>
          </div>

          {/* Category & Location */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
              ANIMAIS / PETS
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" /> BRASIL
            </span>
          </div>

          {/* Title */}
          <h1 className="text-xl md:text-2xl font-extrabold text-foreground leading-tight mb-4">
            Emergência no Abrigo Patas Fora da Corrente: tempestade destruiu tudo, precisamos nos reerguer! 🐾🆘
          </h1>

          {/* Description */}
          <div className="text-sm text-foreground leading-relaxed mb-6">
            <p className="mb-3">
              <strong>322 vidas inocentes dependem de nós.</strong> As fortes chuvas e ventanias destruíram parte do nosso abrigo, machucaram alguns dos nossos animais e acabaram com nosso estoque de alimentos. Estamos vivendo uma emergência e precisamos da sua ajuda urgente para nos reerguer…{" "}
              <button
                onClick={() => {
                  setActiveTab("Sobre");

                  setTimeout(() => {
                    const target = document.getElementById("sobre-start");
                    if (!target) return;

                    const headerOffset = window.innerWidth < 1024 ? 84 : 96;
                    const targetY = Math.max(
                      target.getBoundingClientRect().top + window.scrollY - headerOffset,
                      0,
                    );

                    const startY = window.scrollY;
                    const distance = targetY - startY;
                    const duration = 700;
                    const startTime = performance.now();

                    const easeInOutCubic = (t: number) =>
                      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

                    const step = (now: number) => {
                      const elapsed = now - startTime;
                      const progressValue = Math.min(elapsed / duration, 1);
                      const easedProgress = easeInOutCubic(progressValue);

                      window.scrollTo(0, startY + distance * easedProgress);

                      if (progressValue < 1) {
                        requestAnimationFrame(step);
                      }
                    };

                    requestAnimationFrame(step);
                  }, 60);
                }}
                className="text-primary font-semibold inline-flex items-center gap-1"
              >
                💜 ver tudo
              </button>
            </p>
          </div>

          {/* Tabs */}
          <div className="border-b border-border mb-6 overflow-x-auto">
            <div className="flex min-w-max">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === tab
                      ? "text-primary border-primary"
                      : "text-muted-foreground border-transparent hover:text-foreground"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div id="tab-content" className="mb-8">
            {activeTab === "Sobre" && <SobreTab />}
            {activeTab === "Atualizações" && <AtualizacoesTab />}
            {activeTab === "Quem ajudou" && <QuemAjudouTab />}
            {activeTab === "Vakinha Premiada" && <VakinhaPremiadaTab />}
            {activeTab === "Selos recebidos" && <SelosRecebidosTab />}
          </div>

          {/* FAQ */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-foreground mb-4">
              Tudo o que você precisa saber sobre o Vakinha
            </h2>
            <Accordion
              type="single"
              collapsible
              className="space-y-3"
            >
              {FAQ_ITEMS.map((item, i) => (
                <AccordionItem
                  key={i}
                  value={`item-${i}`}
                  className="border border-border rounded-lg px-6 py-1 data-[state=open]:border-border"
                >
                  <AccordionTrigger className="text-sm font-bold text-foreground hover:no-underline py-5">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>

        {/* Right column - Donation sidebar */}
        <div className="lg:w-[400px] flex-shrink-0">
          <div className="lg:sticky lg:top-24 space-y-4">
            {/* Progress Card */}
            <div className="bg-card border border-border rounded-lg p-6">
              <Progress value={progress} className="h-2 mb-5" />
              <p className="text-sm text-muted-foreground font-semibold">Arrecadado</p>
              <p className="text-4xl font-extrabold text-primary mt-1">
                R$ {raised.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-base text-muted-foreground mt-1">
                de R$ {goal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>

              <div className="mt-5 border-t border-border pt-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    Dê o primeiro coração <span>💚</span>
                  </span>
                  <button className="text-primary font-bold hover:underline">Comprar</button>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Apoiadores</span>
                  <span className="font-bold">3</span>
                </div>
              </div>

              <button onClick={onDonate} className="w-full mt-6 bg-primary text-primary-foreground py-4 rounded-xl font-extrabold text-lg hover:opacity-90 transition-opacity">
                Quero Ajudar
              </button>

              <button className="w-full mt-3 border-2 border-border py-3.5 rounded-xl font-extrabold text-base text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2">
                Compartilhar
              </button>

              <div className="mt-5 flex justify-center">
                <div className="flex items-center gap-2 bg-primary/10 rounded-full px-4 py-2">
                  <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  </div>
                  <span className="text-sm font-bold text-primary tracking-wide">DOAÇÃO PROTEGIDA</span>
                </div>
              </div>
            </div>

            {/* Creator Card */}
            <div className="bg-card border border-border rounded-lg p-5">
              <p className="text-xs text-muted-foreground mb-3">Vaquinha em benefício dos animais, criada por:</p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-lg">
                  FL
                </div>
                <div>
                  <p className="font-bold text-foreground">Familia Lopes</p>
                  <p className="text-xs text-muted-foreground">Ativo(a) desde dezembro/2025</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* --- TAB COMPONENTS --- */

const SobreTab = () => (
  <div className="text-sm text-foreground leading-relaxed space-y-4">
    <p id="sobre-start" className="scroll-mt-24">🚨 <strong>EMERGÊNCIA NO ABRIGO – PRECISAMOS DE AJUDA URGENTE!</strong> 🚨</p>
    <p><strong>322 vidas inocentes dependem de nós.</strong></p>
    <p>
      As fortes chuvas e ventanias que atingiram a nossa região causaram um estrago enorme no abrigo. Parte da estrutura caiu, e o que restou ficou em condições precárias. Para piorar, alguns dos nossos animais foram atingidos e estão machucados, precisando de atendimento veterinário urgente. 💔
    </p>
    <p>
      A tempestade também destruiu nosso estoque de ração e medicamentos. Perdemos tudo que guardávamos no abrigo. Agora, além de reconstruir, precisamos comprar alimentos novos e pagar o tratamento dos animais feridos.
    </p>
    <p>
      E não para por aí – temos animais que precisam de exames e verificações regulares para garantir que estão saudáveis. O prejuízo é imenso e não temos como arcar com tudo isso sozinhos.
    </p>
    <p>
      Pedimos humildemente qualquer valor que puder doar – R$15, R$30, R$50 – cada real nos ajuda a nos reerguer. Se puder contribuir com ração, patês ou medicamentos, será um grande alívio! 🙏
    </p>
    <p>
      🐾 Eles não podem pedir ajuda, mas nós podemos. E hoje, estamos suplicando. Não os deixe sem esperança. Doe agora e nos ajude a reconstruir!
    </p>
  </div>
);

const AtualizacoesTab = () => (
  <p className="text-sm text-muted-foreground">Não existem atualizações neste momento.</p>
);

const QuemAjudouTab = () => (
  <div className="space-y-6">
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
        <Check className="w-5 h-5 text-primary-foreground" />
      </div>
      <div>
        <p className="font-bold text-foreground">Contribuições</p>
        <p className="text-sm text-muted-foreground">18 pessoas doaram</p>
      </div>
    </div>
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
        <Heart className="w-5 h-5 text-purple-500" />
      </div>
      <div>
        <p className="font-bold text-foreground">Adotantes</p>
        <p className="text-sm text-muted-foreground">
          Quer adotar essa vaquinha? <button className="text-primary font-semibold">Clique aqui!</button>
        </p>
      </div>
    </div>
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
        <Check className="w-5 h-5 text-primary-foreground" />
      </div>
      <div>
        <p className="font-bold text-foreground">Promotores do Bem</p>
        <p className="text-sm text-muted-foreground">Compartilhe a vaquinha, traga doações e se torne Promotor do Bem</p>
      </div>
    </div>
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
        <Heart className="w-5 h-5 text-red-500" />
      </div>
      <div>
        <p className="font-bold text-foreground">Corações</p>
        <p className="text-sm text-muted-foreground">Esta vaquinha recebeu 12 corações no total</p>
      </div>
    </div>

    <div className="border-t border-border pt-6">
      <h3 className="text-lg font-bold text-center text-foreground mb-4">Todos os apoios</h3>
      <div className="flex items-center gap-3 py-3">
        <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
          MC
        </div>
        <div className="flex-1">
          <p className="font-semibold text-foreground text-sm">Mariana C.</p>
          <p className="text-xs text-muted-foreground">Contribuiu</p>
        </div>
        <span className="text-xs text-muted-foreground">1 hora</span>
      </div>
    </div>
  </div>
);

const VakinhaPremiadaTab = () => (
  <div>
    <p className="text-sm text-foreground mb-6">
      Cada ação no Vakinha pode garantir números da sorte para concorrer todos os meses a R$ 15 MIL nos sorteios do Vakinha Premiada
    </p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="border border-border rounded-lg p-5 flex items-start justify-between">
        <div>
          <p className="font-bold text-foreground text-sm">18 pessoas já doaram e receberam números da sorte</p>
          <button className="text-primary text-sm font-semibold mt-2">Quero doar e participar</button>
        </div>
        <Star className="w-6 h-6 text-primary flex-shrink-0" />
      </div>
      <div className="bg-[hsl(160,60%,88%)] rounded-lg p-5 flex items-start justify-between">
        <div>
          <p className="font-bold text-foreground text-sm">2 doadores turbinaram sua doação e receberam números da sorte extra</p>
        </div>
        <Zap className="w-6 h-6 text-primary flex-shrink-0" />
      </div>
      <div className="border border-border rounded-lg p-5 flex items-start justify-between">
        <div>
          <p className="font-bold text-foreground text-sm">3 pessoas compraram corações para destacar essa vaquinha e receberam números da sorte</p>
          <button className="text-primary text-sm font-semibold mt-2">Comprar corações</button>
        </div>
        <Heart className="w-6 h-6 text-primary flex-shrink-0" />
      </div>
      <div className="bg-primary rounded-lg p-5 flex items-start justify-between text-primary-foreground">
        <p className="font-bold text-sm">15 doadores, além de ajudar e concorrer, garantiram números da sorte extra para quem criou a vaquinha</p>
        <Award className="w-6 h-6 flex-shrink-0" />
      </div>
      <div className="border border-border rounded-lg p-5 flex items-start justify-between">
        <div>
          <p className="font-bold text-foreground text-sm">2 pessoas doaram para essa vaquinha e ainda não resgataram seus números</p>
          <button className="text-primary text-sm font-semibold mt-2">Verificar números para resgate</button>
        </div>
        <Heart className="w-6 h-6 text-primary flex-shrink-0" />
      </div>
      <div className="bg-[hsl(45,100%,60%)] rounded-lg p-5 flex items-start justify-between">
        <p className="font-bold text-foreground text-sm">0 pessoas já ganharam o prêmio com números gerados nessa vaquinha</p>
        <Trophy className="w-6 h-6 text-foreground flex-shrink-0" />
      </div>
    </div>
  </div>
);

const SelosRecebidosTab = () => (
  <div className="text-sm text-foreground">
    <p className="mb-2">Agora as vaquinhas mais engajadas ganham selos especiais!</p>
    <p>
      <strong>Esta vaquinha ainda não desbloqueou selos</strong>, mas cada nova doação, compartilhamento ou coração pode ajudar a conquistá-los!
    </p>
  </div>
);

export default CampaignPage;
