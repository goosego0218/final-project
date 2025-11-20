import { useState, useEffect } from "react";
import { Heart, MessageCircle, Play, Clipboard } from "lucide-react";
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
import Footer from "@/components/Footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

interface ShortFormGalleryProps {
  searchQuery?: string;
}

const ShortFormGallery = ({ searchQuery = "" }: ShortFormGalleryProps) => {
  const [allShortForms, setAllShortForms] = useState<ShortForm[]>(generateMockShortForms());
  const [displayedShortForms, setDisplayedShortForms] = useState<ShortForm[]>([]);
  const [sortBy, setSortBy] = useState<string>("latest");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedShort, setSelectedShort] = useState<ShortForm | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Array<{ author: string; authorAvatar?: string; content: string; time: string }>>([]);
  const { toast } = useToast();

  const ITEMS_PER_PAGE = 12;

  // Load public short forms from localStorage
  useEffect(() => {
    const publicShortForms = JSON.parse(localStorage.getItem('public_shortforms') || '[]');
    const publicShortFormsFormatted: ShortForm[] = publicShortForms.map((sf: any) => ({
      id: sf.id,
      title: sf.title,
      thumbnailUrl: sf.thumbnailUrl,
      likes: sf.likes || 0,
      comments: sf.comments || 0,
      duration: sf.duration || "0:15",
      createdAt: new Date(sf.createdAt),
      tags: sf.tags || [],
    }));
    
    // Combine with mock short forms (public short forms first)
    setAllShortForms([...publicShortFormsFormatted, ...generateMockShortForms()]);
  }, []);

  // Helper functions for managing liked short forms
  const getLikedShorts = (): Set<number> => {
    const liked = localStorage.getItem('liked_shorts');
    return liked ? new Set(JSON.parse(liked)) : new Set();
  };

  const saveLikedShort = (shortId: number, isLiked: boolean) => {
    const liked = getLikedShorts();
    if (isLiked) {
      liked.add(shortId);
    } else {
      liked.delete(shortId);
    }
    localStorage.setItem('liked_shorts', JSON.stringify(Array.from(liked)));
  };

  // Reset likes count when short form changes
  useEffect(() => {
    if (selectedShort) {
      setLikesCount(0);
      const liked = getLikedShorts();
      const likedState = liked.has(selectedShort.id);
      setIsLiked(likedState);
    } else {
      setIsLiked(false);
    }
  }, [selectedShort]);

  // Listen to storage events to update liked status
  useEffect(() => {
    const handleStorageChange = () => {
      // 카드 목록이 자동으로 업데이트되도록 함
      setAllShortForms(prev => [...prev]);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

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
    if (!selectedShort) return;
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    setLikesCount(prev => newLikedState ? prev + 1 : prev - 1);
    saveLikedShort(selectedShort.id, newLikedState);
    
    // 카드 목록의 좋아요 수 업데이트
    setAllShortForms(prev => prev.map(shortForm => {
      if (shortForm.id === selectedShort.id) {
        return {
          ...shortForm,
          likes: newLikedState ? shortForm.likes + 1 : Math.max(0, shortForm.likes - 1)
        };
      }
      return shortForm;
    }));
    
    // storage 이벤트 발생시켜 다른 컴포넌트에도 알림
    window.dispatchEvent(new Event('storage'));
    
    toast({ description: newLikedState ? "좋아요를 눌렀습니다" : "좋아요를 취소했습니다" });
  };

  const handleComment = () => {
    if (commentText.trim()) {
      const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
      const newComment = {
        author: userProfile.nickname || "나",
        authorAvatar: userProfile.avatar || undefined,
        content: commentText,
        time: "방금 전"
      };
      setComments([newComment, ...comments]);
      toast({ description: "댓글이 등록되었습니다" });
      setCommentText("");
    }
  };

  const handleShare = () => {
    const url = selectedShort ? `${window.location.origin}/shorts?short=${selectedShort.id}` : window.location.href;
    navigator.clipboard.writeText(url);
    toast({ description: "링크가 복사되었습니다" });
  };

  return (
    <div className="w-full bg-background">
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
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Heart className={`w-4 h-4 ${getLikedShorts().has(shortForm.id) ? "fill-destructive text-destructive" : ""}`} />
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

        {hasMore && (
          <div className="text-center mt-8">
            <Button variant="outline" onClick={handleLoadMore}>
              더보기
            </Button>
          </div>
        )}
      </div>

      {/* Short Form Detail Modal */}
      <Dialog open={!!selectedShort} onOpenChange={() => {
        setSelectedShort(null);
        setIsLiked(false);
        setLikesCount(0);
        setComments([]);
        setCommentText("");
      }}>
        <DialogContent className="max-w-[800px] w-[90vw] overflow-hidden p-0 gap-0">
          <div className="flex md:flex-row flex-col">
            {/* Left: Short Form Image (9:16 ratio) */}
            <div className="bg-background flex items-center justify-center p-0 border-r border-border aspect-[9/16] w-full md:w-[300px] md:flex-shrink-0 rounded-l-lg overflow-hidden relative group">
              <img 
                src={selectedShort?.thumbnailUrl} 
                alt={selectedShort?.title} 
                className="w-full h-full object-cover"
              />
              {selectedShort?.videoUrl && (
                <video
                  src={selectedShort.videoUrl}
                  className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              )}
            </div>

            {/* Right: Comments and Actions */}
            <div className="flex flex-col bg-background w-full md:w-[500px] md:flex-shrink-0 aspect-[9/16] md:aspect-auto md:h-[533px] rounded-r-lg">
              {/* Comments Section - Top */}
              <div className="flex-1 min-h-0 overflow-y-auto p-6 border-b border-border">
                <div className="space-y-4">
                  {comments.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      아직 댓글이 없습니다. 첫 댓글을 남겨보세요!
                    </div>
                  ) : (
                    comments.map((comment, idx) => (
                      <div key={idx} className="flex gap-3">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          {comment.authorAvatar ? (
                            <AvatarImage src={comment.authorAvatar} alt={comment.author} />
                          ) : null}
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                            {comment.author.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm text-foreground">{comment.author}</span>
                            <span className="text-xs text-muted-foreground">{comment.time}</span>
                          </div>
                          <p className="text-sm text-foreground break-words">{comment.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Action Buttons - Middle */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    onClick={handleLike}
                    className="h-9 px-3 gap-2"
                  >
                    <Heart className={`h-5 w-5 ${isLiked ? "fill-destructive text-destructive" : ""}`} />
                    <span className="text-sm font-semibold text-foreground">
                      {(selectedShort ? selectedShort.likes + likesCount : 0).toLocaleString()}
                    </span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={handleShare}
                    className="h-9 w-9"
                  >
                    <Clipboard className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Comment Input - Bottom */}
              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <Textarea 
                    placeholder="댓글을 입력하세요..." 
                    value={commentText} 
                    onChange={(e) => setCommentText(e.target.value)} 
                    className="min-h-[60px] resize-none flex-1" 
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (commentText.trim()) {
                          handleComment();
                        }
                      }
                    }}
                  />
                  <Button 
                    onClick={handleComment} 
                    disabled={!commentText.trim()} 
                    className="h-[60px] px-6"
                  >
                    등록
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
};

export default ShortFormGallery;