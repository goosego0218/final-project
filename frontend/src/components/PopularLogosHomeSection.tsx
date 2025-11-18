import { Heart, MessageCircle, Share2, Sparkles } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface Logo {
  id: number;
  imageSrc: string;
  brandName: string;
  likes: number;
  comments: number;
}

const mockLogos: Logo[] = [
  { id: 1, imageSrc: "/placeholder.svg", brandName: "카페 드 플뢰르", likes: 4234, comments: 89 },
  { id: 2, imageSrc: "/placeholder.svg", brandName: "봄꽃 축제", likes: 3891, comments: 124 },
  { id: 3, imageSrc: "/placeholder.svg", brandName: "디지털 스튜디오", likes: 3567, comments: 76 },
  { id: 4, imageSrc: "/placeholder.svg", brandName: "그린 마켓", likes: 3234, comments: 92 },
  { id: 5, imageSrc: "/placeholder.svg", brandName: "뮤직 페스타", likes: 2987, comments: 145 },
  { id: 6, imageSrc: "/placeholder.svg", brandName: "베이커리 하우스", likes: 2765, comments: 67 },
  { id: 7, imageSrc: "/placeholder.svg", brandName: "아트 갤러리", likes: 2543, comments: 84 },
  { id: 8, imageSrc: "/placeholder.svg", brandName: "푸드 트럭", likes: 2321, comments: 103 },
  { id: 9, imageSrc: "/placeholder.svg", brandName: "요가 센터", likes: 2156, comments: 58 },
  { id: 10, imageSrc: "/placeholder.svg", brandName: "북 카페", likes: 1987, comments: 72 },
];

const LogoCard = ({ logo, onClick }: { logo: Logo; onClick: () => void }) => {
  return (
    <div 
      onClick={onClick}
      className="group relative bg-card rounded-2xl overflow-hidden border border-border/50 hover:shadow-xl hover:scale-[1.08] transition-all duration-200 cursor-pointer flex-shrink-0 w-64"
    >
      <div className="aspect-square bg-secondary/30 relative">
        <img src={logo.imageSrc} alt={logo.brandName} className="w-full h-full object-cover" />
        
        {/* 호버 시에만 표시되는 좋아요/댓글 정보 */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div className="flex items-center gap-6 text-white">
            <span className="flex items-center gap-2">
              <Heart className="w-5 h-5" />
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
  const [selectedLogo, setSelectedLogo] = useState<Logo | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Array<{ author: string; content: string; time: string }>>([]);
  const { toast } = useToast();

  // Duplicate logos for seamless infinite scroll
  const duplicatedLogos = [...mockLogos, ...mockLogos, ...mockLogos];

  const startAutoScroll = () => {
    if (intervalRef.current) return;
    
    intervalRef.current = setInterval(() => {
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const cardWidth = 280; // 264px width + 24px gap
        const totalWidth = mockLogos.length * cardWidth;
        
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

  const handleMouseEnter = () => {
    stopAutoScroll();
  };

  const handleMouseLeave = () => {
    startAutoScroll();
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
    <>
    <section className="w-full py-24 bg-gradient-to-b from-background to-secondary/20">
      <div className="w-full px-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            가장 인기 있는 로고
          </h2>
          <p className="text-muted-foreground text-lg">
            커뮤니티에서 가장 사랑받는 로고 디자인을 만나보세요
          </p>
        </div>

        {/* Scrolling gallery */}
        <div
          ref={scrollContainerRef}
          className="overflow-x-hidden scrollbar-hide"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="flex gap-6">
              {duplicatedLogos.map((logo, index) => (
                <LogoCard
                  key={`${logo.id}-${index}`}
                  logo={logo}
                  onClick={() => setSelectedLogo(logo)}
                />
              ))}
          </div>
        </div>
      </div>
    </section>

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
  </>
  );
};

export default PopularLogosHomeSection;
