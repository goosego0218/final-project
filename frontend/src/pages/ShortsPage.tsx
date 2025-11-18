import Navigation from "@/components/Navigation";
import ShortFormGallery from "@/components/ShortFormGallery";

const ShortsPage = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-20">
        <div className="max-w-7xl mx-auto px-8 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            숏폼 갤러리
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            MAKERY로 생성된 모든 숏폼 콘텐츠를 확인하세요.
          </p>
        </div>
        <ShortFormGallery />
      </div>
    </div>
  );
};

export default ShortsPage;
