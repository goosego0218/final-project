import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Heart, MessageCircle, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AuthModals } from "@/components/AuthModals";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  GalleryItem,
  Comment,
  getComments,
  createComment,
  deleteComment,
  toggleLike,
  getLikeStatus,
} from "@/lib/api";
import { Trash2, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ShortFormDetailModalProps {
  open: boolean;
  short: GalleryItem | null;
  onClose: () => void;
}

/**
 * 숏폼 상세 모달 (갤러리/메인에서 공통 사용)
 * - 좋아요 토글
 * - 댓글 목록/작성
 * - 공유 버튼
 */
const ShortFormDetailModal = ({ open, short, onClose }: ShortFormDetailModalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isLiked, setIsLiked] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [deleteCommentId, setDeleteCommentId] = useState<number | null>(null);

  // 현재 사용자 ID 가져오기 (JWT 토큰에서)
  const getCurrentUserId = (): number | null => {
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
      if (!token) {
        console.log('[getCurrentUserId] No token found');
        return null;
      }
      
      // JWT 토큰 디코딩 (payload는 두 번째 부분)
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.log('[getCurrentUserId] Invalid token format');
        return null;
      }
      
      const payload = JSON.parse(atob(parts[1]));
      const userId = payload.sub || payload.user_id || payload.id;
      
      if (!userId) {
        console.log('[getCurrentUserId] No user ID in payload:', payload);
        return null;
      }
      
      // sub는 문자열로 저장되어 있으므로 숫자로 변환
      const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
      console.log('[getCurrentUserId] Found user ID:', userIdNum);
      return userIdNum;
    } catch (error) {
      console.error('[getCurrentUserId] Failed to decode token:', error);
      return null;
    }
  };

  const prodId = short?.prod_id;

  // 비디오 URL인지 확인
  const isVideoUrl = (url: string) => {
    return (
      url &&
      !url.endsWith(".svg") &&
      !url.endsWith(".jpg") &&
      !url.endsWith(".png") &&
      !url.startsWith("data:image")
    );
  };

  // 선택된 숏폼의 댓글 조회
  const { data: commentsData, refetch: refetchComments } = useQuery({
    queryKey: ["shortsComments", prodId],
    queryFn: () => getComments(prodId!),
    enabled: !!prodId,
  });

  // 선택된 숏폼의 좋아요 상태 조회
  const { data: likeStatus, refetch: refetchLikeStatus } = useQuery({
    queryKey: ["shortsLikeStatus", prodId],
    queryFn: () => getLikeStatus(prodId!),
    enabled: !!prodId,
  });

  useEffect(() => {
    if (likeStatus) {
      setIsLiked(likeStatus.is_liked);
    } else {
      setIsLiked(false);
    }
  }, [likeStatus, prodId]);

  // 좋아요 토글 mutation
  const toggleLikeMutation = useMutation({
    mutationFn: (id: number) => toggleLike(id),
    onSuccess: async (data) => {
      setIsLiked(data.is_liked);

      // 갤러리 / 메인 인기 섹션 모두 최신 데이터로 갱신
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["shortsGallery"] }),
        queryClient.invalidateQueries({ queryKey: ["homePopularShorts"] }),
      ]);

      // 현재 모달/리스트의 like_count, is_liked도 서버 값으로 동기화
      if (short) {
        short.like_count = data.like_count;
        (short as any).is_liked = data.is_liked;
      }
      refetchLikeStatus();

      toast({
        description: data.is_liked ? "좋아요를 눌렀습니다" : "좋아요를 취소했습니다",
      });
    },
    onError: (error: any) => {
      // 에러 객체에서 다양한 속성 확인
      const msg = String(error?.message || error?.detail || error || "").toLowerCase();
      const status = error?.status || error?.response?.status || error?.statusCode;
      
      // 401 상태 코드 또는 인증 관련 메시지가 있으면 로그인 모달 표시
      if (
        status === 401 ||
        msg.includes("401") ||
        msg.includes("unauthorized") ||
        msg.includes("not authenticated") ||
        msg.includes("authentication") ||
        msg.includes("로그인") ||
        msg.includes("login required")
      ) {
        setIsLoginOpen(true);
      } else {
        // 디버깅용: 실제 에러 내용 확인
        console.error("[ShortFormDetailModal] 좋아요 에러:", error);
        toast({
          description: "좋아요 처리에 실패했습니다",
          variant: "destructive",
        });
      }
    },
  });

  // 댓글 작성 mutation
  const createCommentMutation = useMutation({
    mutationFn: (content: string) => createComment({ prod_id: prodId!, content }),
    onSuccess: async () => {
      setCommentText("");
      await refetchComments();
      // 갤러리 / 메인 인기 섹션도 새로고침 (comment_count 반영)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["shortsGallery"] }),
        queryClient.invalidateQueries({ queryKey: ["homePopularShorts"] }),
      ]);
      toast({ description: "댓글이 등록되었습니다" });
    },
    onError: (error: any) => {
      const msg = String(error?.message || error?.detail || error || "").toLowerCase();
      const status = error?.status || error?.response?.status || error?.statusCode;
      
      if (
        status === 401 ||
        msg.includes("401") ||
        msg.includes("unauthorized") ||
        msg.includes("not authenticated") ||
        msg.includes("authentication") ||
        msg.includes("로그인") ||
        msg.includes("login required")
      ) {
        setIsLoginOpen(true);
      } else {
        console.error("[ShortFormDetailModal] 댓글 작성 에러:", error);
        toast({
          description: "댓글 작성에 실패했습니다",
          variant: "destructive",
        });
      }
    },
  });

  // 댓글 삭제 mutation
  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: number) => deleteComment(commentId),
    onSuccess: async () => {
      await refetchComments();
      // 갤러리 / 메인 인기 섹션도 새로고침 (comment_count 반영)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["shortsGallery"] }),
        queryClient.invalidateQueries({ queryKey: ["homePopularShorts"] }),
      ]);
      toast({ description: "댓글이 삭제되었습니다" });
    },
    onError: (error: any) => {
      console.error("[ShortFormDetailModal] 댓글 삭제 에러:", error);
      toast({
        description: error?.message || "댓글 삭제에 실패했습니다",
        variant: "destructive",
      });
    },
  });

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

  const handleLike = () => {
    if (!short || toggleLikeMutation.isPending) return;
    toggleLikeMutation.mutate(short.prod_id);
  };

  const handleComment = () => {
    if (!short) return;
    const text = commentText.trim();
    if (!text) return;
    createCommentMutation.mutate(text);
  };

  const handleShare = () => {
    if (!short) return;
    const url = `${window.location.origin}/shortform-gallery?short=${short.prod_id}`;
    navigator.clipboard.writeText(url);
    toast({ description: "링크가 복사되었습니다" });
  };

  const handleClose = () => {
    setCommentText("");
    setIsLiked(false);
    setIsLoginOpen(false);
    setIsSignUpOpen(false);
    onClose();
  };

  const comments: Comment[] = commentsData?.comments ?? [];
  const url = short?.file_url || "";
  const isVideo = isVideoUrl(url);

  return (
    <>
      <Dialog open={open && !!short} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="max-w-[800px] w-[90vw] overflow-hidden p-0 gap-0">
          {short && (
            <div className="flex md:flex-row flex-col">
              {/* Left: Short Form Video/Image (9:16 ratio) */}
              <div className="bg-background flex items-center justify-center p-0 border-r border-border aspect-[9/16] w-full md:w-[300px] md:flex-shrink-0 rounded-l-lg overflow-hidden relative">
                {isVideo ? (
                  <video
                    src={url}
                    className="w-full h-full object-cover"
                    autoPlay
                    loop
                    playsInline
                    controls
                  />
                ) : (
                  <img
                    src={url}
                    alt={`숏폼 ${short.prod_id}`}
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
                    {comments.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                        아직 댓글이 없습니다. 첫 댓글을 남겨보세요!
                      </div>
                    ) : (
                      comments.map((comment) => {
                        const currentUserId = getCurrentUserId();
                        const isMyComment = currentUserId !== null && Number(comment.user_id) === Number(currentUserId);
                        
                        console.log('[Comment] Current user ID:', currentUserId, 'Comment user ID:', comment.user_id, 'Is my comment:', isMyComment);

                        return (
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
                                {isMyComment && (
                                  <Trash2
                                    className="h-3 w-3 text-muted-foreground cursor-pointer"
                                    onClick={() => setDeleteCommentId(comment.comment_id)}
                                  />
                                )}
                              </div>
                              <p className="text-sm text-foreground break-words">{comment.content}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Action Buttons - Middle */}
                <div className="p-3 border-t-[1px] border-border">
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
                        {short.like_count.toLocaleString()}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-8 px-3 gap-2 hover:bg-primary/10 hover:text-primary"
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

      {/* 로그인 모달 (공통) */}
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
        onLoginSuccess={async () => {
          setIsLoginOpen(false);
          setIsSignUpOpen(false);
          // 메뉴는 Navigation 컴포넌트에서 자동으로 갱신되므로 여기서는 처리하지 않음
          if (prodId) {
            queryClient.invalidateQueries({ queryKey: ["shortsLikeStatus", prodId] });
          }
        }}
      />

      {/* 댓글 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteCommentId !== null} onOpenChange={(open) => !open && setDeleteCommentId(null)}>
        <AlertDialogContent
          onOverlayClick={() => setDeleteCommentId(null)}
        >
          {/* X 버튼 */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 h-6 w-6 rounded-sm opacity-70 ring-offset-background transition-opacity hover:bg-transparent hover:opacity-100 hover:text-foreground focus:outline-none focus:ring-0 z-10"
            onClick={() => setDeleteCommentId(null)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
          <AlertDialogHeader>
            <AlertDialogTitle>댓글을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              삭제한 댓글은 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCommentMutation.isPending}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteCommentId !== null) {
                  deleteCommentMutation.mutate(deleteCommentId);
                  setDeleteCommentId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteCommentMutation.isPending}
            >
              {deleteCommentMutation.isPending ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ShortFormDetailModal;

