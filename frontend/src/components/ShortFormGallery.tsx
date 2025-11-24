import { useState, useEffect, useRef } from "react";
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

interface ShortForm {
  id: number;
  title: string;
  thumbnailUrl: string;
  videoUrl?: string; // 실제 비디오 URL
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
  // Mock 숏폼을 한 번만 생성하고 재사용
  const mockShortFormsRef = useRef<ShortForm[]>(generateMockShortForms());
  
  const [allShortForms, setAllShortForms] = useState<ShortForm[]>([]);
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
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);

  const ITEMS_PER_PAGE = 12;

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

  // Load public short forms from localStorage
  const loadPublicShortForms = () => {
    const publicShortForms = JSON.parse(localStorage.getItem('public_shortforms') || '[]');
    const publicShortFormsFormatted: ShortForm[] = publicShortForms.map((sf: any) => ({
      id: sf.id,
      title: sf.title,
      thumbnailUrl: sf.thumbnailUrl || "/placeholder.svg",
      videoUrl: sf.videoUrl || sf.thumbnailUrl, // videoUrl이 없으면 thumbnailUrl을 비디오 URL로 사용
      likes: sf.likes || 0,
      comments: sf.comments || 0,
      duration: sf.duration || "0:15",
      createdAt: new Date(sf.createdAt),
      tags: sf.tags || [],
    }));
    
    // Combine with mock short forms (public short forms first, mock forms with fixed order)
    setAllShortForms([...publicShortFormsFormatted, ...mockShortFormsRef.current]);
  };

  useEffect(() => {
    loadPublicShortForms();
  }, []);

  // Reset likes count and load comments when short form changes
  useEffect(() => {
    if (selectedShort) {
      setLikesCount(0);
      const liked = getLikedShorts();
      const likedState = liked.has(selectedShort.id);
      setIsLiked(likedState);
      
      // Load comments from localStorage
      const savedComments = localStorage.getItem(`short_comments_${selectedShort.id}`);
      if (savedComments) {
        setComments(JSON.parse(savedComments));
      } else {
        setComments([]);
      }
    } else {
      setIsLiked(false);
      setComments([]);
    }
  }, [selectedShort]);

  // Listen to storage events and custom events to reload data
  useEffect(() => {
    const handleStorageChange = () => {
      loadPublicShortForms();
      // localStorage에서 통계 불러와서 업데이트
      setAllShortForms(prev => prev.map(shortForm => {
        const stats = JSON.parse(localStorage.getItem(`short_stats_${shortForm.id}`) || '{}');
        if (stats.likes !== undefined || stats.comments !== undefined) {
          return {
            ...shortForm,
            likes: stats.likes !== undefined ? stats.likes : shortForm.likes,
            comments: stats.comments !== undefined ? stats.comments : shortForm.comments
          };
        }
        return shortForm;
      }));
    };
    
    const handleShortStatsUpdate = (e: CustomEvent) => {
      const { id, likes, comments } = e.detail;
      setAllShortForms(prev => prev.map(shortForm => {
        if (shortForm.id === id) {
          return {
            ...shortForm,
            ...(likes !== undefined && { likes }),
            ...(comments !== undefined && { comments })
          };
        }
        return shortForm;
      }));
    };
    
    // Listen for storage events (from other tabs)
    window.addEventListener('storage', handleStorageChange);
    
    // Listen for custom events (from same tab)
    window.addEventListener('publicShortFormsUpdated', handleStorageChange);
    window.addEventListener('shortStatsUpdated', handleShortStatsUpdate as EventListener);
    
    // Also check periodically for same-tab changes
    const interval = setInterval(loadPublicShortForms, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('publicShortFormsUpdated', handleStorageChange);
      window.removeEventListener('shortStatsUpdated', handleShortStatsUpdate as EventListener);
      clearInterval(interval);
    };
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
  }, [allShortForms, sortBy, searchQuery]);

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
    
    // 로그인 상태 확인
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn) {
      setIsLoginOpen(true);
      return;
    }
    
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    
    // 카드 목록의 좋아요 수 업데이트
    const updatedLikes = Math.max(0, newLikedState ? selectedShort.likes + 1 : selectedShort.likes - 1);
    
    // 선택된 숏폼의 좋아요 수 즉시 업데이트
    setSelectedShort(prev => prev ? { ...prev, likes: updatedLikes } : null);
    
    setAllShortForms(prev => prev.map(shortForm => {
      if (shortForm.id === selectedShort.id) {
        return {
          ...shortForm,
          likes: updatedLikes
        };
      }
      return shortForm;
    }));
    
    saveLikedShort(selectedShort.id, newLikedState);
    
    // localStorage에 좋아요 수 저장
    const stats = JSON.parse(localStorage.getItem(`short_stats_${selectedShort.id}`) || '{}');
    stats.likes = updatedLikes;
    localStorage.setItem(`short_stats_${selectedShort.id}`, JSON.stringify(stats));
    
    // storage 이벤트 발생시켜 다른 컴포넌트에도 알림
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('shortStatsUpdated', { detail: { id: selectedShort.id, likes: updatedLikes } }));
    
    toast({ 
      description: newLikedState ? "좋아요를 눌렀습니다" : "좋아요를 취소했습니다",
      status: "default",
    });
  };

  const handleComment = () => {
    if (commentText.trim() && selectedShort) {
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
      localStorage.setItem(`short_comments_${selectedShort.id}`, JSON.stringify(updatedComments));
      
      // 카드 목록의 댓글 수 업데이트
      const updatedCommentsCount = updatedComments.length;
      setAllShortForms(prev => prev.map(shortForm => {
        if (shortForm.id === selectedShort.id) {
          return {
            ...shortForm,
            comments: updatedCommentsCount
          };
        }
        return shortForm;
      }));
      
      // localStorage에 댓글 수 저장
      const stats = JSON.parse(localStorage.getItem(`short_stats_${selectedShort.id}`) || '{}');
      stats.comments = updatedCommentsCount;
      localStorage.setItem(`short_stats_${selectedShort.id}`, JSON.stringify(stats));
      
      // storage 이벤트 발생시켜 다른 컴포넌트에도 알림
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('shortStatsUpdated', { detail: { id: selectedShort.id, comments: updatedCommentsCount } }));
      
      toast({ 
        description: "댓글이 등록되었습니다",
        status: "default",
      });
      setCommentText("");
    }
  };

  const handleShare = () => {
    const url = selectedShort ? `${window.location.origin}/shortform-gallery?short=${selectedShort.id}` : window.location.href;
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {displayedShortForms.map((shortForm) => (
            <div
              key={shortForm.id}
              className="group relative bg-card rounded-2xl overflow-hidden border border-border/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 cursor-pointer"
              onClick={() => setSelectedShort(shortForm)}
            >
              {/* 9:16 Video */}
              <div className="aspect-[9/16] bg-secondary/30 relative">
                {shortForm.videoUrl ? (
                  <video
                    src={shortForm.videoUrl}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                    autoPlay
                  />
                ) : shortForm.thumbnailUrl && !shortForm.thumbnailUrl.endsWith('.svg') && !shortForm.thumbnailUrl.endsWith('.jpg') && !shortForm.thumbnailUrl.endsWith('.png') ? (
                  // thumbnailUrl이 비디오 URL일 수 있음
                  <video
                    src={shortForm.thumbnailUrl}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                    autoPlay
                  />
                ) : (
                  <img
                    src={shortForm.thumbnailUrl || "/placeholder.svg"}
                    alt={shortForm.title}
                    className="w-full h-full object-cover"
                  />
                )}

                {/* Duration badge */}
                <div className="absolute top-3 left-3 bg-background/90 backdrop-blur-sm rounded-lg px-2.5 py-1 shadow-md z-10">
                  <span className="text-xs font-medium text-foreground">
                    {shortForm.duration}
                  </span>
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
      <Dialog open={!!selectedShort} onOpenChange={(open) => {
        if (!open) {
          // 창 닫을 때 카드에 반영
          if (selectedShort) {
            setAllShortForms(prev => prev.map(shortForm => {
              if (shortForm.id === selectedShort.id) {
                return {
                  ...shortForm,
                  likes: selectedShort.likes,
                  comments: comments.length
                };
              }
              return shortForm;
            }));
          }
          setSelectedShort(null);
          setIsLiked(false);
          setLikesCount(0);
          setComments([]);
          setCommentText("");
        }
      }}>
        <DialogContent className="max-w-[800px] w-[90vw] overflow-hidden p-0 gap-0">
          <div className="flex md:flex-row flex-col">
            {/* Left: Short Form Video (9:16 ratio) */}
            <div className="bg-background flex items-center justify-center p-0 border-r border-border aspect-[9/16] w-full md:w-[300px] md:flex-shrink-0 rounded-l-lg overflow-hidden relative">
              {selectedShort?.videoUrl || (selectedShort?.thumbnailUrl && !selectedShort.thumbnailUrl.endsWith('.svg') && !selectedShort.thumbnailUrl.endsWith('.jpg') && !selectedShort.thumbnailUrl.endsWith('.png')) ? (
                <video
                  src={selectedShort?.videoUrl || selectedShort?.thumbnailUrl}
                  className="w-full h-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                  controls
                />
              ) : (
                <img 
                  src={selectedShort?.thumbnailUrl || "/placeholder.svg"} 
                  alt={selectedShort?.title} 
                  className="w-full h-full object-cover"
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
                    className="h-8 px-3 gap-2 hover:bg-primary/10 hover:text-primary"
                  >
                    <Heart className={`h-4 w-4 ${isLiked ? "fill-destructive text-destructive" : ""}`} />
                    <span className="text-sm font-semibold text-foreground">
                        {selectedShort ? selectedShort.likes.toLocaleString() : "0"}
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
                    className="h-[40px] px-6 bg-primary hover:bg-primary/90 text-white disabled:opacity-50"
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

export default ShortFormGallery;