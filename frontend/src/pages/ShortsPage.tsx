import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import ShortFormGallery from "@/components/ShortFormGallery";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

const ShortsPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [searchParams] = useSearchParams();
  const initialShortId = searchParams.get("short");

  const handleSearch = () => {
    setActiveSearchQuery(searchQuery);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-20">
        <div className="max-w-7xl mx-auto px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              숏폼 갤러리
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              MAKERY로 생성된 모든 숏폼 콘텐츠를 확인하세요.
            </p>
            
            {/* Search Bar */}
            <div className="max-w-xl mx-auto mt-8">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="찾고 싶은 숏폼 스타일을 검색하세요 (예: 축제, 음식 등)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="h-12 text-base pr-24"
                />
                <Button 
                  size="sm" 
                  onClick={handleSearch}
                  className="absolute right-1.5 top-1.5 h-9"
                >
                  <Search className="h-4 w-4 mr-1" />
                  검색
                </Button>
              </div>
            </div>
          </div>
        </div>
        <ShortFormGallery
          searchQuery={activeSearchQuery}
          initialSelectedProdId={initialShortId ? Number(initialShortId) : undefined}
        />
      </div>
    </div>
  );
};

export default ShortsPage;
