import { useState, useEffect, useRef } from "react";
import { Heart, MessageCircle, Search, Share2, Sparkles } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface Logo {
  id: number;
  imageSrc: string;
  brandName: string;
  likes: number;
  comments: number;
  createdAt: Date;
  tags: string[];
}

// Mock data with more logos
const generateMockLogos = (): Logo[] => {
  const brands = [
    { name: "카페 드 플뢰르", tags: ["카페", "음식"] },
    { name: "봄꽃 축제", tags: ["축제", "이벤트"] },
    { name: "디지털 스튜디오", tags: ["기술", "디자인"] },
    { name: "그린 마켓", tags: ["음식", "건강"] },
    { name: "뮤직 페스타", tags: ["축제", "음악"] },
    { name: "베이커리 하우스", tags: ["음식", "카페"] },
    { name: "아트 갤러리", tags: ["예술", "전시"] },
    { name: "푸드 트럭", tags: ["음식", "축제"] },
    { name: "요가 센터", tags: ["건강", "운동"] },
    { name: "북 카페", tags: ["카페", "문화"] },
    { name: "와인 바", tags: ["음식", "분위기"] },
    { name: "재즈 클럽", tags: ["음악", "축제"] },
    { name: "플라워 샵", tags: ["자연", "선물"] },
    { name: "펫 카페", tags: ["카페", "동물"] },
    { name: "시네마 라운지", tags: ["문화", "엔터테인먼트"] },
    { name: "스포츠 바", tags: ["음식", "운동"] },
    { name: "브런치 카페", tags: ["음식", "카페"] },
    { name: "야시장", tags: ["축제", "음식"] },
    { name: "디저트 공방", tags: ["음식", "카페"] },
    { name: "크래프트 비어", tags: ["음식", "분위기"] },
  ];

  return brands.map((brand, index) => ({
    id: index + 1,
    imageSrc: "/placeholder.svg",
    brandName: brand.name,
    likes: Math.floor(Math.random() * 5000) + 100,
    comments: Math.floor(Math.random() * 500) + 10,
    createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
    tags: brand.tags,
  }));
};

type SortOption = "latest" | "likes" | "comments" | "oldest";

