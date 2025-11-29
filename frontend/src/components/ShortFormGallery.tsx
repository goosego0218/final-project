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
  const [allShorts, setAllShorts] = useState<GalleryItem[]>([]); // 누적된 모든 쇼츠 데이터
  const [selectedShort, setSelectedShort] = useState<GalleryItem | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [commentText, setCommentText] = useState("");
  const { toast } = useToast();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const queryClient = useQueryClient();

  const ITEMS_PER_PAGE = 12;

  // 사용자 ID 추출 (쿼리 키에 포함하여 사용자별 캐시 분리)
  const getUserId = () => {
    try {
      const profile = localStorage.getItem('userProfile');
      if (profile) {
        const parsed = JSON.parse(profile);
        return parsed.id || null;
      }
    } catch (e) {
      // ignore
    }
    return null;
  };

  const [userId, setUserId] = useState(getUserId());

  // 로그인 상태 변경 감지 및 사용자 ID 업데이트
  useEffect(() => {
    let isMounted = true;
    
    const checkUserChange = () => {
      if (!isMounted) return;
      
      const hasLoginFlag = localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true';
      const hasToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
      const currentLoggedIn = hasLoginFlag && !!hasToken;
      
      const newUserId = currentLoggedIn ? getUserId() : null;
      
      if (newUserId !== userId) {
        setUserId(newUserId);
        setPage(1); // 페이지 초기화
        setAllShorts([]); // 누적 데이터 초기화
        // 사용자가 변경되면 갤러리 쿼리 캐시 완전히 제거 (refetch는 useQuery가 자동으로 처리)
        queryClient.removeQueries({ queryKey: ['shortsGallery'] });
      }
    };

    // 초기 확인 (한 번만)
    checkUserChange();

    // storage 이벤트 리스너 (다른 탭에서 로그인/로그아웃 시)
    window.addEventListener('storage', checkUserChange);
    
    // 같은 탭에서의 변경도 감지하기 위해 interval 사용 (하지만 너무 자주 체크하지 않도록)
    const interval = setInterval(checkUserChange, 2000);

    return () => {
      isMounted = false;
      window.removeEventListener('storage', checkUserChange);
      clearInterval(interval);
    };
  }, [userId, queryClient]);

  // 갤러리 데이터 조회 (사용자 ID를 쿼리 키에 포함하여 사용자별 캐시 분리)
  // 페이지네이션: 한 번에 12개씩 가져오기
  const { data: galleryData, isLoading, refetch: refetchGallery } = useQuery({
    queryKey: ['shortsGallery', sortBy, searchQuery, userId, page],
    queryFn: () => getShortsGallery(sortBy, (page - 1) * ITEMS_PER_PAGE, ITEMS_PER_PAGE, searchQuery || undefined),
    staleTime: 0, // 캐시를 최신이 아닌 것으로 간주 (하지만 자동 refetch는 하지 않음)
    refetchOnMount: false, // 마운트 시 자동 refetch 방지 (한 번만 호출)
    refetchOnWindowFocus: false, // 창 포커스 시 자동 refetch 방지
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
    onSuccess: async (data) => {
      setIsLiked(data.is_liked);
      // 현재 페이지의 갤러리 데이터 갱신
      await refetchGallery();
      // 선택된 쇼츠의 좋아요 수 업데이트
      if (selectedShort) {
        // 선택된 쇼츠가 현재 페이지에 있으면 업데이트
        const updatedShort = galleryData?.items.find(
          (item) => item.prod_id === selectedShort.prod_id
        );
        if (updatedShort) {
          setSelectedShort({ ...updatedShort, like_count: data.like_count || updatedShort.like_count });
        }
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

  // 새로운 페이지 데이터가 로드되면 누적
  useEffect(() => {
    if (galleryData?.items) {
      if (page === 1) {
        // 첫 페이지는 교체
        setAllShorts(galleryData.items);
      } else {
        // 이후 페이지는 누적 (중복 제거)
        setAllShorts((prev) => {
          const existingIds = new Set(prev.map((short) => short.prod_id));
          const newItems = galleryData.items.filter((item) => !existingIds.has(item.prod_id));
          return [...prev, ...newItems];
        });
      }
    }
  }, [galleryData, page]);

  // 표시할 쇼츠 목록 (누적된 모든 데이터)
  const displayedShorts = allShorts;
  const hasMore = galleryData ? (page * ITEMS_PER_PAGE) < galleryData.total_count : false;

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
    // 페이지가 변경되면 useQuery가 자동으로 다음 페이지 데이터를 가져옴
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
    setAllShorts([]); // 정렬 변경 시 누적 데이터 초기화
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
                            <Heart className={`w-4 h-4 ${shortForm.is_liked ? "fill-destructive text-destructive" : ""}`} />
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
