import Navigation from "@/components/Navigation";
import LogoGallery from "@/components/LogoGallery";

const LogosPage = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-20">
        <div className="max-w-7xl mx-auto px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              로고 갤러리
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              MAKERY로 생성된 모든 로고 작품들을 둘러보세요.
            </p>
          </div>
        </div>
        <LogoGallery />
      </div>
    </div>
  );
};

export default LogosPage;
