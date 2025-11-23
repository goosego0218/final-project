import { useState } from "react";
import Navigation from "@/components/Navigation";
import LogoGallery from "@/components/LogoGallery";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

const LogosPage = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-20">
        <div className="max-w-7xl mx-auto px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              로고 갤러리
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              MAKERY로 생성된 모든 로고 작품들을 둘러보세요.
            </p>
            
            {/* Search Bar */}
            <div className="max-w-xl mx-auto mt-8">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="찾고 싶은 로고 스타일을 검색하세요 (예: 축제, 음식 등)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-12 text-base pr-24 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#7C22C8] focus-visible:border-2"
                />
                <Button size="sm" className="absolute right-1.5 top-1.5 h-9 bg-[#7C22C8] hover:bg-[#6B1DB5] text-white">
                  <Search className="h-4 w-4 mr-1" />
                  검색
                </Button>
              </div>
            </div>
          </div>
        </div>
        <LogoGallery searchQuery={searchQuery} />
      </div>
    </div>
  );
};

export default LogosPage;
