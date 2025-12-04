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
  const [pageIndex, setPageIndex] = useState(0); // 0-based 페이지 인덱스
  const [allShorts, setAllShorts] = useState<GalleryItem[]>([]); // 누적된 모든 쇼츠 데이터
  const [selectedShort, setSelectedShort] = useState<GalleryItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const ITEMS_PER_PAGE = 12;

  // 갤러리 데이터 조회: 항상 DB에서 직접 조회 (페이지 인덱스 기반, 서버에서 누적 범위까지 잘라서 가져옴)
  const fetchPage = async (targetPageIndex: number) => {
    setIsLoading(true);
    try {
      const skip = 0;
      const limit = (targetPageIndex + 1) * ITEMS_PER_PAGE;
      const data = await getShortsGallery(
        sortBy,
        skip,
        limit,
        searchQuery || undefined
      );

      // 항상 서버에서 내려온 전체 구간으로 교체
      setAllShorts(data.items || []);

      const loadedCount = data.items?.length ?? 0;
      const totalCount = data.total_count ?? loadedCount;
      setHasMore(loadedCount < totalCount);
    } catch (e) {
      console.error("Failed to load shorts gallery:", e);
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

  // 표시할 쇼츠 목록 (누적된 모든 데이터)
  const displayedShorts = allShorts;

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
    const nextPage = pageIndex + 1;
    setPageIndex(nextPage);
    fetchPage(nextPage);
  };

  const handleSortChange = (value: SortOption) => {
    setSortBy(value);
    setAllShorts([]); // 정렬 변경 시 누적 데이터 초기화 (fetchPage에서 다시 채움)
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
