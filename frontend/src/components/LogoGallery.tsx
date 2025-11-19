import { useState, useEffect } from "react";
import { Heart, MessageCircle, Clipboard, Sparkles } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import Footer from "@/components/Footer";
import { useNavigate } from "react-router-dom";
import { projectStorage, type Project } from "@/lib/projectStorage";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Logo {
  id: number;
  imageSrc: string;
  brandName: string;
  likes: number;
  comments: number;
  createdAt: Date;
  tags: string[];
}

// Mock data with more logos
const generateMockLogos = (): Logo[] => {
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

type SortOption = "latest" | "likes" | "comments" | "oldest";

interface LogoGalleryProps {
  searchQuery?: string;
}

const LogoGallery = ({ searchQuery = "" }: LogoGalleryProps) => {
  const navigate = useNavigate();
  const [allLogos, setAllLogos] = useState<Logo[]>(generateMockLogos());
  const [displayedLogos, setDisplayedLogos] = useState<Logo[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("latest");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedLogo, setSelectedLogo] = useState<Logo | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Array<{ author: string; authorAvatar?: string; content: string; time: string }>>([]);
  const { toast } = useToast();
  const [isCreateNewModalOpen, setIsCreateNewModalOpen] = useState(false);
  const [isProjectSelectModalOpen, setIsProjectSelectModalOpen] = useState(false);
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);

  const ITEMS_PER_PAGE = 12;

  // Load public logos from localStorage
  useEffect(() => {
    const publicLogos = JSON.parse(localStorage.getItem('public_logos') || '[]');
    const publicLogosFormatted: Logo[] = publicLogos.map((logo: any) => ({
      id: logo.id,
      imageSrc: logo.url,
      brandName: logo.brandName,
      likes: logo.likes || 0,
      comments: logo.comments || 0,
      createdAt: new Date(logo.createdAt),
      tags: logo.tags || [],
    }));
    
    // Combine with mock logos (public logos first)
    setAllLogos([...publicLogosFormatted, ...generateMockLogos()]);
  }, []);

  // Helper functions for managing liked logos
  const getLikedLogos = (): Set<number> => {
    const liked = localStorage.getItem('liked_logos');
    return liked ? new Set(JSON.parse(liked)) : new Set();
  };

  const saveLikedLogo = (logoId: number, isLiked: boolean) => {
    const liked = getLikedLogos();
    if (isLiked) {
      liked.add(logoId);
    } else {
      liked.delete(logoId);
    }
    localStorage.setItem('liked_logos', JSON.stringify(Array.from(liked)));
  };

  // Reset likes count when logo changes
  useEffect(() => {
    if (selectedLogo) {
      setLikesCount(0);
      const liked = getLikedLogos();
      setIsLiked(liked.has(selectedLogo.id));
    }
  }, [selectedLogo]);

  // Listen to storage events to update liked status
  useEffect(() => {
    const handleStorageChange = () => {
      // 카드 목록이 자동으로 업데이트되도록 함
      setAllLogos(prev => [...prev]);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Filter and sort logos
  const getFilteredAndSortedLogos = () => {
    let filtered = allLogos;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (logo) =>
          logo.brandName.toLowerCase().includes(query) ||
          logo.tags.some((tag) => tag.toLowerCase().includes(query))
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
    const sortedLogos = getFilteredAndSortedLogos();
    const initialItems = sortedLogos.slice(0, ITEMS_PER_PAGE);
    setDisplayedLogos(initialItems);
    setPage(1);
    setHasMore(initialItems.length < sortedLogos.length);
  }, [sortBy, searchQuery]);

  const handleLoadMore = () => {
    const sortedLogos = getFilteredAndSortedLogos();
    const nextPage = page + 1;
    const nextItems = sortedLogos.slice(0, nextPage * ITEMS_PER_PAGE);
    setDisplayedLogos(nextItems);
    setPage(nextPage);
    setHasMore(nextItems.length < sortedLogos.length);
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "오늘";
    if (days === 1) return "어제";
    if (days < 7) return `${days}일 전`;
    if (days < 30) return `${Math.floor(days / 7)}주 전`;
    return `${Math.floor(days / 30)}개월 전`;
  };

  const handleLike = () => {
    if (!selectedLogo) return;
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    setLikesCount(prev => newLikedState ? prev + 1 : prev - 1);
    saveLikedLogo(selectedLogo.id, newLikedState);
    
    // 카드 목록의 좋아요 수 업데이트
    setAllLogos(prev => prev.map(logo => {
      if (logo.id === selectedLogo.id) {
        return {
          ...logo,
          likes: newLikedState ? logo.likes + 1 : Math.max(0, logo.likes - 1)
        };
      }
      return logo;
    }));
    
    // storage 이벤트 발생시켜 다른 컴포넌트에도 알림
    window.dispatchEvent(new Event('storage'));
    
    toast({ description: newLikedState ? "좋아요를 눌렀습니다" : "좋아요를 취소했습니다" });
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
    const url = selectedLogo ? `${window.location.origin}/logos?logo=${selectedLogo.id}` : window.location.href;
    navigator.clipboard.writeText(url);
    toast({ description: "링크가 복사되었습니다" });
  };

  const handleCreateNew = () => {
    setSelectedLogo(null); // 로고 상세 모달 닫기
    setIsLiked(false);
    setLikesCount(0);
    setComments([]);
    setCommentText("");
    // 약간의 지연 후 새로운 작품 만들기 모달 열기
    setTimeout(() => {
      setIsCreateNewModalOpen(true);
    }, 100);
  };

  // "내가 하던 프로젝트에서 계속하기" 선택
  const handleContinueExistingProject = () => {
    setIsCreateNewModalOpen(false);
    setIsProjectSelectModalOpen(true);
    setProjects(projectStorage.getProjects());
  };

  // 프로젝트 선택 및 ChatPage로 이동 (대화하던 시점으로 복귀)
  const handleSelectProject = (projectId: string) => {
    setIsProjectSelectModalOpen(false);
    projectStorage.setCurrentProject(projectId);
    navigate(`/chat?project=${projectId}`);
  };

  // "새 프로젝트로 시작하기" 선택
  const handleStartNewProject = () => {
    setIsCreateNewModalOpen(false);
    setIsNewProjectDialogOpen(true);
    setProjectName("");
    setProjectDescription("");
  };

  // 새 프로젝트 생성 및 ChatPage로 이동
  const handleCreateProject = () => {
    if (projectName.trim()) {
      const newProject = projectStorage.createProject(projectName, projectDescription);
      setIsNewProjectDialogOpen(false);
      setProjectName("");
      setProjectDescription("");
      // ChatPage로 이동 (로고 업로드 단계 제외 플래그)
      navigate(`/chat?project=${newProject.id}&skipLogoUpload=true`);
    }
  };

  return (
    <div className="w-full bg-background">
      {/* Sort Bar */}
      <div className="max-w-7xl mx-auto px-8 py-6 flex justify-end border-b border-border/50">
        <div className="flex items-center gap-3">
          <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
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

      {/* Logo grid */}
      <div className="max-w-7xl mx-auto px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {displayedLogos.map((logo) => (
            <Card
              key={logo.id}
              className="group cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-xl"
              onClick={() => setSelectedLogo(logo)}
            >
              <CardContent className="p-0">
                <div className="aspect-square bg-muted rounded-t-lg overflow-hidden">
                  <img
                    src={logo.imageSrc}
                    alt={logo.brandName}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Heart className={`w-4 h-4 ${getLikedLogos().has(logo.id) ? "fill-destructive text-destructive" : ""}`} />
                        {logo.likes.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-4 h-4" />
                        {logo.comments}
                      </span>
                    </div>
                    <span>{formatDate(logo.createdAt)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
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

      {/* Logo Detail Modal */}
      <Dialog open={!!selectedLogo} onOpenChange={() => {
        setSelectedLogo(null);
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
                src={selectedLogo?.imageSrc} 
                alt={selectedLogo?.brandName} 
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
                      {(selectedLogo ? selectedLogo.likes + likesCount : 0).toLocaleString()}
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
              생성하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
};

export default LogoGallery;
