import { Heart, MessageCircle } from "lucide-react";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLogoGallery, GalleryItem } from "@/lib/api";

const PopularLogosHomeSection = () => {
  // 좋아요순 상위 12개 로고를 DB에서 조회
  const { data, isLoading } = useQuery({
    queryKey: ["homePopularLogos"],
    queryFn: () => getLogoGallery("likes", 0, 12),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const logos: GalleryItem[] = data?.items ?? [];

  useEffect(() => {
    // 향후 추적/로그 등이 필요하면 여기에서 처리
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

      {/* 가로 스크롤 카드 리스트 */}
      <div className="w-full overflow-x-auto scrollbar-hide">
        <div className="flex gap-6 px-12 py-2">
          {logos.map((logo) => (
            <div
              key={logo.prod_id}
              className="group relative bg-card rounded-2xl overflow-hidden border border-border/50 hover:shadow-xl hover:scale-[1.05] transition-all duration-200 cursor-pointer flex-shrink-0 w-64"
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
                      <Heart className="w-5 h-5 fill-red-500 text-red-500" />
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
  );
};

export default PopularLogosHomeSection;
