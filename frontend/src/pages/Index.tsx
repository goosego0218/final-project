import Navigation from "@/components/Navigation";
import HeroSection from "@/components/HeroSection";
import PopularLogosHomeSection from "@/components/PopularLogosHomeSection";
import PopularShortsHomeSection from "@/components/PopularShortsHomeSection";
import FeaturesSection from "@/components/FeaturesSection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <HeroSection />
      <PopularLogosHomeSection />
      <PopularShortsHomeSection />
      <FeaturesSection />
      <Footer />
    </div>
  );
};

export default Index;
