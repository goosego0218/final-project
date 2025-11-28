import { useState, useEffect, useRef } from "react";
import { Heart, MessageCircle, Share2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import Footer from "@/components/Footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AuthModals } from "@/components/AuthModals";

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

interface LogoGalleryProps {
  searchQuery?: string;
}

const LogoGallery = ({ searchQuery = "" }: LogoGalleryProps) => {
  // Mock 로고를 한 번만 생성하고 재사용
  const mockLogosRef = useRef<Logo[]>(generateMockLogos());
  
  const [allLogos, setAllLogos] = useState<Logo[]>([]);
  const [displayedLogos, setDisplayedLogos] = useState<Logo[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("latest");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedLogo, setSelectedLogo] = useState<Logo | null>(null); // 디테일 모달용
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Array<{ author: string; authorAvatar?: string; content: string; time: string }>>([]);
  const { toast } = useToast();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);

  const ITEMS_PER_PAGE = 12;

  // Helper functions for managing liked logos
  const getLikedLogos = (): Set<number> => {
    const liked = localStorage.getItem('liked_logos');
    return liked ? new Set(JSON.parse(liked)) : new Set();
  };

  const saveLikedLogo = (logoId: number, isLiked: boolean) => {
    const liked = getLikedLogos();
    if (isLiked) {
      liked.add(logoId);
    } else {
      liked.delete(logoId);
    }
    localStorage.setItem('liked_logos', JSON.stringify(Array.from(liked)));
  };

  // Load public logos from localStorage
  const loadPublicLogos = () => {
    const publicLogos = JSON.parse(localStorage.getItem('public_logos') || '[]');
    const publicLogosFormatted: Logo[] = publicLogos.map((logo: any) => {
      // localStorage에서 실제 댓글 수 가져오기
      const savedComments = localStorage.getItem(`logo_comments_${logo.id}`);
      const actualCommentsCount = savedComments ? JSON.parse(savedComments).length : 0;
      
      // localStorage에서 통계 가져오기 (댓글 수가 있으면 우선 사용)
      const stats = JSON.parse(localStorage.getItem(`logo_stats_${logo.id}`) || '{}');
      const commentsCount = stats.comments !== undefined ? stats.comments : actualCommentsCount;
      
      return {
        id: logo.id,
        imageSrc: logo.url,
        brandName: logo.brandName,
        likes: stats.likes !== undefined ? stats.likes : (logo.likes || 0),
        comments: commentsCount, // 실제 댓글 수 사용
        createdAt: new Date(logo.createdAt),
        tags: logo.tags || [],
      };
    });
    
    // Combine with mock logos (public logos first, mock logos with fixed order)
    setAllLogos([...publicLogosFormatted, ...mockLogosRef.current]);
  };

  useEffect(() => {
    loadPublicLogos();
  }, []);

  // Reset likes count and load comments when logo changes
  useEffect(() => {
    if (selectedLogo) {
      setLikesCount(0);
      const liked = getLikedLogos();
      const likedState = liked.has(selectedLogo.id);
      setIsLiked(likedState);
      
      // Load comments from localStorage
      const savedComments = localStorage.getItem(`logo_comments_${selectedLogo.id}`);
      let loadedComments: Array<{ author: string; authorAvatar?: string; content: string; time: string }> = [];
      if (savedComments) {
        loadedComments = JSON.parse(savedComments);
        setComments(loadedComments);
      } else {
        setComments([]);
      }
      
      // 댓글 수를 실제 로드된 댓글 수로 업데이트
      const actualCommentsCount = loadedComments.length;
      if (selectedLogo.comments !== actualCommentsCount) {
        setSelectedLogo(prev => prev ? { ...prev, comments: actualCommentsCount } : null);
      }
    } else {
      setIsLiked(false);
      setComments([]);
    }
  }, [selectedLogo]);

  // Listen to storage events and custom events to reload data
  useEffect(() => {
    const handleStorageChange = () => {
      loadPublicLogos();
      // localStorage에서 통계 불러와서 업데이트
      setAllLogos(prev => prev.map(logo => {
        const stats = JSON.parse(localStorage.getItem(`logo_stats_${logo.id}`) || '{}');
        if (stats.likes !== undefined || stats.comments !== undefined) {
          return {
            ...logo,
            likes: stats.likes !== undefined ? stats.likes : logo.likes,
            comments: stats.comments !== undefined ? stats.comments : logo.comments
          };
        }
        return logo;
      }));
    };
    
    const handleLogoStatsUpdate = (e: CustomEvent) => {
      const { id, likes, comments } = e.detail;
      setAllLogos(prev => prev.map(logo => {
        if (logo.id === id) {
          return {
            ...logo,
            ...(likes !== undefined && { likes }),
            ...(comments !== undefined && { comments })
          };
        }
        return logo;
      }));
    };
    
    // Listen for storage events (from other tabs)
    window.addEventListener('storage', handleStorageChange);
    
    // Listen for custom events (from same tab)
    window.addEventListener('publicLogosUpdated', handleStorageChange);
    window.addEventListener('logoStatsUpdated', handleLogoStatsUpdate as EventListener);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('publicLogosUpdated', handleStorageChange);
      window.removeEventListener('logoStatsUpdated', handleLogoStatsUpdate as EventListener);
    };
  }, []);

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

  // Reset when sort or search changes
  useEffect(() => {
    const sortedLogos = getFilteredAndSortedLogos();
    const initialItems = sortedLogos.slice(0, ITEMS_PER_PAGE);
    setDisplayedLogos(initialItems);
    setPage(1);
    setHasMore(initialItems.length < sortedLogos.length);
  }, [allLogos, sortBy, searchQuery]);

  const handleLoadMore = () => {
    const sortedLogos = getFilteredAndSortedLogos();
    const nextPage = page + 1;
    const nextItems = sortedLogos.slice(0, nextPage * ITEMS_PER_PAGE);
    setDisplayedLogos(nextItems);
    setPage(nextPage);
    setHasMore(nextItems.length < sortedLogos.length);
  };

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
    if (!selectedLogo) return;
    
    // 로그인 상태 확인
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn) {
      setIsLoginOpen(true);
      return;
    }
    
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    
    // 카드 목록의 좋아요 수 업데이트
    const updatedLikes = Math.max(0, newLikedState ? selectedLogo.likes + 1 : selectedLogo.likes - 1);
    
    // 선택된 로고의 좋아요 수 즉시 업데이트
    setSelectedLogo(prev => prev ? { ...prev, likes: updatedLikes } : null);
    
    setAllLogos(prev => prev.map(logo => {
      if (logo.id === selectedLogo.id) {
        return {
          ...logo,
          likes: updatedLikes
        };
      }
      return logo;
    }));
    
    saveLikedLogo(selectedLogo.id, newLikedState);
    
    // localStorage에 좋아요 수 저장
    const stats = JSON.parse(localStorage.getItem(`logo_stats_${selectedLogo.id}`) || '{}');
    stats.likes = updatedLikes;
    localStorage.setItem(`logo_stats_${selectedLogo.id}`, JSON.stringify(stats));
    
    // storage 이벤트 발생시켜 다른 컴포넌트에도 알림
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('logoStatsUpdated', { detail: { id: selectedLogo.id, likes: updatedLikes } }));
    
    toast({ 
      description: newLikedState ? "좋아요를 눌렀습니다" : "좋아요를 취소했습니다",
      status: "default",
    });
  };

  const handleComment = () => {
    if (commentText.trim() && selectedLogo) {
      // 로그인 상태 확인
      const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true';
      if (!isLoggedIn) {
        setIsLoginOpen(true);
        return;
      }
      
      const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
      const newComment = {
        author: userProfile.nickname || "익명",
        authorAvatar: userProfile.avatar || undefined,
        content: commentText,
        time: "방금 전"
      };
      const updatedComments = [newComment, ...comments];
      setComments(updatedComments);
      
      // Save comments to localStorage
      localStorage.setItem(`logo_comments_${selectedLogo.id}`, JSON.stringify(updatedComments));
      
      // 카드 목록의 댓글 수 업데이트
      const updatedCommentsCount = updatedComments.length;
      setAllLogos(prev => prev.map(logo => {
        if (logo.id === selectedLogo.id) {
          return {
            ...logo,
            comments: updatedCommentsCount
          };
        }
        return logo;
      }));
      
      // localStorage에 댓글 수 저장
      const stats = JSON.parse(localStorage.getItem(`logo_stats_${selectedLogo.id}`) || '{}');
      stats.comments = updatedCommentsCount;
      localStorage.setItem(`logo_stats_${selectedLogo.id}`, JSON.stringify(stats));
      
      // storage 이벤트 발생시켜 다른 컴포넌트에도 알림
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('logoStatsUpdated', { detail: { id: selectedLogo.id, comments: updatedCommentsCount } }));
      
      toast({ 
        description: "댓글이 등록되었습니다",
        status: "default",
      });
      setCommentText("");
    }
  };

  const handleShare = () => {
    const url = selectedLogo ? `${window.location.origin}/logo-gallery?logo=${selectedLogo.id}` : window.location.href;
    navigator.clipboard.writeText(url);
    toast({ 
      description: "링크가 복사되었습니다",
      status: "default",
    });
  };


  return (
    <div className="w-full bg-background">
      {/* Sort Bar */}
      <div className="max-w-7xl mx-auto px-8 py-6 flex justify-end border-b border-border/50">
        <div className="flex items-center gap-3">
          <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
            <SelectTrigger className="w-[140px] focus:ring-[#7C22C8] focus:ring-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest" className="data-[highlighted]:bg-[#7C22C8] data-[highlighted]:text-white">최신순</SelectItem>
              <SelectItem value="likes" className="data-[highlighted]:bg-[#7C22C8] data-[highlighted]:text-white">좋아요순</SelectItem>
              <SelectItem value="comments" className="data-[highlighted]:bg-[#7C22C8] data-[highlighted]:text-white">댓글순</SelectItem>
              <SelectItem value="oldest" className="data-[highlighted]:bg-[#7C22C8] data-[highlighted]:text-white">오래된순</SelectItem>
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
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Heart className={`w-4 h-4 ${getLikedLogos().has(logo.id) ? "fill-destructive text-destructive" : ""}`} />
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

        {hasMore && (
          <div className="text-center mt-8">
            <Button variant="outline" onClick={handleLoadMore} className="hover:bg-[#7C22C8] hover:text-white hover:border-[#7C22C8]">
              더보기
            </Button>
          </div>
        )}
      </div>

      {/* Logo Detail Modal */}
      <Dialog open={!!selectedLogo} onOpenChange={(open) => {
        if (!open) {
          // 창 닫을 때 카드에 반영
          if (selectedLogo) {
            setAllLogos(prev => prev.map(logo => {
              if (logo.id === selectedLogo.id) {
                return {
                  ...logo,
                  likes: selectedLogo.likes,
                  comments: comments.length
                };
              }
              return logo;
            }));
          }
          setSelectedLogo(null);
          setIsLiked(false);
          setLikesCount(0);
          setComments([]);
          setCommentText("");
        }
      }}>
        <DialogContent className="max-w-[800px] w-[90vw] overflow-hidden p-0 gap-0">
          <div className="flex md:flex-row flex-col">
            {/* Left: Logo Image */}
            <div className="bg-background flex items-center justify-center p-0 border-r border-border aspect-square w-full md:w-[400px] md:flex-shrink-0 rounded-l-lg overflow-hidden">
              <img 
                src={selectedLogo?.imageSrc} 
                alt={selectedLogo?.brandName} 
                className="w-full h-full object-contain"
              />
            </div>

            {/* Right: Comments and Actions */}
            <div className="flex flex-col bg-background w-full md:w-[400px] md:flex-shrink-0 aspect-square md:aspect-auto md:h-[400px] rounded-r-lg">
              {/* Comments Section - Top */}
              <div className="flex-1 min-h-0 overflow-y-auto p-6">
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
              <div className="p-3 border-t-[1px] border-border">
                <div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    onClick={handleLike}
                    className="h-8 px-3 gap-2 hover:bg-[#7C22C8]/10 hover:text-[#7C22C8]"
                  >
                    <Heart className={`h-4 w-4 ${isLiked ? "fill-destructive text-destructive" : ""}`} />
                    <span className="text-sm font-semibold text-foreground">
                      {selectedLogo ? selectedLogo.likes.toLocaleString() : "0"}
                    </span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="h-8 px-3 gap-2 hover:bg-[#7C22C8]/10 hover:text-[#7C22C8]"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span className="text-sm font-semibold text-foreground">
                      {comments.length.toLocaleString()}
                    </span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={handleShare}
                    className="h-8 w-8 hover:bg-[#7C22C8]/10 hover:text-[#7C22C8]"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Comment Input - Bottom */}
              <div className="p-3 border-t-[1px] border-border">
                <div className="flex gap-2">
                  <Textarea 
                    placeholder="댓글을 입력하세요..." 
                    value={commentText} 
                    onChange={(e) => setCommentText(e.target.value)} 
                    className="h-[40px] min-h-[40px] max-h-[40px] resize-none flex-1 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#7C22C8] focus-visible:border-2" 
                    rows={1}
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
                    className="h-[40px] px-6 bg-[#7C22C8] hover:bg-[#6B1DB5] text-white disabled:opacity-50"
                  >
                    등록
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AuthModals
        isLoginOpen={isLoginOpen}
        isSignUpOpen={isSignUpOpen}
        onLoginClose={() => setIsLoginOpen(false)}
        onSignUpClose={() => setIsSignUpOpen(false)}
        onSwitchToSignUp={() => {
          setIsLoginOpen(false);
          setIsSignUpOpen(true);
        }}
        onSwitchToLogin={() => {
          setIsSignUpOpen(false);
          setIsLoginOpen(true);
        }}
        onLoginSuccess={(rememberMe) => {
          setIsLoginOpen(false);
          setIsSignUpOpen(false);
        }}
      />

      <Footer />
    </div>
  );
};

export default LogoGallery;
