import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Share2, MessageCircle, Eye, Send, Clipboard, Sparkles, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { projectStorage, type Project } from "@/lib/projectStorage";

const MyPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sharedFilter, setSharedFilter] = useState<"all" | "logo" | "short">("all");
  const [likedFilter, setLikedFilter] = useState<"all" | "logo" | "short">("all");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Array<{ author: string; authorAvatar?: string; content: string; time: string }>>([]);
  const [isCreateNewModalOpen, setIsCreateNewModalOpen] = useState(false);
  const [isProjectSelectModalOpen, setIsProjectSelectModalOpen] = useState(false);
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [likedItems, setLikedItems] = useState<Array<{ id: number; type: "logo" | "short"; image: string; title: string; likes: number }>>([]);
  const [sharedItems, setSharedItems] = useState<Array<{ id: string | number; type: "logo" | "short"; image: string; title: string; likes: number; comments?: number; duration?: string }>>([]);

  // Load liked items from localStorage
  useEffect(() => {
    const loadLikedItems = () => {
      const likedLogos = JSON.parse(localStorage.getItem('liked_logos') || '[]');
      const likedShorts = JSON.parse(localStorage.getItem('liked_shorts') || '[]');
      
      // Generate all logos (same as LogoGallery)
      const generateMockLogos = () => {
        const brands = [
          { name: "카페 드 플뢰르", tags: ["카페", "음식"] },
          { name: "봄꽃 축제", tags: ["축제", "이벤트"] },
          { name: "디지털 스튜디오", tags: ["기술", "디자인"] },
          { name: "그린 마켓", tags: ["음식", "건강"] },
          { name: "뮤직 페스타", tags: ["축제", "음악"] },
          { name: "베이커리 하우스", tags: ["음식", "카페"] },
          { name: "아트 갤러리", tags: ["예술", "전시"] },
          { name: "푸드 트럭", tags: ["음식", "축제"] },
          { name: "요가 센터", tags: ["건강", "운동"] },
          { name: "북 카페", tags: ["카페", "문화"] },
          { name: "와인 바", tags: ["음식", "분위기"] },
          { name: "재즈 클럽", tags: ["음악", "축제"] },
          { name: "플라워 샵", tags: ["자연", "선물"] },
          { name: "펫 카페", tags: ["카페", "동물"] },
          { name: "시네마 라운지", tags: ["문화", "엔터테인먼트"] },
          { name: "스포츠 바", tags: ["음식", "운동"] },
          { name: "브런치 카페", tags: ["음식", "카페"] },
          { name: "야시장", tags: ["축제", "음식"] },
          { name: "디저트 공방", tags: ["음식", "카페"] },
          { name: "크래프트 비어", tags: ["음식", "분위기"] },
        ];
        return brands.map((brand, index) => ({
          id: index + 1,
          imageSrc: "/placeholder.svg",
          brandName: brand.name,
          likes: Math.floor(Math.random() * 5000) + 100,
          comments: Math.floor(Math.random() * 500) + 10,
          createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
          tags: brand.tags,
        }));
      };

      // Generate all short forms (same as ShortFormGallery)
      const generateMockShortForms = () => {
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
        return Array.from({ length: 60 }, (_, i) => ({
          id: i + 1,
          title: titles[i % titles.length],
          thumbnailUrl: "/placeholder.svg",
          likes: Math.floor(Math.random() * 10000) + 100,
          comments: Math.floor(Math.random() * 1000) + 10,
          duration: `0:${String(Math.floor(Math.random() * 50) + 10).padStart(2, '0')}`,
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          tags: [],
        }));
      };

      // Load public logos and shorts
      const publicLogos = JSON.parse(localStorage.getItem('public_logos') || '[]');
      const publicShorts = JSON.parse(localStorage.getItem('public_shortforms') || '[]');
      
      const allLogos = [
        ...publicLogos.map((logo: any) => ({
          id: logo.id,
          imageSrc: logo.url,
          brandName: logo.brandName,
          likes: logo.likes || 0,
          comments: logo.comments || 0,
          createdAt: new Date(logo.createdAt),
          tags: logo.tags || [],
        })),
        ...generateMockLogos()
      ];

      const allShorts = [
        ...publicShorts.map((sf: any) => ({
          id: sf.id,
          title: sf.title,
          thumbnailUrl: sf.thumbnailUrl,
          likes: sf.likes || 0,
          comments: sf.comments || 0,
          duration: sf.duration || "0:15",
          createdAt: new Date(sf.createdAt),
          tags: sf.tags || [],
        })),
        ...generateMockShortForms()
      ];

      // Filter liked items
      const likedLogosList = allLogos
        .filter((logo) => likedLogos.includes(logo.id))
        .map((logo) => ({
          id: logo.id,
          type: "logo" as const,
          image: logo.imageSrc,
          title: logo.brandName,
          likes: logo.likes,
        }));

      const likedShortsList = allShorts
        .filter((short) => likedShorts.includes(short.id))
        .map((short) => ({
          id: short.id,
          type: "short" as const,
          image: short.thumbnailUrl,
          title: short.title,
          likes: short.likes,
        }));

      setLikedItems([...likedLogosList, ...likedShortsList]);
    };

    loadLikedItems();

    // Listen for storage changes to update liked items
    const handleStorageChange = () => {
      loadLikedItems();
    };

    window.addEventListener('storage', handleStorageChange);
    // Also check periodically for changes (since storage event doesn't fire in same tab)
    const interval = setInterval(loadLikedItems, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // 공유한 작품 로드 (현재 남아있는 프로젝트 데이터 기준으로 계산)
  useEffect(() => {
    const loadSharedItems = () => {
      // 현재 남아있는 모든 프로젝트 가져오기
      const allProjects = projectStorage.getProjects();
      
      // localStorage에서 공개된 항목 목록 가져오기
      const publicLogos = JSON.parse(localStorage.getItem('public_logos') || '[]');
      const publicShortForms = JSON.parse(localStorage.getItem('public_shortforms') || '[]');
      
      // 공개된 로고/숏폼 ID 집합 생성
      const publicLogoIds = new Set(publicLogos.map((l: any) => l.id));
      const publicShortFormIds = new Set(publicShortForms.map((sf: any) => sf.id));
      
      const logoItems: Array<{ id: string | number; type: "logo" | "short"; image: string; title: string; likes: number; comments?: number; duration?: string }> = [];
      const shortItems: Array<{ id: string | number; type: "logo" | "short"; image: string; title: string; likes: number; comments?: number; duration?: string }> = [];
      
      // 각 프로젝트를 순회하면서 공개된 항목만 수집
      allProjects.forEach((project) => {
        // 프로젝트의 savedItems 확인
        if (project.savedItems) {
          project.savedItems.forEach((item) => {
            if (item.type === "logo" && publicLogoIds.has(item.id)) {
              // 공개된 로고이고 실제로 프로젝트에 존재하는지 확인
              const publicLogo = publicLogos.find((l: any) => l.id === item.id && l.projectId === project.id);
              if (publicLogo) {
                logoItems.push({
                  id: item.id,
                  type: "logo" as const,
                  image: item.url,
                  title: item.title || "로고",
                  likes: publicLogo.likes || 0,
                  comments: publicLogo.comments || 0,
                });
              }
            } else if (item.type === "short" && publicShortFormIds.has(item.id)) {
              // 공개된 숏폼이고 실제로 프로젝트에 존재하는지 확인
              const publicShortForm = publicShortForms.find((sf: any) => sf.id === item.id && sf.projectId === project.id);
              if (publicShortForm) {
                shortItems.push({
                  id: item.id,
                  type: "short" as const,
                  image: item.url,
                  title: item.title || "숏폼",
                  likes: publicShortForm.likes || 0,
                  comments: publicShortForm.comments || 0,
                  duration: publicShortForm.duration || "0:15",
                });
              }
            }
          });
        }
        
        // 업로드된 로고도 확인 (업로드된 로고는 savedItems에 없을 수 있음)
        if (project.logo) {
          const uploadedLogoId = 'uploaded_logo';
          if (publicLogoIds.has(uploadedLogoId)) {
            const publicLogo = publicLogos.find((l: any) => l.id === uploadedLogoId && l.projectId === project.id);
            if (publicLogo) {
              // 이미 추가되었는지 확인
              if (!logoItems.some(item => item.id === uploadedLogoId && item.image === project.logo?.url)) {
                logoItems.push({
                  id: uploadedLogoId,
                  type: "logo" as const,
                  image: project.logo.url,
                  title: "업로드된 로고",
                  likes: publicLogo.likes || 0,
                  comments: publicLogo.comments || 0,
                });
              }
            }
          }
        }
      });
      
      setSharedItems([...logoItems, ...shortItems]);
    };
    
    loadSharedItems();
    
    // localStorage 및 프로젝트 변경 감지
    const handleStorageChange = () => {
      loadSharedItems();
    };
    
    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(loadSharedItems, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const filteredSharedItems = sharedFilter === "all" 
    ? [...sharedItems.filter(item => item.type === "logo"), ...sharedItems.filter(item => item.type === "short")]
    : sharedItems.filter(item => item.type === sharedFilter);

  const filteredLikedItems = likedFilter === "all"
    ? [...likedItems.filter(item => item.type === "logo"), ...likedItems.filter(item => item.type === "short")]
    : likedItems.filter(item => item.type === likedFilter);

  // Helper functions for managing liked items
  const getLikedLogos = (): Set<number> => {
    const liked = localStorage.getItem('liked_logos');
    return liked ? new Set(JSON.parse(liked)) : new Set();
  };

  const getLikedShorts = (): Set<number> => {
    const liked = localStorage.getItem('liked_shorts');
    return liked ? new Set(JSON.parse(liked)) : new Set();
  };

  // Reset likes count when item changes
  useEffect(() => {
    if (selectedItem) {
      setLikesCount(0);
      if (selectedItem.type === "logo") {
        const liked = getLikedLogos();
        setIsLiked(liked.has(selectedItem.id));
      } else {
        const liked = getLikedShorts();
        const shortId = selectedItem.id || selectedItem.title?.charCodeAt(0) || 0;
        setIsLiked(liked.has(shortId));
      }
    }
  }, [selectedItem]);

  const handleLike = () => {
    if (!selectedItem) return;
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    setLikesCount(prev => newLikedState ? prev + 1 : prev - 1);
    
    // Save to localStorage
    if (selectedItem.type === "logo") {
      const liked = JSON.parse(localStorage.getItem('liked_logos') || '[]');
      if (newLikedState) {
        if (!liked.includes(selectedItem.id)) {
          liked.push(selectedItem.id);
        }
      } else {
        const index = liked.indexOf(selectedItem.id);
        if (index > -1) {
          liked.splice(index, 1);
        }
      }
      localStorage.setItem('liked_logos', JSON.stringify(liked));
    } else {
      const liked = JSON.parse(localStorage.getItem('liked_shorts') || '[]');
      const shortId = selectedItem.id || selectedItem.title?.charCodeAt(0) || 0;
      if (newLikedState) {
        if (!liked.includes(shortId)) {
          liked.push(shortId);
        }
      } else {
        const index = liked.indexOf(shortId);
        if (index > -1) {
          liked.splice(index, 1);
        }
      }
      localStorage.setItem('liked_shorts', JSON.stringify(liked));
    }
    
    toast({ description: newLikedState ? "좋아요를 눌렀습니다" : "좋아요를 취소했습니다" });
    
    // Reload liked items
    window.dispatchEvent(new Event('storage'));
  };

  const handleComment = () => {
    if (commentText.trim()) {
      const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
      const newComment = {
        author: userProfile.nickname || "나",
        authorAvatar: userProfile.avatar || undefined,
        content: commentText,
        time: "방금 전"
      };
      setComments([newComment, ...comments]);
      toast({ description: "댓글이 등록되었습니다" });
      setCommentText("");
    }
  };

  const handleShare = () => {
    const url = selectedItem ? `${window.location.origin}/${selectedItem.type === "logo" ? "logos" : "shorts"}?${selectedItem.type === "logo" ? "logo" : "short"}=${selectedItem.id}` : window.location.href;
    navigator.clipboard.writeText(url);
    toast({ description: "링크가 복사되었습니다" });
  };

  const handleCreateNew = () => {
    setSelectedItem(null);
    setIsLiked(false);
    setLikesCount(0);
    setComments([]);
    setCommentText("");
    setTimeout(() => {
      setIsCreateNewModalOpen(true);
    }, 100);
  };

  const handleContinueExistingProject = () => {
    setIsCreateNewModalOpen(false);
    setIsProjectSelectModalOpen(true);
    setProjects(projectStorage.getProjects());
  };

  const handleSelectProject = (projectId: string) => {
    setIsProjectSelectModalOpen(false);
    projectStorage.setCurrentProject(projectId);
    navigate(`/chat?project=${projectId}`);
  };

  const handleStartNewProject = () => {
    setIsCreateNewModalOpen(false);
    setIsNewProjectDialogOpen(true);
    setProjectName("");
    setProjectDescription("");
  };

  const handleCreateProject = () => {
    if (projectName.trim()) {
      const newProject = projectStorage.createProject(projectName, projectDescription);
      setIsNewProjectDialogOpen(false);
      setProjectName("");
      setProjectDescription("");
      navigate(`/chat?project=${newProject.id}&skipLogoUpload=true`);
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
                  className="cursor-pointer px-4 py-2"
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
                            onClick={() => setSelectedItem(item)}
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
                            onClick={() => setSelectedItem(item)}
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
                                    <Heart className="w-4 h-4 text-destructive fill-destructive" />
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
                        onClick={() => setSelectedItem(item)}
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
                        onClick={() => setSelectedItem(item)}
                      >
                        <div className="aspect-[9/16] bg-secondary/30 relative">
                          <img
                            src={item.image}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
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
                                <Heart className="w-4 h-4 text-destructive fill-destructive" />
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
            </TabsContent>
            
            <TabsContent value="liked" className="space-y-6">
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
                  className="cursor-pointer px-4 py-2"
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
                            onClick={() => setSelectedItem(item)}
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
                            onClick={() => setSelectedItem(item)}
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
                                    <Heart className="w-4 h-4 text-destructive fill-destructive" />
                                    <span>{item.likes.toLocaleString()}</span>
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
                        onClick={() => setSelectedItem(item)}
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
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <div
                        key={item.id}
                        className="group relative bg-card rounded-2xl overflow-hidden border border-border/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 cursor-pointer"
                        onClick={() => setSelectedItem(item)}
                      >
                        <div className="aspect-[9/16] bg-secondary/30 relative">
                          <img
                            src={item.image}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
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
                                <Heart className="w-4 h-4 text-destructive fill-destructive" />
                                <span>{item.likes.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Detail Modal - Logo */}
      {selectedItem?.type === "logo" && (
        <Dialog open={!!selectedItem} onOpenChange={() => {
          setSelectedItem(null);
          setIsLiked(false);
          setLikesCount(0);
          setComments([]);
          setCommentText("");
        }}>
          <DialogContent className="max-w-[800px] w-[90vw] overflow-hidden p-0 gap-0">
            <div className="flex md:flex-row flex-col">
              {/* Left: Logo Image */}
              <div className="bg-background flex items-center justify-center p-0 border-r border-border aspect-square w-full md:w-[400px] md:flex-shrink-0 rounded-l-lg overflow-hidden">
                <img 
                  src={selectedItem.image} 
                  alt={selectedItem.title} 
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Right: Comments and Actions */}
              <div className="flex flex-col bg-background w-full md:w-[400px] md:flex-shrink-0 aspect-square md:aspect-auto md:h-[400px] rounded-r-lg">
                {/* Comments Section - Top */}
                <div className="flex-1 min-h-0 overflow-y-auto p-6 border-b border-border">
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
                <div className="p-4 border-b border-border space-y-3">
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="ghost" 
                      onClick={handleLike}
                      className="h-9 px-3 gap-2"
                    >
                      <Heart className={`h-5 w-5 ${isLiked ? "fill-destructive text-destructive" : ""}`} />
                      <span className="text-sm font-semibold text-foreground">
                        {(selectedItem ? selectedItem.likes + likesCount : 0).toLocaleString()}
                      </span>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={handleShare}
                      className="h-9 w-9"
                    >
                      <Clipboard className="h-5 w-5" />
                    </Button>
                  </div>
                  <Button onClick={handleCreateNew} className="w-full bg-primary hover:bg-primary/90">
                    <Sparkles className="w-4 h-4 mr-2" />
                    이 스타일로 새로운 작품 만들기
                  </Button>
                </div>

                {/* Comment Input - Bottom */}
                <div className="p-4 border-t border-border">
                  <div className="flex gap-2">
                    <Textarea 
                      placeholder="댓글을 입력하세요..." 
                      value={commentText} 
                      onChange={(e) => setCommentText(e.target.value)} 
                      className="min-h-[60px] resize-none flex-1" 
                      rows={2}
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
                      className="h-[60px] px-6"
                    >
                      등록
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Detail Modal - Short Form */}
      {selectedItem?.type === "short" && (
        <Dialog open={!!selectedItem} onOpenChange={() => {
          setSelectedItem(null);
          setIsLiked(false);
          setLikesCount(0);
          setComments([]);
          setCommentText("");
        }}>
          <DialogContent className="max-w-[800px] w-[90vw] overflow-hidden p-0 gap-0">
            <div className="flex md:flex-row flex-col">
              {/* Left: Short Form Image (9:16 ratio) */}
              <div className="bg-background flex items-center justify-center p-0 border-r border-border aspect-[9/16] w-full md:w-[300px] md:flex-shrink-0 rounded-l-lg overflow-hidden relative group">
                <img 
                  src={selectedItem.image} 
                  alt={selectedItem.title} 
                  className="w-full h-full object-cover"
                />
                {selectedItem.videoUrl && (
                  <video
                    src={selectedItem.videoUrl}
                    className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                )}
              </div>

              {/* Right: Comments and Actions */}
              <div className="flex flex-col bg-background w-full md:w-[500px] md:flex-shrink-0 aspect-[9/16] md:aspect-auto md:h-[533px] rounded-r-lg">
                {/* Comments Section - Top */}
                <div className="flex-1 min-h-0 overflow-y-auto p-6 border-b border-border">
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
                <div className="p-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="ghost" 
                      onClick={handleLike}
                      className="h-9 px-3 gap-2"
                    >
                      <Heart className={`h-5 w-5 ${isLiked ? "fill-destructive text-destructive" : ""}`} />
                      <span className="text-sm font-semibold text-foreground">
                        {(selectedItem ? (selectedItem.likes || 0) + likesCount : 0).toLocaleString()}
                      </span>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={handleShare}
                      className="h-9 w-9"
                    >
                      <Clipboard className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {/* Comment Input - Bottom */}
                <div className="p-4 border-t border-border">
                  <div className="flex gap-2">
                    <Textarea 
                      placeholder="댓글을 입력하세요..." 
                      value={commentText} 
                      onChange={(e) => setCommentText(e.target.value)} 
                      className="min-h-[60px] resize-none flex-1" 
                      rows={2}
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
                      className="h-[60px] px-6"
                    >
                      등록
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 새로운 작품 만들기 선택 모달 */}
      <Dialog open={isCreateNewModalOpen} onOpenChange={setIsCreateNewModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새로운 작품 만들기</DialogTitle>
            <DialogDescription>
              어떻게 진행하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Button 
              onClick={handleContinueExistingProject}
              variant="outline"
              className="w-full h-auto py-6"
            >
              <div className="flex flex-col items-start gap-1">
                <span className="font-semibold">내가 하던 프로젝트에서 계속하기</span>
                <span className="text-sm text-muted-foreground">기존 프로젝트를 선택하여 이어서 작업합니다</span>
              </div>
            </Button>
            <Button 
              onClick={handleStartNewProject}
              className="w-full h-auto py-6 bg-primary hover:bg-primary/90"
            >
              <div className="flex flex-col items-start gap-1">
                <span className="font-semibold">새 프로젝트로 시작하기</span>
                <span className="text-sm text-primary-foreground/80">새로운 프로젝트를 생성하여 시작합니다</span>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateNewModalOpen(false)}>
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 프로젝트 선택 모달 */}
      <Dialog open={isProjectSelectModalOpen} onOpenChange={setIsProjectSelectModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>프로젝트 선택</DialogTitle>
            <DialogDescription>
              계속 작업할 프로젝트를 선택해주세요
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh] space-y-2 py-4">
            {projects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                프로젝트가 없습니다
              </div>
            ) : (
              projects.map((project) => (
                <Card 
                  key={project.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSelectProject(project.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">{project.name}</h3>
                        {project.description && (
                          <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>로고 {project.logoCount}개</span>
                          <span>숏폼 {project.shortFormCount}개</span>
                          <span>{project.date}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProjectSelectModalOpen(false)}>
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 새 프로젝트 만들기 다이얼로그 */}
      <Dialog open={isNewProjectDialogOpen} onOpenChange={setIsNewProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 프로젝트 만들기</DialogTitle>
            <DialogDescription>
              프로젝트 정보를 입력하고 시작하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">프로젝트 이름</Label>
              <Input
                id="project-name"
                placeholder="예: 브랜드 A 마케팅"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-description">설명 (선택)</Label>
              <Textarea
                id="project-description"
                placeholder="프로젝트에 대한 간단한 설명을 입력하세요"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewProjectDialogOpen(false)}>
              취소
            </Button>
            <Button 
              onClick={handleCreateProject}
              disabled={!projectName.trim()}
            >
              다음으로
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Footer />
    </div>
  );
};

export default MyPage;
