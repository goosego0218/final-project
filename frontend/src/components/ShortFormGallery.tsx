<<<<<<< HEAD
import { useState, useEffect } from "react";
import { Heart, MessageCircle, Play, Share2, Sparkles } from "lucide-react";
=======
import { useState, useEffect, useRef } from "react";
import { Heart, MessageCircle, Play, Search, Share2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
>>>>>>> 6c5c159b500ffac8ffb45544f3a1ffbaa2b43002
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
<<<<<<< HEAD
import Footer from "@/components/Footer";
=======
>>>>>>> 6c5c159b500ffac8ffb45544f3a1ffbaa2b43002

interface ShortForm {
  id: number;
  title: string;
  thumbnailUrl: string;
  likes: number;
  comments: number;
  duration: string;
  createdAt: Date;
  tags: string[];
}

// Generate mock short form data
const generateMockShortForms = (): ShortForm[] => {
  const titles = [
    "오픈 1시간 전 준비 브이로그",
    "신제품 언박싱 첫 인상",
    "매장 내부 둘러보기",
    "고객 인터뷰 하이라이트",
    "비하인드 더 신 스페셜",
    "일상 속 브랜드 스토리",
    "축제 현장 생생 리포트",
    "음식 먹방 챌린지",
    "카페 투어 브이로그",
    "메이킹 필름 스페셜",
    "제품 리뷰 하이라이트",
    "이벤트 현장 스케치",
    "팀 소개 영상",
    "신메뉴 맛보기",
    "공간 인테리어 소개",
    "직원 일상 브이로그",
    "고객 후기 모음",
    "시즌 프로모션 영상",
    "콜라보 프로젝트 소개",
    "특별 기획전 현장",
  ];

  const tagOptions = ["축제", "음식", "카페", "리뷰", "브이로그", "인터뷰", "이벤트", "메이킹"];

  return Array.from({ length: 60 }, (_, i) => {
    const randomDays = Math.floor(Math.random() * 30);
    return {
      id: i + 1,
      title: titles[i % titles.length],
      thumbnailUrl: "/placeholder.svg",
      likes: Math.floor(Math.random() * 10000) + 100,
      comments: Math.floor(Math.random() * 1000) + 10,
      duration: `0:${String(Math.floor(Math.random() * 50) + 10).padStart(2, '0')}`,
      createdAt: new Date(Date.now() - randomDays * 24 * 60 * 60 * 1000),
      tags: [tagOptions[Math.floor(Math.random() * tagOptions.length)], tagOptions[Math.floor(Math.random() * tagOptions.length)]],
    };
  });
};

<<<<<<< HEAD
interface ShortFormGalleryProps {
  searchQuery?: string;
}

const ShortFormGallery = ({ searchQuery = "" }: ShortFormGalleryProps) => {
  const [allShortForms] = useState<ShortForm[]>(generateMockShortForms());
  const [displayedShortForms, setDisplayedShortForms] = useState<ShortForm[]>([]);
  const [sortBy, setSortBy] = useState<string>("latest");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
=======
const ShortFormGallery = () => {
  const [allShortForms] = useState<ShortForm[]>(generateMockShortForms());
  const [displayedShortForms, setDisplayedShortForms] = useState<ShortForm[]>([]);
  const [sortBy, setSortBy] = useState<string>("latest");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const observerRef = useRef<HTMLDivElement>(null);
>>>>>>> 6c5c159b500ffac8ffb45544f3a1ffbaa2b43002
  const [selectedShort, setSelectedShort] = useState<ShortForm | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Array<{ author: string; content: string; time: string }>>([]);
  const { toast } = useToast();

<<<<<<< HEAD
  const ITEMS_PER_PAGE = 12;
=======
  const ITEMS_PER_PAGE = 9;
>>>>>>> 6c5c159b500ffac8ffb45544f3a1ffbaa2b43002

  const getFilteredAndSortedShortForms = () => {
    let filtered = allShortForms;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (shortForm) =>
          shortForm.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          shortForm.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
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

<<<<<<< HEAD
  // Reset when sort or search changes
  useEffect(() => {
    const sortedData = getFilteredAndSortedShortForms();
    const initialItems = sortedData.slice(0, ITEMS_PER_PAGE);
    setDisplayedShortForms(initialItems);
    setPage(1);
    setHasMore(initialItems.length < sortedData.length);
  }, [sortBy, searchQuery]);

  const handleLoadMore = () => {
    const sortedData = getFilteredAndSortedShortForms();
    const nextPage = page + 1;
    const nextItems = sortedData.slice(0, nextPage * ITEMS_PER_PAGE);
    setDisplayedShortForms(nextItems);
    setPage(nextPage);
    setHasMore(nextItems.length < sortedData.length);
  };
=======
  const loadMore = () => {
    if (loading) return;

    setLoading(true);
    const sortedData = getFilteredAndSortedShortForms();
    const nextItems = sortedData.slice(0, page * ITEMS_PER_PAGE);
    setDisplayedShortForms(nextItems);
    setLoading(false);
  };

  // Reset when sort or search changes
  useEffect(() => {
    setPage(1);
    const sortedData = getFilteredAndSortedShortForms();
    setDisplayedShortForms(sortedData.slice(0, ITEMS_PER_PAGE));
  }, [sortBy, searchQuery]);

  // Load more on scroll
  useEffect(() => {
    loadMore();
  }, [page]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          const sortedData = getFilteredAndSortedShortForms();
          if (displayedShortForms.length < sortedData.length) {
            setPage((prev) => prev + 1);
          }
        }
      },
      { threshold: 0.1 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [loading, displayedShortForms.length]);
>>>>>>> 6c5c159b500ffac8ffb45544f3a1ffbaa2b43002

  const formatDate = (date: Date) => {
    const today = new Date();
    const diffTime = today.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "오늘";
    if (diffDays === 1) return "어제";
    if (diffDays < 7) return `${diffDays}일 전`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
    return `${Math.floor(diffDays / 30)}개월 전`;
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
<<<<<<< HEAD
=======
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

>>>>>>> 6c5c159b500ffac8ffb45544f3a1ffbaa2b43002
      {/* Sort Bar */}
      <div className="max-w-7xl mx-auto px-8 py-6 flex justify-end border-b border-border/50">
        <div className="flex items-center gap-3">
          <Select value={sortBy} onValueChange={setSortBy}>
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

      {/* Short Form Grid */}
      <div className="max-w-7xl mx-auto px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayedShortForms.map((shortForm) => (
            <div
              key={shortForm.id}
              className="group relative bg-card rounded-2xl overflow-hidden border border-border/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 cursor-pointer"
              onClick={() => setSelectedShort(shortForm)}
            >
              {/* 9:16 Thumbnail */}
              <div className="aspect-[9/16] bg-secondary/30 relative">
                <img
                  src={shortForm.thumbnailUrl}
                  alt={shortForm.title}
                  className="w-full h-full object-cover"
                />

                {/* Duration badge */}
                <div className="absolute top-3 left-3 bg-background/90 backdrop-blur-sm rounded-lg px-2.5 py-1 shadow-md">
                  <span className="text-xs font-medium text-foreground">
                    {shortForm.duration}
                  </span>
                </div>

                {/* Hover overlay with play button */}
                <div className="absolute inset-0 bg-background/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                    <Play className="w-8 h-8 text-primary-foreground fill-primary-foreground ml-1" />
                  </div>
                </div>
              </div>

              {/* Info section */}
              <div className="p-4 bg-card">
                <h3 className="text-base font-semibold text-foreground mb-3 line-clamp-2">
                  {shortForm.title}
                </h3>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Heart className="w-4 h-4 text-destructive fill-destructive" />
                      <span>{shortForm.likes.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="w-4 h-4" />
                      <span>{shortForm.comments}</span>
                    </div>
                  </div>
                  <span className="text-xs">{formatDate(shortForm.createdAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

<<<<<<< HEAD
        {hasMore && (
          <div className="text-center mt-8">
            <Button variant="outline" onClick={handleLoadMore}>
              더보기
            </Button>
          </div>
        )}
=======
        {/* Loading indicator */}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          </div>
        )}

        {/* Intersection observer target */}
        <div ref={observerRef} className="h-4" />
>>>>>>> 6c5c159b500ffac8ffb45544f3a1ffbaa2b43002
      </div>

      {/* Short Form Detail Modal */}
      <Dialog open={!!selectedShort} onOpenChange={() => setSelectedShort(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{selectedShort?.title}</DialogTitle>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-6 h-full min-h-0">
            <div className="aspect-[9/16] bg-secondary/30 rounded-lg overflow-hidden w-full max-w-[350px]">
              <img src={selectedShort?.thumbnailUrl} alt={selectedShort?.title} className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col gap-4 h-full min-h-0">
              <div className="flex gap-2">
                <Button variant={isLiked ? "default" : "outline"} onClick={handleLike} className="flex-1">
                  <Heart className={`w-4 h-4 mr-2 ${isLiked ? "fill-current" : ""}`} />
                  좋아요 {selectedShort?.likes.toLocaleString()}
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
                <div className="max-h-[300px] overflow-y-auto bg-secondary/20 rounded-lg p-3 space-y-3">
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
<<<<<<< HEAD
      <Footer />
=======
>>>>>>> 6c5c159b500ffac8ffb45544f3a1ffbaa2b43002
    </div>
  );
};

export default ShortFormGallery;