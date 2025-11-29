import { Heart, MessageCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLogoGallery, GalleryItem } from "@/lib/api";
import LogoDetailModal from "@/components/LogoDetailModal";

const PopularLogosHomeSection = () => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollIntervalRef = useRef<number | null>(null);
  const [selectedLogo, setSelectedLogo] = useState<GalleryItem | null>(null);

  // 좋아요순 상위 12개 로고를 DB에서 조회
  const { data, isLoading } = useQuery({
    queryKey: ["homePopularLogos"],
    queryFn: () => getLogoGallery("likes", 0, 12),
    // Home 화면 진입 시마다 DB에서 최신 데이터 한 번 가져오기
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: true,
  });

  const logos: GalleryItem[] = data?.items ?? [];

  // 자동 스크롤 (오른쪽 → 왼쪽)
  useEffect(() => {
    if (!scrollContainerRef.current || logos.length === 0) {
      return;
    }

    const container = scrollContainerRef.current;

    const startAutoScroll = () => {
      if (scrollIntervalRef.current !== null) return;

      scrollIntervalRef.current = window.setInterval(() => {
        if (!container) return;

        // 내용이 컨테이너보다 넓지 않으면 스크롤하지 않음
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

    startAutoScroll();

    // 마우스 호버 시 정지
    const handleMouseEnter = () => stopAutoScroll();
    const handleMouseLeave = () => startAutoScroll();

    container.addEventListener("mouseenter", handleMouseEnter);
    container.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      stopAutoScroll();
      container.removeEventListener("mouseenter", handleMouseEnter);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [logos]);

  if (isLoading) {
    return (
      <section className="w-full py-24 bg-gradient-to-b from-background to-secondary/20 overflow-hidden">
        <div className="w-full px-12 mb-12">
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              가장 인기 있는 로고
            </h2>
            <p className="text-muted-foreground text-lg">
              커뮤니티에서 가장 사랑받는 로고 디자인을 만나보세요
            </p>
          </div>
        </div>
        <div className="w-full flex justify-center items-center">
          <div className="text-muted-foreground">로딩 중...</div>
        </div>
      </section>
    );
  }

  if (!logos.length) {
    return null;
  }

  return (
    <>
      <section className="w-full py-24 bg-gradient-to-b from-background to-secondary/20 overflow-hidden">
        <div className="w-full px-12 mb-12">
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              가장 인기 있는 로고
            </h2>
            <p className="text-muted-foreground text-lg">
              커뮤니티에서 가장 사랑받는 로고 디자인을 만나보세요
            </p>
          </div>
        </div>

        {/* Scrolling gallery */}
        <div
          ref={scrollContainerRef}
          className="overflow-x-hidden overflow-y-visible scrollbar-hide"
        >
          <div className="flex gap-6 px-12 py-2">
            {/* 무한 스크롤 느낌을 위해 데이터를 2~3번 정도 반복 */}
            {[...logos, ...logos, ...logos].map((logo, index) => (
              <div
                key={`${logo.prod_id}-${index}`}
                className="group relative bg-card rounded-2xl overflow-hidden border border-border/50 hover:shadow-xl hover:scale-[1.05] transition-all duration-200 cursor-pointer flex-shrink-0 w-64"
                onClick={() => setSelectedLogo(logo)}
              >
                <div className="aspect-square bg-secondary/30 relative">
                  <img
                    src={logo.file_url}
                    alt={`로고 ${logo.prod_id}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/placeholder.svg";
                    }}
                  />

                  {/* 호버 시 좋아요/댓글 정보 */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                    <div className="flex items-center gap-6 text-white">
                      <span className="flex items-center gap-2">
                        <Heart
                          className={`w-5 h-5 ${
                            logo.is_liked ? "fill-red-500 text-red-500" : ""
                          }`}
                        />
                        {logo.like_count.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-2">
                        <MessageCircle className="w-5 h-5" />
                        {logo.comment_count.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 갤러리와 동일한 공통 상세 모달 사용 */}
      <LogoDetailModal
        open={!!selectedLogo}
        logo={selectedLogo}
        onClose={() => setSelectedLogo(null)}
      />
    </>
  );
};

export default PopularLogosHomeSection;
