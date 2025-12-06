import { Heart, MessageCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getShortsGallery, GalleryItem } from "@/lib/api";
import ShortFormDetailModal from "./ShortFormDetailModal";

const PopularShortsHomeSection = () => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollIntervalRef = useRef<number | null>(null);
  const [selectedShort, setSelectedShort] = useState<GalleryItem | null>(null);

  // 좋아요순 상위 12개 숏폼을 DB에서 조회
  const { data, isLoading } = useQuery({
    queryKey: ["homePopularShorts"],
    queryFn: () => getShortsGallery("likes", 0, 12),
    // Home 화면 진입 시마다 DB에서 최신 데이터 한 번 가져오기
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: true,
  });

  const shorts: GalleryItem[] = data?.items ?? [];

  // 자동 스크롤 (오른쪽 → 왼쪽)
  const startAutoScroll = () => {
    if (scrollIntervalRef.current !== null) return;

    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;

    scrollIntervalRef.current = window.setInterval(() => {
      if (!container) return;
      if (container.scrollWidth <= container.clientWidth) return;

      container.scrollLeft += 1;
      if (container.scrollLeft >= container.scrollWidth - container.clientWidth) {
        container.scrollLeft = 0;
      }
    }, 20);
  };

  const stopAutoScroll = () => {
    if (scrollIntervalRef.current !== null) {
      window.clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  };

  useEffect(() => {
    if (!scrollContainerRef.current || shorts.length === 0) return;

    const container = scrollContainerRef.current;

    startAutoScroll();

    const handleMouseEnter = () => stopAutoScroll();
    const handleMouseLeave = () => startAutoScroll();

    container.addEventListener("mouseenter", handleMouseEnter);
    container.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      stopAutoScroll();
      container.removeEventListener("mouseenter", handleMouseEnter);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [shorts]);

  return (
    <>
      <section className="w-full py-24 bg-gradient-to-b from-background to-secondary/20">
        <div className="w-full px-12 mb-12">
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              가장 인기 있는 숏폼
            </h2>
            <p className="text-muted-foreground text-lg">
              커뮤니티에서 가장 사랑받는 숏폼 디자인을 만나보세요
            </p>
          </div>
        </div>

        {/* Scrolling gallery */}
        <div
          ref={scrollContainerRef}
          className="overflow-x-hidden overflow-y-visible scrollbar-hide"
        >
          <div className="flex gap-6 py-8 px-12">
            {[...shorts, ...shorts, ...shorts].map((shortForm, index) => {
              const isLiked = shortForm.is_liked ?? false;
              const isVideoUrl =
                shortForm.file_url &&
                !shortForm.file_url.endsWith(".svg") &&
                !shortForm.file_url.endsWith(".jpg") &&
                !shortForm.file_url.endsWith(".png") &&
                !shortForm.file_url.startsWith("data:image");

              return (
                <div
                  key={`${shortForm.prod_id}-${index}`}
                  className="group relative bg-card rounded-2xl overflow-hidden border border-border/50 hover:shadow-xl hover:scale-[1.05] transition-all duration-200 cursor-pointer flex-shrink-0 w-64"
                  onClick={() => setSelectedShort(shortForm)}
                >
                  <div className="aspect-[9/16] bg-secondary/30 relative">
                    {isVideoUrl ? (
                      <video
                        src={shortForm.file_url}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                        onLoadedMetadata={(e) => {
                          e.currentTarget.currentTime = 2.5;
                        }}
                        onEnded={(e) => {
                          e.currentTarget.pause();
                          e.currentTarget.currentTime = 2.5; // 끝나면 일시정지하고 썸네일 위치로
                        }}
                      />
                    ) : (
                      <img
                        src={shortForm.file_url}
                        alt={`숏폼 ${shortForm.prod_id}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder.svg";
                        }}
                      />
                    )}

                    {/* 호버 시 좋아요/댓글 정보 */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                      <div className="flex items-center gap-6 text-white">
                        <span className="flex items-center gap-2">
                          <Heart
                            className={`w-5 h-5 ${
                              isLiked ? "fill-red-500 text-red-500" : ""
                            }`}
                          />
                          {shortForm.like_count.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-2">
                          <MessageCircle className="w-5 h-5" />
                          {shortForm.comment_count.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 공통 숏폼 상세 모달 재사용 */}
      <ShortFormDetailModal
        open={!!selectedShort}
        short={selectedShort}
        onClose={() => setSelectedShort(null)}
      />
    </>
  );
};

export default PopularShortsHomeSection;
