import { useState, useEffect } from "react";
import { Heart, MessageCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import Footer from "@/components/Footer";
import LogoDetailModal from "@/components/LogoDetailModal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getLogoGallery,
  getComments,
  createComment,
  toggleLike,
  getLikeStatus,
  SortOption,
  GalleryItem,
  Comment,
} from "@/lib/api";

interface LogoGalleryProps {
  searchQuery?: string;
  initialSelectedProdId?: number;
}

const LogoGallery = ({ searchQuery = "", initialSelectedProdId }: LogoGalleryProps) => {
  const [sortBy, setSortBy] = useState<SortOption>("latest");
  const [page, setPage] = useState(1);
  const [allLogos, setAllLogos] = useState<GalleryItem[]>([]); // 누적된 모든 로고 데이터
  const [selectedLogo, setSelectedLogo] = useState<GalleryItem | null>(null);
  const { toast } = useToast();
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
        setAllLogos([]); // 누적 데이터 초기화
        // 사용자가 변경되면 갤러리 쿼리 캐시 완전히 제거 (refetch는 useQuery가 자동으로 처리)
        queryClient.removeQueries({ queryKey: ['logoGallery'] });
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
    queryKey: ['logoGallery', sortBy, searchQuery, userId, page],
    queryFn: () =>
      getLogoGallery(
        sortBy,
        (page - 1) * ITEMS_PER_PAGE,
        ITEMS_PER_PAGE,
        searchQuery || undefined
      ),
    // 갤러리 화면이 마운트될 때마다 항상 DB에서 최신 데이터를 가져오기
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // 선택된 로고의 댓글 조회
  // (상세 모달에서 댓글/좋아요를 처리하므로, 여기서는 리스트/선택만 관리)

  // 새로운 페이지 데이터가 로드되면 누적 (같은 prod_id는 항상 최신 데이터로 교체)
  useEffect(() => {
    if (!galleryData?.items) return;

    setAllLogos((prev) => {
      // 첫 페이지이거나 정렬/검색 조건이 바뀐 경우에는 전부 교체
      if (page === 1) {
        return galleryData.items;
      }

      // 이후 페이지에서는 기존 데이터에 병합하되,
      // 같은 prod_id가 있으면 서버에서 가져온 최신 데이터로 교체
      const byId = new Map<number, GalleryItem>();
      prev.forEach((logo) => {
        byId.set(logo.prod_id, logo);
      });
      galleryData.items.forEach((logo) => {
        byId.set(logo.prod_id, logo);
      });
      return Array.from(byId.values());
    });
  }, [galleryData, page]);

  // 표시할 로고 목록 (누적된 모든 데이터)
  const displayedLogos = allLogos;
  const hasMore = galleryData ? (page * ITEMS_PER_PAGE) < galleryData.total_count : false;

  // 초기 진입 시 특정 prod_id가 쿼리 파라미터로 넘어온 경우, 해당 로고를 자동으로 선택
  useEffect(() => {
    if (!initialSelectedProdId || selectedLogo) return;
    const target = allLogos.find((logo) => logo.prod_id === initialSelectedProdId);
    if (target) {
      setSelectedLogo(target);
    }
  }, [initialSelectedProdId, allLogos, selectedLogo]);

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

  const handleSortChange = (value: SortOption) => {
    setSortBy(value);
    setPage(1);
    setAllLogos([]); // 정렬 변경 시 누적 데이터 초기화
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
            <SelectTrigger className="w-[140px] focus:ring-[#7C22C8] focus:ring-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest" className="data-[highlighted]:bg-[#7C22C8] data-[highlighted]:text-white">
                최신순
              </SelectItem>
              <SelectItem value="likes" className="data-[highlighted]:bg-[#7C22C8] data-[highlighted]:text-white">
                좋아요순
              </SelectItem>
              <SelectItem value="comments" className="data-[highlighted]:bg-[#7C22C8] data-[highlighted]:text-white">
                댓글순
              </SelectItem>
              <SelectItem value="oldest" className="data-[highlighted]:bg-[#7C22C8] data-[highlighted]:text-white">
                오래된순
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Logo grid */}
      <div className="max-w-7xl mx-auto px-8 py-12">
        {displayedLogos.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            공개된 로고가 없습니다.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {displayedLogos.map((logo) => (
                <Card
                  key={logo.prod_id}
                  className="group cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-xl"
                  onClick={() => setSelectedLogo(logo)}
                >
                  <CardContent className="p-0">
                    <div className="aspect-square bg-muted rounded-t-lg overflow-hidden">
                      <img
                        src={logo.file_url}
                        alt={`로고 ${logo.prod_id}`}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder.svg";
                        }}
                      />
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Heart className={`w-4 h-4 ${logo.is_liked ? "fill-destructive text-destructive" : ""}`} />
                            {logo.like_count.toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="w-4 h-4" />
                            {logo.comment_count}
                          </span>
                        </div>
                        <span>{formatDate(logo.create_dt)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {hasMore && (
              <div className="text-center mt-8">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  className="hover:bg-[#7C22C8] hover:text-white hover:border-[#7C22C8]"
                >
                  더보기
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Logo Detail Modal - 공통 컴포넌트 사용 */}
      <LogoDetailModal
        open={!!selectedLogo}
        logo={selectedLogo}
        onClose={() => setSelectedLogo(null)}
      />

      <Footer />
    </div>
  );
};

export default LogoGallery;
