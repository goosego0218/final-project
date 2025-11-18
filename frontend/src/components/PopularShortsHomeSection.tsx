import { Heart, MessageCircle, Share2, Sparkles } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface ShortFormCardProps {
  thumbnailSrc: string;
  title: string;
  duration: string;
  likes: string;
  comments: number;
  platform: string;
  onClick: () => void;
}

const ShortFormCard = ({ thumbnailSrc, title, duration, likes, comments, onClick }: ShortFormCardProps) => {
  return (
    <div 
      onClick={onClick}
      className="group relative bg-card rounded-2xl overflow-hidden border border-border/50 hover:shadow-xl hover:scale-[1.08] transition-all duration-200 cursor-pointer flex-shrink-0 w-64"
    >
      <div className="aspect-[9/16] bg-secondary/30 relative">
        <img src={thumbnailSrc} alt={title} className="w-full h-full object-cover" />
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div className="flex items-center gap-6 text-white">
            <span className="flex items-center gap-2">
              <Heart className="w-5 h-5" />
              {likes}
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
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Array<{ author: string; content: string; time: string }>>([]);
  const { toast } = useToast();

  const shortForms = [
    { title: "오픈 1시간 전 준비 브이로그", duration: "0:15", likes: "3.4k", comments: 124, platform: "Instagram" },
    { title: "신제품 언박싱 첫 인상", duration: "0:30", likes: "2.8k", comments: 89, platform: "YouTube Shorts" },
    { title: "매장 내부 둘러보기", duration: "0:22", likes: "4.1k", comments: 156, platform: "Instagram" },
    { title: "고객 인터뷰 하이라이트", duration: "0:18", likes: "2.2k", comments: 67, platform: "YouTube Shorts" },
    { title: "비하인드 더 신 스페셜", duration: "0:45", likes: "5.6k", comments: 203, platform: "Instagram" },
    { title: "일상 속 브랜드 스토리", duration: "0:25", likes: "3.9k", comments: 142, platform: "YouTube Shorts" },
  ];

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

  const handleMouseEnter = () => {
    stopAutoScroll();
  };

  const handleMouseLeave = () => {
    startAutoScroll();
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    toast({
      description: isLiked ? "좋아요를 취소했습니다" : "좋아요를 눌렀습니다",
    });
  };

  const handleComment = () => {
    if (commentText.trim()) {
      const newComment = {
        author: "나",
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
    toast({
      description: "링크가 복사되었습니다",
    });
  };

  const handleCreateNew = () => {
    toast({
      description: "스튜디오로 이동합니다",
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
            className="overflow-x-hidden scrollbar-hide"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="flex gap-6">
              {duplicatedShortForms.map((shortForm, index) => (
                <ShortFormCard
                  key={`${shortForm.title}-${index}`}
                  thumbnailSrc="/placeholder.svg"
                  title={shortForm.title}
                  duration={shortForm.duration}
                  likes={shortForm.likes}
                  comments={shortForm.comments}
                  platform={shortForm.platform}
                  onClick={() => setSelectedShort(shortForm)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Short Form Detail Modal */}
      <Dialog open={!!selectedShort} onOpenChange={() => setSelectedShort(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{selectedShort?.title}</DialogTitle>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-6 h-full min-h-0">
            {/* Left: Video (9:16) */}
            <div className="aspect-[9/16] bg-secondary/30 rounded-lg overflow-hidden w-full max-w-[350px]">
              <img 
                src="/placeholder.svg" 
                alt={selectedShort?.title} 
                className="w-full h-full object-cover"
              />
            </div>

            {/* Right: Actions */}
            <div className="flex flex-col gap-4 h-full min-h-0">
              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  variant={isLiked ? "default" : "outline"}
                  onClick={handleLike}
                  className="flex-1"
                >
                  <Heart className={`w-4 h-4 mr-2 ${isLiked ? "fill-current" : ""}`} />
                  좋아요 {selectedShort?.likes}
                </Button>
                <Button variant="outline" onClick={handleShare}>
                  <Share2 className="w-4 h-4 mr-2" />
                  공유하기
                </Button>
              </div>

              {/* Create New Button */}
              <Button onClick={handleCreateNew} className="w-full">
                <Sparkles className="w-4 h-4 mr-2" />
                이 스타일로 새로운 작품 만들기
              </Button>

              {/* Comments Section */}
              <div className="flex flex-col gap-3 flex-1 min-h-0">
                <h3 className="font-semibold flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  댓글 {comments.length}
                </h3>
                
                {/* Comments List */}
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

                {/* Comment Input */}
                <div className="flex gap-2">
                  <Textarea
                    placeholder="댓글을 입력하세요..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="min-h-[60px] resize-none"
                    rows={2}
                  />
                  <Button onClick={handleComment} disabled={!commentText.trim()} className="h-[60px]">
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
