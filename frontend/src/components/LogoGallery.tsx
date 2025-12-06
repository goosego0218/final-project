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
import Footer from "@/components/Footer";
import LogoDetailModal from "@/components/LogoDetailModal";
import {
  getLogoGallery,
  SortOption,
  GalleryItem,
} from "@/lib/api";

interface LogoGalleryProps {
  searchQuery?: string;
  initialSelectedProdId?: number;
}

const LogoGallery = ({ searchQuery = "", initialSelectedProdId }: LogoGalleryProps) => {
  const [sortBy, setSortBy] = useState<SortOption>("latest");
  const [pageIndex, setPageIndex] = useState(0); // 0-based 페이지 인덱스
  const [allLogos, setAllLogos] = useState<GalleryItem[]>([]); // 누적된 모든 로고 데이터
  const [selectedLogo, setSelectedLogo] = useState<GalleryItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const ITEMS_PER_PAGE = 12;

  // 갤러리 데이터 조회: 항상 DB에서 직접 조회 (페이지 인덱스 기반, 서버에서 누적 범위까지 잘라서 가져옴)
  // - pageIndex = 0  → skip=0, limit=12  (최신 12개)
  // - pageIndex = 1  → skip=0, limit=24  (최신 24개)
  //   이런 식으로, "현재까지 보여줄 전체 개수"를 서버 쿼리에서 결정하게 함
  const fetchPage = async (targetPageIndex: number) => {
    setIsLoading(true);
    try {
      const skip = 0;
      const limit = (targetPageIndex + 1) * ITEMS_PER_PAGE;
      const data = await getLogoGallery(
        sortBy,
        skip,
        limit,
        searchQuery || undefined
      );

      // 항상 서버에서 내려온 전체 구간으로 교체
      setAllLogos(data.items || []);

      const loadedCount = data.items?.length ?? 0;
      const totalCount = data.total_count ?? loadedCount;
      setHasMore(loadedCount < totalCount);
    } catch (e) {
      // TODO: 에러 토스트 필요하면 여기에서 처리
      console.error("Failed to load logo gallery:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // 정렬/검색 조건이 바뀌면 첫 페이지부터 다시 조회
  useEffect(() => {
    setPageIndex(0);
    setHasMore(true);
    fetchPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, searchQuery]);

  // 표시할 로고 목록 (누적된 모든 데이터)
  const displayedLogos = allLogos;

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
    const nextPage = pageIndex + 1;
    setPageIndex(nextPage);
    fetchPage(nextPage);
  };

  const handleSortChange = (value: SortOption) => {
    setSortBy(value);
    setAllLogos([]); // 정렬 변경 시 누적 데이터 초기화 (fetchPage에서 다시 채움)
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
