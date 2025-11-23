import { Heart, MessageCircle, Share2, Sparkles } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import CreateFromStyleModal from "@/components/CreateFromStyleModal";
import { AuthModals } from "@/components/AuthModals";

interface Logo {
  id: number;
  imageSrc: string;
  brandName: string;
  likes: number;
  comments: number;
}

// Generate mock logos (same as LogoGallery)
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

// Get top logos by likes (same data source as LogoGallery)
const getTopLogosByLikes = (): Logo[] => {
  const allLogos = generateMockLogos();
  return [...allLogos].sort((a, b) => b.likes - a.likes).slice(0, 10);
};

const LogoCard = ({ logo, onClick }: { logo: Logo; onClick: () => void }) => {
  // Helper function to get liked logos
  const getLikedLogos = (): Set<number> => {
    const liked = localStorage.getItem('liked_logos');
    return liked ? new Set(JSON.parse(liked)) : new Set();
  };
  
  const isLiked = getLikedLogos().has(logo.id);
  
  return (
    <div 
      onClick={onClick}
      className="group relative bg-card rounded-2xl overflow-hidden border border-border/50 hover:shadow-xl hover:scale-[1.08] transition-all duration-200 cursor-pointer flex-shrink-0 w-64"
      style={{ transformOrigin: 'center' }}
    >
      <div className="aspect-square bg-secondary/30 relative">
        <img src={logo.imageSrc} alt={logo.brandName} className="w-full h-full object-cover" />
        
        {/* 호버 시에만 표시되는 좋아요/댓글 정보 */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div className="flex items-center gap-6 text-white">
            <span className="flex items-center gap-2">
              <Heart className={`w-5 h-5 ${isLiked ? "fill-red-500 text-red-500" : ""}`} />
              {logo.likes.toLocaleString()}
            </span>
            <span className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              {logo.comments}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const PopularLogosHomeSection = () => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedLogo, setSelectedLogo] = useState<Logo | null>(null); // 디테일 모달용
  const [selectedLogoForCreate, setSelectedLogoForCreate] = useState<Logo | null>(null); // 새 작품 만들기용
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Array<{ author: string; authorAvatar?: string; content: string; time: string }>>([]);
  const { toast } = useToast();
  const [isCreateNewModalOpen, setIsCreateNewModalOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);

  // Get top logos by likes from the same data source as LogoGallery
  const [topLogos, setTopLogos] = useState<Logo[]>(getTopLogosByLikes());
  
  // Duplicate logos for seamless infinite scroll
  const duplicatedLogos = [...topLogos, ...topLogos, ...topLogos];

  const startAutoScroll = () => {
    if (intervalRef.current) return;
    
    intervalRef.current = setInterval(() => {
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const cardWidth = 280; // 264px width + 24px gap
        const totalWidth = topLogos.length * cardWidth;
        
        container.scrollLeft += 1;
        
        // Reset scroll position for infinite loop
        if (container.scrollLeft >= totalWidth) {
          container.scrollLeft = 0;
        }
      }
    }, 20);
  };

  const stopAutoScroll = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    startAutoScroll();
    return () => stopAutoScroll();
  }, []);

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

  // Reset likes count and load comments when logo changes
  useEffect(() => {
    if (selectedLogo) {
      setLikesCount(0);
      const liked = getLikedLogos();
      const likedState = liked.has(selectedLogo.id);
      setIsLiked(likedState);
      
      // Load comments from localStorage
      const savedComments = localStorage.getItem(`logo_comments_${selectedLogo.id}`);
      if (savedComments) {
        setComments(JSON.parse(savedComments));
      } else {
        setComments([]);
      }
    } else {
      setIsLiked(false);
      setComments([]);
    }
  }, [selectedLogo]);

  // Listen to storage events to update liked status
  useEffect(() => {
    const handleStorageChange = () => {
      // localStorage에서 통계 불러와서 업데이트
      setTopLogos(prev => prev.map(logo => {
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
      setTopLogos(prev => prev.map(logo => {
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
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('logoStatsUpdated', handleLogoStatsUpdate as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('logoStatsUpdated', handleLogoStatsUpdate as EventListener);
    };
  }, []);

  const handleMouseEnter = () => {
    stopAutoScroll();
  };

  const handleMouseLeave = () => {
    startAutoScroll();
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
    
    setTopLogos(prev => prev.map(logo => {
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
      setTopLogos(prev => prev.map(logo => {
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
    const url = selectedLogo ? `${window.location.origin}/logos?logo=${selectedLogo.id}` : window.location.href;
    navigator.clipboard.writeText(url);
    toast({ 
      description: "링크가 복사되었습니다",
      status: "default",
    });
  };

  const handleCreateNew = () => {
    if (!selectedLogo) return;
    // 선택된 로고를 별도 state에 저장
    setSelectedLogoForCreate(selectedLogo);
    // 아이템 상세 모달 닫기
    setSelectedLogo(null);
    setIsLiked(false);
    setLikesCount(0);
    setComments([]);
    setCommentText("");
    // 모달 열기
      setIsCreateNewModalOpen(true);
  };

  return (
    <>
    <section className="w-full py-24 bg-gradient-to-b from-background to-secondary/20 overflow-hidden">
      <div className="w-full px-12 mb-12">
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            가장 인기 있는 로고
          </h2>
          <p className="text-muted-foreground text-lg">
            커뮤니티에서 가장 사랑받는 로고 디자인을 만나보세요
          </p>
        </div>
      </div>

      {/* Scrolling gallery */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-hidden overflow-y-visible scrollbar-hide"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex gap-6 py-2">
            {duplicatedLogos.map((logo, index) => (
              <LogoCard
                key={`${logo.id}-${index}`}
                logo={logo}
                onClick={() => setSelectedLogo(logo)}
              />
            ))}
        </div>
      </div>
    </section>

    {/* Logo Detail Modal */}
    <Dialog open={!!selectedLogo} onOpenChange={(open) => {
      if (!open) {
        // 창 닫을 때 카드에 반영
        if (selectedLogo) {
          setTopLogos(prev => prev.map(logo => {
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
            <div className="p-3 border-t-[1px] border-border space-y-2">
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
              <Button onClick={handleCreateNew} className="w-full h-9 bg-[#7C22C8] hover:bg-[#6B1DB5] text-white text-sm">
                <Sparkles className="w-4 h-4 mr-2" />
                이 스타일로 새로운 작품 만들기
              </Button>
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

    {/* 새로운 작품 만들기 모달 */}
    {selectedLogoForCreate && (
      <CreateFromStyleModal
        open={isCreateNewModalOpen}
        onOpenChange={(open) => {
          setIsCreateNewModalOpen(open);
          // 모달이 완전히 닫힐 때만 selectedLogoForCreate를 null로 설정
          // CreateFromStyleModal 내부에서 프로젝트 선택 모달이 열려있을 때는
          // onOpenChange(false)를 호출하지 않으므로 안전하게 null로 설정 가능
          if (!open) {
            setSelectedLogoForCreate(null);
          }
        }}
        baseAssetType="logo"
        baseAssetId={selectedLogoForCreate.id}
        baseAssetImageUrl={selectedLogoForCreate.imageSrc}
      />
    )}

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
  </>
  );
};

export default PopularLogosHomeSection;
