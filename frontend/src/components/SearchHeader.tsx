import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const SearchHeader = () => {
  return (
    <header className="w-full py-8 mb-12 animate-fade-in">
      <div className="max-w-2xl mx-auto">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="찾고 싶은 트렌드를 검색하세요... (예: 축제, 음식, 패트넌스)"
            className="pl-12 py-6 text-base bg-card border-border focus:border-primary transition-colors"
          />
        </div>
      </div>
    </header>
  );
};

export default SearchHeader;