const LogoGallery = () => {
  const [allLogos] = useState<Logo[]>(generateMockLogos());
  const [displayedLogos, setDisplayedLogos] = useState<Logo[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("latest");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [selectedLogo, setSelectedLogo] = useState<Logo | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Array<{ author: string; content: string; time: string }>>([]);
  const { toast } = useToast();

  const ITEMS_PER_PAGE = 8;

  // Filter and sort logos
  const getFilteredAndSortedLogos = () => {
    let filtered = allLogos;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (logo) =>
          logo.brandName.toLowerCase().includes(query) ||
          logo.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "latest":
          return b.createdAt.getTime() - a.createdAt.getTime();
        case "oldest":
          return a.createdAt.getTime() - b.createdAt.getTime();
        case "likes":
          return b.likes - a.likes;
        case "comments":
          return b.comments - a.comments;
        default:
          return 0;
      }
    });

    return sorted;
  };

  // Load more items
  const loadMore = () => {
    if (loading) return;

    setLoading(true);
    setTimeout(() => {
      const sortedLogos = getFilteredAndSortedLogos();
      const nextItems = sortedLogos.slice(0, page * ITEMS_PER_PAGE);
      setDisplayedLogos(nextItems);
      setPage((prev) => prev + 1);
      setLoading(false);
    }, 500);
  };

  // Reset when sort or search changes
  useEffect(() => {
    setPage(1);
    const sortedLogos = getFilteredAndSortedLogos();
    setDisplayedLogos(sortedLogos.slice(0, ITEMS_PER_PAGE));
    setPage(2);
  }, [sortBy, searchQuery]);

  // Infinite scroll observer
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          const sortedLogos = getFilteredAndSortedLogos();
          if (displayedLogos.length < sortedLogos.length) {
            loadMore();
          }
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loading, displayedLogos.length, sortBy, searchQuery]);

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "오늘";
    if (days === 1) return "어제";
    if (days < 7) return `${days}일 전`;
    if (days < 30) return `${Math.floor(days / 7)}주 전`;
    return `${Math.floor(days / 30)}개월 전`;
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    toast({ description: isLiked ? "좋아요를 취소했습니다" : "좋아요를 눌렀습니다" });
  };

  const handleComment = () => {
    if (commentText.trim()) {
      const newComment = {
        author: "나",
        content: commentText,
        time: "방금 전"
      };
      setComments([newComment, ...comments]);
      toast({ description: "댓글이 등록되었습니다" });
      setCommentText("");
    }
  };

  const handleShare = () => {
    toast({ description: "링크가 복사되었습니다" });
  };

  const handleCreateNew = () => {
    toast({ description: "스튜디오로 이동합니다" });
  };

  return (
    <div className="w-full bg-background">
      {/* Search Section */}
      <div className="max-w-7xl mx-auto px-8 py-12 bg-secondary/20">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground mb-4 text-center">
            트렌드 검색
          </h2>
          <div className="relative">
            <Input
              type="text"
              placeholder="찾고 싶은 트렌드를 검색하세요 (예: 축제, 음식 등)"
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

      {/* Sort Bar */}
      <div className="max-w-7xl mx-auto px-8 py-6 flex justify-end border-b border-border/50">
        <div className="flex items-center gap-3">
          <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">최신순</SelectItem>
              <SelectItem value="likes">좋아요순</SelectItem>
              <SelectItem value="comments">댓글순</SelectItem>
              <SelectItem value="oldest">오래된순</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Logo grid */}
      <div className="max-w-7xl mx-auto px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {displayedLogos.map((logo) => (
            <Card
              key={logo.id}
              className="group cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-xl"
              onClick={() => setSelectedLogo(logo)}
            >
              <CardContent className="p-0">
                <div className="aspect-square bg-muted rounded-t-lg overflow-hidden">
                  <img
                    src={logo.imageSrc}
                    alt={logo.brandName}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-foreground mb-3">
                    {logo.brandName}
                  </h3>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Heart className="w-4 h-4" />
                        {logo.likes.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-4 h-4" />
                        {logo.comments}
                      </span>
                    </div>
                    <span>{formatDate(logo.createdAt)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Loading indicator */}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Intersection observer target */}
        <div ref={loadMoreRef} className="h-4" />
      </div>

      {/* Logo Detail Modal */}
      <Dialog open={!!selectedLogo} onOpenChange={() => setSelectedLogo(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{selectedLogo?.brandName}</DialogTitle>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-6 h-full min-h-0">
            <div className="aspect-square bg-secondary/30 rounded-lg overflow-hidden w-full max-w-[500px]">
              <img src={selectedLogo?.imageSrc} alt={selectedLogo?.brandName} className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col gap-4 h-full min-h-0">
              <div className="flex gap-2">
                <Button variant={isLiked ? "default" : "outline"} onClick={handleLike} className="flex-1">
                  <Heart className={`w-4 h-4 mr-2 ${isLiked ? "fill-current" : ""}`} />
                  좋아요 {selectedLogo?.likes.toLocaleString()}
                </Button>
                <Button variant="outline" onClick={handleShare}>
                  <Share2 className="w-4 h-4 mr-2" />
                  공유하기
                </Button>
              </div>
              <Button onClick={handleCreateNew} className="w-full">
                <Sparkles className="w-4 h-4 mr-2" />
                이 스타일로 새로운 작품 만들기
              </Button>
              <div className="flex flex-col gap-3 flex-1 min-h-0">
                <h3 className="font-semibold flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  댓글 {comments.length}
                </h3>
                <div className="flex-1 min-h-0 overflow-y-auto bg-secondary/20 rounded-lg p-3 space-y-3">
                  {comments.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      아직 댓글이 없습니다. 첫 댓글을 남겨보세요!
                    </div>
                  ) : (
                    comments.map((comment, idx) => (
                      <div key={idx} className="bg-background rounded p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm">{comment.author}</span>
                          <span className="text-xs text-muted-foreground">{comment.time}</span>
                        </div>
                        <p className="text-sm">{comment.content}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <Textarea placeholder="댓글을 입력하세요..." value={commentText} onChange={(e) => setCommentText(e.target.value)} className="min-h-[60px] resize-none" rows={2} />
                  <Button onClick={handleComment} disabled={!commentText.trim()} className="h-[60px]">등록</Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LogoGallery;
