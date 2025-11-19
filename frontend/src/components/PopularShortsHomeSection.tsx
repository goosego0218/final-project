import { Heart, MessageCircle, Clipboard } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ShortFormCardProps {
  thumbnailSrc: string;
  title: string;
  duration: string;
  likes: number | string;
  comments: number;
  platform: string;
  onClick: () => void;
}

// Generate mock short forms (same as ShortFormGallery)
const generateMockShortForms = (): Array<{ title: string; duration: string; likes: number; comments: number; platform: string }> => {
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

  const platforms = ["Instagram", "YouTube Shorts"];

  return titles.map((title, index) => ({
    title,
    duration: `0:${String(Math.floor(Math.random() * 50) + 10).padStart(2, '0')}`,
    likes: Math.floor(Math.random() * 10000) + 100,
    comments: Math.floor(Math.random() * 1000) + 10,
    platform: platforms[Math.floor(Math.random() * platforms.length)],
  }));
};

// Get top short forms by likes (same data source as ShortFormGallery)
const getTopShortFormsByLikes = () => {
  const allShortForms = generateMockShortForms();
  return [...allShortForms].sort((a, b) => b.likes - a.likes).slice(0, 6);
};

const ShortFormCard = ({ thumbnailSrc, title, duration, likes, comments, onClick }: ShortFormCardProps) => {
  // Helper function to get liked shorts
  const getLikedShorts = (): Set<number> => {
    const liked = localStorage.getItem('liked_shorts');
    return liked ? new Set(JSON.parse(liked)) : new Set();
  };
  
  // Use title's first character as ID if no ID is available
  const shortId = title?.charCodeAt(0) || 0;
  const isLiked = getLikedShorts().has(shortId);
  
  return (
    <div 
      onClick={onClick}
      className="group relative bg-card rounded-2xl overflow-hidden border border-border/50 hover:shadow-xl hover:scale-[1.08] transition-all duration-200 cursor-pointer flex-shrink-0 w-64"
      style={{ transformOrigin: 'center' }}
    >
      <div className="aspect-[9/16] bg-secondary/30 relative">
        <img src={thumbnailSrc} alt={title} className="w-full h-full object-cover" />
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div className="flex items-center gap-6 text-white">
            <span className="flex items-center gap-2">
              <Heart className={`w-5 h-5 ${isLiked ? "fill-red-500 text-red-500" : ""}`} />
              {typeof likes === 'number' ? likes.toLocaleString() : likes}
            </span>
            <span className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              {comments}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const PopularShortsHomeSection = () => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedShort, setSelectedShort] = useState<any>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Array<{ author: string; authorAvatar?: string; content: string; time: string }>>([]);
  const { toast } = useToast();

  // Get top short forms by likes from the same data source as ShortFormGallery
  const [shortForms, setShortForms] = useState(getTopShortFormsByLikes());
  
  // Duplicate shortforms for seamless infinite scroll
  const duplicatedShortForms = [...shortForms, ...shortForms, ...shortForms];

  const startAutoScroll = () => {
    if (intervalRef.current) return;
    
    intervalRef.current = setInterval(() => {
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const cardWidth = 280;
        const totalWidth = shortForms.length * cardWidth;
        
        container.scrollLeft += 1;
        
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
      // selectedShort.id가 없을 수 있으므로 title이나 다른 고유 식별자 사용
      const shortId = selectedShort.id || selectedShort.title?.charCodeAt(0) || 0;
      setIsLiked(liked.has(shortId));
    }
  }, [selectedShort]);

  // Listen to storage events to update liked status
  useEffect(() => {
    const handleStorageChange = () => {
      // 카드 목록이 자동으로 업데이트되도록 함
      setShortForms(prev => [...prev]);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleMouseEnter = () => {
    stopAutoScroll();
  };

  const handleMouseLeave = () => {
    startAutoScroll();
  };

  const handleLike = () => {
    if (!selectedShort) return;
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    setLikesCount(prev => newLikedState ? prev + 1 : prev - 1);
    // selectedShort.id가 없을 수 있으므로 title이나 다른 고유 식별자 사용
    const shortId = selectedShort.id || selectedShort.title?.charCodeAt(0) || 0;
    saveLikedShort(shortId, newLikedState);
    
    // 카드 목록의 좋아요 수 업데이트
    setShortForms(prev => prev.map(shortForm => {
      const formId = shortForm.title?.charCodeAt(0) || 0;
      if (formId === shortId) {
        return {
          ...shortForm,
          likes: newLikedState ? (typeof shortForm.likes === 'number' ? shortForm.likes + 1 : 0) : Math.max(0, (typeof shortForm.likes === 'number' ? shortForm.likes - 1 : 0))
        };
      }
      return shortForm;
    }));
    
    // storage 이벤트 발생시켜 다른 컴포넌트에도 알림
    window.dispatchEvent(new Event('storage'));
    
    toast({
      description: newLikedState ? "좋아요를 눌렀습니다" : "좋아요를 취소했습니다",
    });
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
      toast({
        description: "댓글이 등록되었습니다",
      });
      setCommentText("");
    }
  };

  const handleShare = () => {
    const url = selectedShort ? `${window.location.origin}/shorts?short=${selectedShort.id || ''}` : window.location.href;
    navigator.clipboard.writeText(url);
    toast({
      description: "링크가 복사되었습니다",
    });
  };

  return (
    <>
      <section className="w-full py-24 bg-gradient-to-b from-background to-secondary/20">
        <div className="w-full px-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              가장 인기 있는 숏폼
            </h2>
            <p className="text-muted-foreground text-lg">
              커뮤니티에서 가장 사랑받는 숏폼 디자인을 만나보세요
            </p>
          </div>

          {/* Scrolling gallery */}
          <div
            ref={scrollContainerRef}
            className="overflow-x-hidden overflow-y-visible scrollbar-hide"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="flex gap-6 py-8">
              {duplicatedShortForms.map((shortForm, index) => (
                <ShortFormCard
                  key={`${shortForm.title}-${index}`}
                  thumbnailSrc="/placeholder.svg"
                  title={shortForm.title}
                  duration={shortForm.duration}
                  likes={shortForm.likes}
                  comments={shortForm.comments}
                  platform={shortForm.platform}
                  onClick={() => setSelectedShort({ ...shortForm, thumbnailSrc: "/placeholder.svg" })}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

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
                src={selectedShort?.thumbnailSrc || selectedShort?.thumbnailUrl || "/placeholder.svg"} 
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
                      {(selectedShort ? (selectedShort.likes || 0) + likesCount : 0).toLocaleString()}
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
    </>
  );
};

export default PopularShortsHomeSection;
