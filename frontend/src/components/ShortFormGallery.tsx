import { useState, useEffect } from "react";
import { Heart, MessageCircle, Play, Share2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import Footer from "@/components/Footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AuthModals } from "@/components/AuthModals";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getShortsGallery,
  getComments,
  createComment,
  toggleLike,
  getLikeStatus,
  SortOption,
  GalleryItem,
  Comment,
} from "@/lib/api";

interface ShortFormGalleryProps {
  searchQuery?: string;
}

const ShortFormGallery = ({ searchQuery = "" }: ShortFormGalleryProps) => {
  const [sortBy, setSortBy] = useState<SortOption>("latest");
  const [page, setPage] = useState(1);
  const [selectedShort, setSelectedShort] = useState<GalleryItem | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [commentText, setCommentText] = useState("");
  const { toast } = useToast();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const queryClient = useQueryClient();

  const ITEMS_PER_PAGE = 12;

  // 갤러리 데이터 조회
  const { data: galleryData, isLoading } = useQuery({
    queryKey: ['shortsGallery', sortBy, searchQuery],
    queryFn: () => getShortsGallery(sortBy, 0, 1000, searchQuery || undefined),
    staleTime: 30 * 1000, // 30초
  });

  // 선택된 쇼츠의 댓글 조회
  const { data: commentsData, refetch: refetchComments } = useQuery({
    queryKey: ['shortsComments', selectedShort?.prod_id],
    queryFn: () => getComments(selectedShort!.prod_id),
    enabled: !!selectedShort,
  });

  // 선택된 쇼츠의 좋아요 상태 조회
  const { data: likeStatus, refetch: refetchLikeStatus } = useQuery({
    queryKey: ['shortsLikeStatus', selectedShort?.prod_id],
    queryFn: () => getLikeStatus(selectedShort!.prod_id),
    enabled: !!selectedShort,
  });

  // 좋아요 토글 mutation
  const toggleLikeMutation = useMutation({
    mutationFn: (prodId: number) => toggleLike(prodId),
    onSuccess: (data) => {
      setIsLiked(data.is_liked);
      // 갤러리 데이터 갱신
      queryClient.invalidateQueries({ queryKey: ['shortsGallery'] });
      if (selectedShort) {
        refetchLikeStatus();
      }
      toast({
        description: data.is_liked ? "좋아요를 눌렀습니다" : "좋아요를 취소했습니다",
      });
    },
    onError: (error: any) => {
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        setIsLoginOpen(true);
      } else {
        toast({
          description: "좋아요 처리에 실패했습니다",
          variant: "destructive",
        });
      }
    },
  });

  // 댓글 작성 mutation
  const createCommentMutation = useMutation({
    mutationFn: (content: string) => createComment({ prod_id: selectedShort!.prod_id, content }),
    onSuccess: () => {
      setCommentText("");
      refetchComments();
      // 갤러리 데이터 갱신
      queryClient.invalidateQueries({ queryKey: ['shortsGallery'] });
      toast({
        description: "댓글이 등록되었습니다",
      });
    },
    onError: (error: any) => {
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        setIsLoginOpen(true);
      } else {
        toast({
          description: "댓글 작성에 실패했습니다",
          variant: "destructive",
        });
      }
    },
  });

  // 선택된 쇼츠 변경 시 좋아요 상태 업데이트
  useEffect(() => {
    if (likeStatus) {
      setIsLiked(likeStatus.is_liked);
    }
  }, [likeStatus]);

  // 페이지네이션된 쇼츠 목록
  const displayedShorts = galleryData?.items.slice(0, page * ITEMS_PER_PAGE) || [];
  const hasMore = galleryData ? displayedShorts.length < galleryData.items.length : false;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "오늘";
    if (days === 1) return "어제";
    if (days < 7) return `${days}일 전`;
    if (days < 30) return `${Math.floor(days / 7)}주 전`;
    return `${Math.floor(days / 30)}개월 전`;
  };

  const formatCommentDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return "방금 전";
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    return formatDate(dateString);
  };

  const handleLoadMore = () => {
    setPage((prev) => prev + 1);
  };

  const handleLike = () => {
    if (!selectedShort) return;
    toggleLikeMutation.mutate(selectedShort.prod_id);
  };

  const handleComment = () => {
    if (commentText.trim() && selectedShort) {
      createCommentMutation.mutate(commentText.trim());
    }
  };

  const handleShare = () => {
    const url = selectedShort
      ? `${window.location.origin}/shortform-gallery?short=${selectedShort.prod_id}`
      : window.location.href;
    navigator.clipboard.writeText(url);
    toast({
      description: "링크가 복사되었습니다",
    });
  };

  const handleSortChange = (value: SortOption) => {
    setSortBy(value);
    setPage(1);
  };

  const isVideoUrl = (url: string) => {
    return url && !url.endsWith('.svg') && !url.endsWith('.jpg') && !url.endsWith('.png') && !url.startsWith('data:image');
  };

  if (isLoading) {
    return (
      <div className="w-full bg-background min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="w-full bg-background">
      {/* Sort Bar */}
      <div className="max-w-7xl mx-auto px-8 py-6 flex justify-end border-b border-border/50">
        <div className="flex items-center gap-3">
          <Select value={sortBy} onValueChange={handleSortChange}>
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
        {displayedShorts.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            공개된 쇼츠가 없습니다.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {displayedShorts.map((shortForm) => (
                <div
                  key={shortForm.prod_id}
                  className="group relative bg-card rounded-2xl overflow-hidden border border-border/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 cursor-pointer"
                  onClick={() => setSelectedShort(shortForm)}
                >
                  {/* 9:16 Video */}
                  <div className="aspect-[9/16] bg-secondary/30 relative group">
                    {isVideoUrl(shortForm.file_url) ? (
                      <video
                        src={shortForm.file_url}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                        onMouseEnter={(e) => {
                          e.currentTarget.play().catch(() => {});
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.pause();
                          e.currentTarget.currentTime = 0;
                        }}
                      />
                    ) : (
                      <img
                        src={shortForm.file_url}
                        alt={`쇼츠 ${shortForm.prod_id}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder.svg";
                        }}
                      />
                    )}

                    {/* 재생 아이콘 오버레이 (비디오인 경우) */}
                    {isVideoUrl(shortForm.file_url) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-t-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-white/90 rounded-full p-3">
                          <Play className="h-6 w-6 text-primary fill-primary" />
                        </div>
                      </div>
                    )}

                    {/* Duration badge */}
                    <div className="absolute top-3 left-3 bg-background/90 backdrop-blur-sm rounded-lg px-2.5 py-1 shadow-md z-10">
                      <span className="text-xs font-medium text-foreground">0:15</span>
                    </div>
                  </div>

                  {/* Info section */}
                  <div className="p-4 bg-card">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Heart className="w-4 h-4" />
                          <span>{shortForm.like_count.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageCircle className="w-4 h-4" />
                          <span>{shortForm.comment_count}</span>
                        </div>
                      </div>
                      <span className="text-xs">{formatDate(shortForm.create_dt)}</span>
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
          </>
        )}
      </div>

      {/* Short Form Detail Modal */}
      <Dialog
        open={!!selectedShort}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedShort(null);
            setIsLiked(false);
            setCommentText("");
          }
        }}
      >
        <DialogContent className="max-w-[800px] w-[90vw] overflow-hidden p-0 gap-0">
          {selectedShort && (
            <div className="flex md:flex-row flex-col">
              {/* Left: Short Form Video (9:16 ratio) */}
              <div className="bg-background flex items-center justify-center p-0 border-r border-border aspect-[9/16] w-full md:w-[300px] md:flex-shrink-0 rounded-l-lg overflow-hidden relative">
                {isVideoUrl(selectedShort.file_url) ? (
                  <video
                    src={selectedShort.file_url}
                    className="w-full h-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                    controls
                  />
                ) : (
                  <img
                    src={selectedShort.file_url}
                    alt={`쇼츠 ${selectedShort.prod_id}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/placeholder.svg";
                    }}
                  />
                )}
              </div>

              {/* Right: Comments and Actions */}
              <div className="flex flex-col bg-background w-full md:w-[500px] md:flex-shrink-0 aspect-[9/16] md:aspect-auto md:h-[533px] rounded-r-lg">
                {/* Comments Section - Top */}
                <div className="flex-1 min-h-0 overflow-y-auto p-6">
                  <div className="space-y-4">
                    {!commentsData || commentsData.comments.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                        아직 댓글이 없습니다. 첫 댓글을 남겨보세요!
                      </div>
                    ) : (
                      commentsData.comments.map((comment: Comment) => (
                        <div key={comment.comment_id} className="flex gap-3">
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                              {comment.user_nickname.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm text-foreground">
                                {comment.user_nickname}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatCommentDate(comment.create_dt)}
                              </span>
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
                      disabled={toggleLikeMutation.isPending}
                      className="h-8 px-3 gap-2 hover:bg-primary/10 hover:text-primary"
                    >
                      <Heart
                        className={`h-4 w-4 ${isLiked ? "fill-destructive text-destructive" : ""}`}
                      />
                      <span className="text-sm font-semibold text-foreground">
                        {selectedShort.like_count.toLocaleString()}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-8 px-3 gap-2 hover:bg-primary/10 hover:text-primary"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span className="text-sm font-semibold text-foreground">
                        {selectedShort.comment_count.toLocaleString()}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleShare}
                      className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
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
                      className="h-[40px] min-h-[40px] max-h-[40px] resize-none flex-1 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary focus-visible:border-2"
                      rows={1}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (commentText.trim()) {
                            handleComment();
                          }
                        }
                      }}
                    />
                    <Button
                      onClick={handleComment}
                      disabled={!commentText.trim() || createCommentMutation.isPending}
                      className="h-[40px] px-6 bg-primary hover:bg-primary/90 text-white disabled:opacity-50"
                    >
                      {createCommentMutation.isPending ? "등록 중..." : "등록"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
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

export default ShortFormGallery;
