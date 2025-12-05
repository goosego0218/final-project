import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Share2, MessageCircle, Eye, Send, Sparkles, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import CreateFromStyleModal from "@/components/CreateFromStyleModal";
import { AuthModals } from "@/components/AuthModals";
import { getSharedItems, getLikedItems, MyPageItem } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const MyPage = () => {
  const { toast } = useToast();
  const [sharedFilter, setSharedFilter] = useState<"all" | "logo" | "short">("all");
  const [likedFilter, setLikedFilter] = useState<"all" | "logo" | "short">("all");
  const [selectedImage, setSelectedImage] = useState<{ url: string; title: string; type: "logo" | "short" } | null>(null);
  const [isCreateNewModalOpen, setIsCreateNewModalOpen] = useState(false);
  const [selectedItemForCreate, setSelectedItemForCreate] = useState<any>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const queryClient = useQueryClient();

  // 공유한 작품 조회 (DB)
  const { data: sharedItemsData, isLoading: isLoadingShared } = useQuery({
    queryKey: ['mypage', 'shared'],
    queryFn: getSharedItems,
    staleTime: 30 * 1000, // 30초
  });

  // 좋아요한 작품 조회 (DB)
  const { data: likedItemsData, isLoading: isLoadingLiked } = useQuery({
    queryKey: ['mypage', 'liked'],
    queryFn: getLikedItems,
    staleTime: 30 * 1000, // 30초
  });

  // 데이터 변환: MyPageItem -> 기존 형식
  const sharedItems = sharedItemsData?.items.map(item => ({
    id: item.prod_id,
    type: item.type,
    image: item.file_url || "/placeholder.svg",
    videoUrl: item.type === "short" ? item.file_url : undefined,
    title: item.title || (item.type === "logo" ? "로고" : "숏폼"),
    likes: item.likes,
    comments: item.comments,
    duration: item.type === "short" ? "0:15" : undefined,
    is_liked: item.is_liked,
  })) || [];

  const likedItems = likedItemsData?.items.map(item => ({
    id: item.prod_id,
    type: item.type,
    image: item.file_url || "/placeholder.svg",
    videoUrl: item.type === "short" ? item.file_url : undefined,
    title: item.title || (item.type === "logo" ? "로고" : "숏폼"),
    likes: item.likes,
    comments: item.comments,
    duration: item.type === "short" ? "0:15" : undefined,
    is_liked: item.is_liked,
  })) || [];

  const filteredSharedItems = sharedFilter === "all" 
    ? [...sharedItems.filter(item => item.type === "logo"), ...sharedItems.filter(item => item.type === "short")]
    : sharedItems.filter(item => item.type === sharedFilter);

  const filteredLikedItems = likedFilter === "all"
    ? [...likedItems.filter(item => item.type === "logo"), ...likedItems.filter(item => item.type === "short")]
    : likedItems.filter(item => item.type === likedFilter);

  // 비디오 URL인지 확인하는 헬퍼 함수
  const isVideoUrl = (url: string | undefined | null): boolean => {
    if (!url) return false;
    return !url.endsWith('.svg') && !url.endsWith('.jpg') && !url.endsWith('.png') && !url.endsWith('.jpeg') && !url.endsWith('.gif') && !url.startsWith('data:image');
  };

  // 아이템 클릭 핸들러 - 단순 미리보기 모달 열기
  const handleItemClick = (item: any) => {
    setSelectedImage({
      url: item.image,
      title: item.title,
      type: item.type,
    });
    // 로고인 경우 CreateFromStyleModal을 위한 데이터 저장
    if (item.type === "logo") {
      setSelectedItemForCreate(item);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="pt-20">
        <div className="max-w-6xl mx-auto px-8 py-16">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              마이페이지
            </h1>
            <p className="text-xl text-muted-foreground">
              내가 만든 작품과 좋아하는 작품들을 관리하세요
            </p>
          </div>
          
          <Tabs defaultValue="shared" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-8 mx-auto">
              <TabsTrigger value="shared">공유한 작품</TabsTrigger>
              <TabsTrigger value="liked">좋아요한 작품</TabsTrigger>
            </TabsList>
            
            <TabsContent value="shared" className="space-y-6">
              {isLoadingShared && (
                <div className="text-center py-16">
                  <p className="text-muted-foreground">로딩 중...</p>
                </div>
              )}
              {!isLoadingShared && sharedItems.length === 0 && (
                <div className="text-center py-16">
                  <p className="text-muted-foreground">공유한 작품이 없습니다.</p>
                </div>
              )}
              {!isLoadingShared && sharedItems.length > 0 && (
                <>
                  <div className="flex gap-2 mb-6">
                    <Badge 
                      variant={sharedFilter === "all" ? "default" : "outline"}
                      className="cursor-pointer px-4 py-2"
                      onClick={() => setSharedFilter("all")}
                    >
                      전체
                    </Badge>
                    <Badge 
                      variant={sharedFilter === "logo" ? "default" : "outline"}
                      className={`cursor-pointer px-4 py-2 ${
                        sharedFilter === "logo" 
                          ? "bg-[#7C22C8] text-white hover:bg-[#6B1DB5]" 
                          : ""
                      }`}
                      onClick={() => setSharedFilter("logo")}
                    >
                      로고
                    </Badge>
                    <Badge 
                      variant={sharedFilter === "short" ? "default" : "outline"}
                      className="cursor-pointer px-4 py-2"
                      onClick={() => setSharedFilter("short")}
                    >
                      숏폼
                    </Badge>
                  </div>
                  
                  {sharedFilter === "all" ? (
                <>
                  {/* 로고 섹션 */}
                  {sharedItems.filter(item => item.type === "logo").length > 0 && (
                    <div className="space-y-4">
                      <h2 className="text-2xl font-semibold text-foreground">로고</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {sharedItems.filter(item => item.type === "logo").map((item) => (
                          <Card
                            key={item.id}
                            className="group cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-xl"
                            onClick={() => handleItemClick(item)}
                          >
                            <CardContent className="p-0">
                              <div className="aspect-square bg-muted rounded-t-lg overflow-hidden">
                                <img
                                  src={item.image}
                                  alt={item.title}
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                />
                              </div>
                              <div className="p-4">
                                <div className="flex items-center justify-between text-sm text-muted-foreground">
                                  <div className="flex items-center gap-4">
                                    <span className="flex items-center gap-1">
                                      <Heart className={`w-4 h-4 ${item.is_liked ? "fill-destructive text-destructive" : ""}`} />
                                      {item.likes.toLocaleString()}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <MessageCircle className="w-4 h-4" />
                                      {item.comments || 0}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 숏폼 섹션 */}
                  {sharedItems.filter(item => item.type === "short").length > 0 && (
                    <div className="space-y-4 mt-8">
                      <h2 className="text-2xl font-semibold text-foreground">숏폼</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {sharedItems.filter(item => item.type === "short").map((item) => (
                          <div
                            key={item.id}
                            className="group relative bg-card rounded-2xl overflow-hidden border border-border/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 cursor-pointer"
                            onClick={() => handleItemClick(item)}
                          >
                            {/* 9:16 Thumbnail */}
                            <div className="aspect-[9/16] bg-secondary/30 relative">
                              <img
                                src={item.image}
                                alt={item.title}
                                className="w-full h-full object-cover"
                              />

                              {/* Duration badge */}
                              <div className="absolute top-3 left-3 bg-background/90 backdrop-blur-sm rounded-lg px-2.5 py-1 shadow-md">
                                <span className="text-xs font-medium text-foreground">
                                  {item.duration || "0:15"}
                                </span>
                              </div>

                              {/* Hover overlay with play button */}
                              <div className="absolute inset-0 bg-background/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                                  <Play className="w-8 h-8 text-primary-foreground fill-primary-foreground ml-1" />
                                </div>
                              </div>
                            </div>

                            {/* Info section */}
                            <div className="p-4 bg-card">
                              <div className="flex items-center justify-between text-sm text-muted-foreground">
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-1">
                                    <Heart className={`w-4 h-4 ${item.is_liked ? "fill-destructive text-destructive" : ""}`} />
                                    <span>{item.likes.toLocaleString()}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <MessageCircle className="w-4 h-4" />
                                    <span>{item.comments || 0}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className={`grid ${sharedFilter === "logo" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"}`}>
                  {filteredSharedItems.map((item) => (
                    item.type === "logo" ? (
                      <Card
                        key={item.id}
                        className="group cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-xl"
                        onClick={() => handleItemClick(item)}
                      >
                        <CardContent className="p-0">
                          <div className="aspect-square bg-muted rounded-t-lg overflow-hidden">
                            <img
                              src={item.image}
                              alt={item.title}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            />
                          </div>
                          <div className="p-4">
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                              <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1">
                                  <Heart className="w-4 h-4" />
                                  {item.likes.toLocaleString()}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MessageCircle className="w-4 h-4" />
                                  {item.comments || 0}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <div
                        key={item.id}
                        className="group relative bg-card rounded-2xl overflow-hidden border border-border/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 cursor-pointer"
                        onClick={() => handleItemClick(item)}
                      >
                        <div className="aspect-[9/16] bg-secondary/30 relative">
                          {isVideoUrl(item.videoUrl || item.image) ? (
                            <video
                              src={item.videoUrl || item.image}
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                              preload="metadata"
                              onLoadedMetadata={(e) => {
                                e.currentTarget.pause();
                                e.currentTarget.currentTime = 0;
                              }}
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
                              src={item.image}
                              alt={item.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "/placeholder.svg";
                              }}
                            />
                          )}
                          <div className="absolute top-3 left-3 bg-background/90 backdrop-blur-sm rounded-lg px-2.5 py-1 shadow-md">
                            <span className="text-xs font-medium text-foreground">
                              {item.duration || "0:15"}
                            </span>
                          </div>
                          <div className="absolute inset-0 bg-background/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                              <Play className="w-8 h-8 text-primary-foreground fill-primary-foreground ml-1" />
                            </div>
                          </div>
                        </div>
                        <div className="p-4 bg-card">
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1">
                                <Heart className={`w-4 h-4 ${item.is_liked ? "fill-destructive text-destructive" : ""}`} />
                                <span>{item.likes.toLocaleString()}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <MessageCircle className="w-4 h-4" />
                                <span>{item.comments || 0}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
                </>
              )}
            </TabsContent>
            
            <TabsContent value="liked" className="space-y-6">
              {isLoadingLiked && (
                <div className="text-center py-16">
                  <p className="text-muted-foreground">로딩 중...</p>
                </div>
              )}
              {!isLoadingLiked && likedItems.length === 0 && (
                <div className="text-center py-16">
                  <p className="text-muted-foreground">좋아요한 작품이 없습니다.</p>
                </div>
              )}
              {!isLoadingLiked && likedItems.length > 0 && (
                <>
                  <div className="flex gap-2 mb-6">
                    <Badge 
                      variant={likedFilter === "all" ? "default" : "outline"}
                      className="cursor-pointer px-4 py-2"
                      onClick={() => setLikedFilter("all")}
                    >
                      전체
                    </Badge>
                    <Badge 
                      variant={likedFilter === "logo" ? "default" : "outline"}
                      className={`cursor-pointer px-4 py-2 ${
                        likedFilter === "logo" 
                          ? "bg-[#7C22C8] text-white hover:bg-[#6B1DB5]" 
                          : ""
                      }`}
                      onClick={() => setLikedFilter("logo")}
                    >
                      로고
                    </Badge>
                    <Badge 
                      variant={likedFilter === "short" ? "default" : "outline"}
                      className="cursor-pointer px-4 py-2"
                      onClick={() => setLikedFilter("short")}
                    >
                      숏폼
                    </Badge>
                  </div>
                  
                  {likedFilter === "all" ? (
                <>
                  {/* 로고 섹션 */}
                  {likedItems.filter(item => item.type === "logo").length > 0 && (
                    <div className="space-y-4">
                      <h2 className="text-2xl font-semibold text-foreground">로고</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {likedItems.filter(item => item.type === "logo").map((item) => (
                          <Card
                            key={item.id}
                            className="group cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-xl"
                            onClick={() => handleItemClick(item)}
                          >
                            <CardContent className="p-0">
                              <div className="aspect-square bg-muted rounded-t-lg overflow-hidden">
                                <img
                                  src={item.image}
                                  alt={item.title}
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                />
                              </div>
                              <div className="p-4">
                                <div className="flex items-center justify-between text-sm text-muted-foreground">
                                  <div className="flex items-center gap-4">
                                    <span className="flex items-center gap-1">
                                      <Heart className={`w-4 h-4 ${item.is_liked ? "fill-destructive text-destructive" : ""}`} />
                                      {item.likes.toLocaleString()}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <MessageCircle className="w-4 h-4" />
                                      {item.comments || 0}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 숏폼 섹션 */}
                  {likedItems.filter(item => item.type === "short").length > 0 && (
                    <div className="space-y-4 mt-8">
                      <h2 className="text-2xl font-semibold text-foreground">숏폼</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {likedItems.filter(item => item.type === "short").map((item) => (
                          <div
                            key={item.id}
                            className="group relative bg-card rounded-2xl overflow-hidden border border-border/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 cursor-pointer"
                            onClick={() => handleItemClick(item)}
                          >
                            {/* 9:16 Thumbnail */}
                            <div className="aspect-[9/16] bg-secondary/30 relative">
                              {isVideoUrl(item.videoUrl || item.image) ? (
                                <video
                                  src={item.videoUrl || item.image}
                                  className="w-full h-full object-cover"
                                  muted
                                  playsInline
                                  preload="metadata"
                                  onLoadedMetadata={(e) => {
                                    e.currentTarget.pause();
                                    e.currentTarget.currentTime = 0;
                                  }}
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
                                  src={item.image}
                                  alt={item.title}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = "/placeholder.svg";
                                  }}
                                />
                              )}

                              {/* Duration badge */}
                              <div className="absolute top-3 left-3 bg-background/90 backdrop-blur-sm rounded-lg px-2.5 py-1 shadow-md">
                                <span className="text-xs font-medium text-foreground">
                                  0:15
                                </span>
                              </div>

                              {/* Hover overlay with play button */}
                              <div className="absolute inset-0 bg-background/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                                  <Play className="w-8 h-8 text-primary-foreground fill-primary-foreground ml-1" />
                                </div>
                              </div>
                            </div>

                            {/* Info section */}
                            <div className="p-4 bg-card">
                              <div className="flex items-center justify-between text-sm text-muted-foreground">
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-1">
                                    <Heart className={`w-4 h-4 ${item.is_liked ? "fill-destructive text-destructive" : ""}`} />
                                    <span>{item.likes.toLocaleString()}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <MessageCircle className="w-4 h-4" />
                                    <span>{item.comments || 0}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className={`grid ${likedFilter === "logo" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"}`}>
                  {filteredLikedItems.map((item) => (
                    item.type === "logo" ? (
                      <Card
                        key={item.id}
                        className="group cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-xl"
                        onClick={() => handleItemClick(item)}
                      >
                        <CardContent className="p-0">
                          <div className="aspect-square bg-muted rounded-t-lg overflow-hidden">
                            <img
                              src={item.image}
                              alt={item.title}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            />
                          </div>
                          <div className="p-4">
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                              <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1">
                                  <Heart className="w-4 h-4" />
                                  {item.likes.toLocaleString()}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MessageCircle className="w-4 h-4" />
                                  {item.comments || 0}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <div
                        key={item.id}
                        className="group relative bg-card rounded-2xl overflow-hidden border border-border/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 cursor-pointer"
                        onClick={() => handleItemClick(item)}
                      >
                        <div className="aspect-[9/16] bg-secondary/30 relative">
                          {isVideoUrl(item.videoUrl || item.image) ? (
                            <video
                              src={item.videoUrl || item.image}
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                              preload="metadata"
                              onLoadedMetadata={(e) => {
                                e.currentTarget.pause();
                                e.currentTarget.currentTime = 0;
                              }}
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
                              src={item.image}
                              alt={item.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "/placeholder.svg";
                              }}
                            />
                          )}
                          <div className="absolute top-3 left-3 bg-background/90 backdrop-blur-sm rounded-lg px-2.5 py-1 shadow-md">
                            <span className="text-xs font-medium text-foreground">
                              0:15
                            </span>
                          </div>
                          <div className="absolute inset-0 bg-background/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                              <Play className="w-8 h-8 text-primary-foreground fill-primary-foreground ml-1" />
                            </div>
                          </div>
                        </div>
                        <div className="p-4 bg-card">
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1">
                                <Heart className={`w-4 h-4 ${item.is_liked ? "fill-destructive text-destructive" : ""}`} />
                                <span>{item.likes.toLocaleString()}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <MessageCircle className="w-4 h-4" />
                                <span>{item.comments || 0}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* 이미지/비디오 확대 보기 다이얼로그 */}
      <Dialog 
        open={!!selectedImage} 
        onOpenChange={(open) => {
          if (!open) {
            setSelectedImage(null);
          }
        }}
      >
        <DialogContent 
          className="max-w-none w-auto p-0 bg-transparent border-none shadow-none [&>button]:hidden"
        >
          <DialogTitle className="sr-only">{selectedImage?.title || "미리보기"}</DialogTitle>  
          <div className="relative flex items-center justify-center min-w-[300px] min-h-[533px]">
            {selectedImage && (
              selectedImage.type === "short" ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 z-10 bg-background/80 hover:bg-transparent"
                    onClick={() => setSelectedImage(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <video
                    src={selectedImage.url}
                    className="rounded-lg"
                    style={{ 
                      width: 'min(90vw, 400px)',
                      height: 'auto',
                      aspectRatio: '9/16'
                    }}
                    controls
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                </>
              ) : (
                <div className="relative w-full h-full flex items-center justify-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 z-10 bg-background/80 hover:bg-transparent"
                    onClick={() => setSelectedImage(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <div className="relative">
                    <img
                      src={selectedImage.url}
                      alt={selectedImage.title}
                      className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
                    />
                  </div>
                </div>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 새로운 작품 만들기 모달 - 로고일 때만 표시 */}
      {selectedItemForCreate && selectedItemForCreate.type === "logo" && (
        <CreateFromStyleModal
          open={isCreateNewModalOpen}
          onOpenChange={(open) => {
            setIsCreateNewModalOpen(open);
            if (!open) {
              setSelectedItemForCreate(null);
            }
          }}
          baseAssetType="logo"
          baseAssetId={selectedItemForCreate.id}
          baseAssetImageUrl={selectedItemForCreate.image}
        />
      )}

      {/* 새로운 작품 만들기 모달 - 로고일 때만 표시 */}
      {selectedItemForCreate && selectedItemForCreate.type === "logo" && (
        <CreateFromStyleModal
          open={isCreateNewModalOpen}
          onOpenChange={(open) => {
            setIsCreateNewModalOpen(open);
            // 모달이 완전히 닫힐 때만 selectedItemForCreate를 null로 설정
            // CreateFromStyleModal 내부에서 프로젝트 선택 모달이 열려있을 때는
            // onOpenChange(false)를 호출하지 않으므로 안전하게 null로 설정 가능
            if (!open) {
              setSelectedItemForCreate(null);
            }
          }}
          baseAssetType="logo"
          baseAssetId={selectedItemForCreate.id}
          baseAssetImageUrl={selectedItemForCreate.image}
        />
      )}

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

export default MyPage;

