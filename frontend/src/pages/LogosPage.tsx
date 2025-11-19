<<<<<<< HEAD
import { useState } from "react";
import Navigation from "@/components/Navigation";
import LogoGallery from "@/components/LogoGallery";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

const LogosPage = () => {
  const [searchQuery, setSearchQuery] = useState("");

=======
import Navigation from "@/components/Navigation";
import LogoGallery from "@/components/LogoGallery";

const LogosPage = () => {
>>>>>>> 6c5c159b500ffac8ffb45544f3a1ffbaa2b43002
  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-20">
        <div className="max-w-7xl mx-auto px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              로고 갤러리
            </h1>
<<<<<<< HEAD
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
                  className="h-12 text-base pr-24"
                />
                <Button size="sm" className="absolute right-1.5 top-1.5 h-9">
                  <Search className="h-4 w-4 mr-1" />
                  검색
                </Button>
              </div>
            </div>
          </div>
        </div>
        <LogoGallery searchQuery={searchQuery} />
=======
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              MAKERY로 생성된 모든 로고 작품들을 둘러보세요.
            </p>
          </div>
        </div>
        <LogoGallery />
>>>>>>> 6c5c159b500ffac8ffb45544f3a1ffbaa2b43002
      </div>
    </div>
  );
};

export default LogosPage;
