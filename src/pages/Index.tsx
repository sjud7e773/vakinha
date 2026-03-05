import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CampaignPage from "@/components/CampaignPage";
import DonationPage from "@/components/DonationPage";
import MobileStickyBar from "@/components/MobileStickyBar";

const Index = () => {
  const [showDonation, setShowDonation] = useState(false);

  if (showDonation) {
    return <DonationPage onBack={() => setShowDonation(false)} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background pb-24 lg:pb-0">
      <Header onDonate={() => setShowDonation(true)} />
      <main className="flex-1">
        <CampaignPage onDonate={() => setShowDonation(true)} />
      </main>
      <Footer />
      <MobileStickyBar onDonate={() => setShowDonation(true)} />
    </div>
  );
};

export default Index;
