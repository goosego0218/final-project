import { useState, useEffect } from "react";
import { Heart, MessageCircle, Play } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getShortsGallery,
  SortOption,
  GalleryItem,
} from "@/lib/api";
import ShortFormDetailModal from "./ShortFormDetailModal";

interface ShortFormGalleryProps {
  searchQuery?: string;
  initialSelectedProdId?: number;
}

const ShortFormGallery = ({ searchQuery = "", initialSelectedProdId }: ShortFormGalleryProps) => {
  const [sortBy, setSortBy] = useState<SortOption>("latest");
  const [page, setPage] = useState(1);
  const [allShorts, setAllShorts] = useState<GalleryItem[]>([]); // 누적된 모든 쇼츠 데이터
  const [selectedShort, setSelectedShort] = useState<GalleryItem | null>(null);
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
    queryFn: () =>
      getShortsGallery(
        sortBy,
        (page - 1) * ITEMS_PER_PAGE,
        ITEMS_PER_PAGE,
        searchQuery || undefined
      ),
    // 쇼츠 갤러리 화면이 마운트될 때마다 항상 DB에서 최신 데이터를 가져오기
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });


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

  // 초기 진입 시 특정 prod_id가 쿼리 파라미터로 넘어온 경우, 해당 숏폼을 자동으로 선택
  useEffect(() => {
    if (!initialSelectedProdId || selectedShort) return;
    const target = allShorts.find((short) => short.prod_id === initialSelectedProdId);
    if (target) {
      setSelectedShort(target);
    }
  }, [initialSelectedProdId, allShorts, selectedShort]);

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

  const handleLoadMore = () => {
    setPage((prev) => prev + 1);
    // 페이지가 변경되면 useQuery가 자동으로 다음 페이지 데이터를 가져옴
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

      {/* Short Form Detail Modal - 갤러리/메인 공통 컴포넌트 사용 */}
      <ShortFormDetailModal
        open={!!selectedShort}
        short={selectedShort}
        onClose={() => setSelectedShort(null)}
      />

      <Footer />
    </div>
  );
};

export default ShortFormGallery;
