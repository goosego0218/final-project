import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { projectStorage, type Project, type Message } from "@/lib/projectStorage";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, Image, Video, Calendar } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface LogoItem {
  id: string;
  url: string;
  createdAt: string;
  title?: string;
  isPublic?: boolean;
}

interface ShortFormItem {
  id: string;
  url: string;
  createdAt: string;
  title?: string;
  isPublic?: boolean;
}

const ProjectDashboardPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [logos, setLogos] = useState<LogoItem[]>([]);
  const [shortForms, setShortForms] = useState<ShortFormItem[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleteItemDialogOpen, setIsDeleteItemDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: "logo" | "short"; id: string } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true');
  const [activeTab, setActiveTab] = useState("logos");

  // localStorage 변경 감지하여 로그인 상태 업데이트
  useEffect(() => {
    const handleStorageChange = () => {
      setIsLoggedIn(localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true');
    };
    
    window.addEventListener('storage', handleStorageChange);
    // 같은 탭에서의 변경도 감지하기 위해 interval 사용
    const interval = setInterval(handleStorageChange, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/");
      return;
    }

    const projectId = searchParams.get('project');
    if (!projectId) {
      navigate("/projects");
      return;
    }

    const loadedProject = projectStorage.getProject(projectId);
    if (!loadedProject) {
      toast({
        title: "프로젝트를 찾을 수 없습니다",
        description: "프로젝트가 삭제되었거나 존재하지 않습니다.",
        variant: "destructive",
      });
      navigate("/projects");
      return;
    }

    setProject(loadedProject);

    // localStorage에서 공개 상태 불러오기
    const publicLogos = JSON.parse(localStorage.getItem('public_logos') || '[]');
    const publicShortForms = JSON.parse(localStorage.getItem('public_shortforms') || '[]');
    const currentProjectPublicLogos = publicLogos.filter((l: any) => l.projectId === projectId);
    const currentProjectPublicShortForms = publicShortForms.filter((sf: any) => sf.projectId === projectId);
    
    // 공개된 로고/숏폼 ID 집합 생성
    const publicLogoIds = new Set(currentProjectPublicLogos.map((l: any) => l.id));
    const publicShortFormIds = new Set(currentProjectPublicShortForms.map((sf: any) => sf.id));

    // 저장된 항목만 추출 (Studio에서 저장 버튼을 눌러 저장한 것만)
    const extractedLogos: LogoItem[] = [];
    const extractedShortForms: ShortFormItem[] = [];

    // 프로젝트의 savedItems에서 저장된 로고/숏폼만 표시
    if (loadedProject.savedItems && loadedProject.savedItems.length > 0) {
      loadedProject.savedItems.forEach((savedItem) => {
        if (savedItem.type === "logo") {
          extractedLogos.push({
            id: savedItem.id,
            url: savedItem.url,
            createdAt: savedItem.createdAt,
            title: savedItem.title,
            isPublic: publicLogoIds.has(savedItem.id), // localStorage에서 공개 상태 복원
          });
        } else if (savedItem.type === "short") {
          extractedShortForms.push({
            id: savedItem.id,
            url: savedItem.url,
            createdAt: savedItem.createdAt,
            title: savedItem.title,
            isPublic: publicShortFormIds.has(savedItem.id), // localStorage에서 공개 상태 복원
          });
        }
      });
    }

    // 프로젝트에 저장된 로고가 있으면 추가 (업로드된 로고 - 이것도 저장된 것으로 간주)
    if (loadedProject.logo) {
      const uploadedLogoId = 'uploaded_logo';
      // 업로드된 로고가 savedItems에 없으면 추가
      const isUploadedLogoInSaved = loadedProject.savedItems?.some(item => item.id === uploadedLogoId);
      if (!isUploadedLogoInSaved) {
        extractedLogos.unshift({
          id: uploadedLogoId,
          url: loadedProject.logo.url,
          createdAt: loadedProject.logo.uploadedAt,
          title: "업로드된 로고",
          isPublic: publicLogoIds.has(uploadedLogoId), // localStorage에서 공개 상태 복원
        });
      }
    }

    setLogos(extractedLogos);
    setShortForms(extractedShortForms);
  }, [searchParams, navigate, toast, isLoggedIn]);

  const handleCreateLogo = () => {
    if (!project) return;
    
    // 정보 수집 완료 여부 확인 (system 메시지가 있으면 완료)
    const hasSystemMessage = project.messages.some(m => m.role === "system");
    if (hasSystemMessage) {
      // 이미 브랜드 정보가 있으면 Studio로
      navigate(`/studio?project=${project.id}`);
    } else {
      // 브랜드 정보가 없으면 ChatPage로
      navigate(`/chat?project=${project.id}`);
    }
  };

  const handleDeleteProject = () => {
    if (!project) return;
    
    projectStorage.deleteProject(project.id);
    toast({
      title: "프로젝트가 삭제되었습니다",
      description: "프로젝트와 관련된 모든 데이터가 삭제되었습니다.",
    });
    navigate("/projects");
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleTogglePublic = (logoId: string) => {
    setLogos(prevLogos => {
      const updatedLogos = prevLogos.map(logo => 
        logo.id === logoId 
          ? { ...logo, isPublic: !logo.isPublic }
          : logo
      );
      
      // 공개된 로고를 localStorage에 저장
      const publicLogos = updatedLogos.filter(logo => logo.isPublic);
      const publicLogosData = publicLogos.map(logo => ({
        id: logo.id,
        url: logo.url,
        brandName: logo.title || "로고",
        likes: 0,
        comments: 0,
        createdAt: new Date(logo.createdAt),
        tags: [],
        projectId: project?.id || "",
      }));
      
      // 기존 공개 로고 가져오기
      const existingPublicLogos = JSON.parse(localStorage.getItem('public_logos') || '[]');
      // 현재 프로젝트의 로고 제거 후 새로 추가 (비공개로 변경된 것은 제거됨)
      const filteredLogos = existingPublicLogos.filter((l: any) => l.projectId !== project?.id);
      const updatedPublicLogos = [...filteredLogos, ...publicLogosData];
      localStorage.setItem('public_logos', JSON.stringify(updatedPublicLogos));
      
      return updatedLogos;
    });
    
    toast({
      title: "공개 상태가 변경되었습니다",
      description: "갤러리에 반영되었습니다.",
    });
  };

  const handleToggleShortFormPublic = (shortFormId: string) => {
    setShortForms(prevShortForms => {
      const updatedShortForms = prevShortForms.map(shortForm => 
        shortForm.id === shortFormId 
          ? { ...shortForm, isPublic: !shortForm.isPublic }
          : shortForm
      );
      
      // 공개된 숏폼을 localStorage에 저장
      const publicShortForms = updatedShortForms.filter(sf => sf.isPublic);
      const publicShortFormsData = publicShortForms.map(sf => ({
        id: sf.id,
        thumbnailUrl: sf.url,
        title: sf.title || "숏폼",
        likes: 0,
        comments: 0,
        duration: "0:15",
        createdAt: new Date(sf.createdAt),
        tags: [],
        projectId: project?.id || "",
      }));
      
      // 기존 공개 숏폼 가져오기
      const existingPublicShortForms = JSON.parse(localStorage.getItem('public_shortforms') || '[]');
      // 현재 프로젝트의 숏폼 제거 후 새로 추가 (비공개로 변경된 것은 제거됨)
      const filteredShortForms = existingPublicShortForms.filter((sf: any) => sf.projectId !== project?.id);
      const updatedPublicShortForms = [...filteredShortForms, ...publicShortFormsData];
      localStorage.setItem('public_shortforms', JSON.stringify(updatedPublicShortForms));
      
      return updatedShortForms;
    });
    
    toast({
      title: "공개 상태가 변경되었습니다",
      description: "갤러리에 반영되었습니다.",
    });
  };

  // 로고/숏폼 삭제 핸들러
  const handleDeleteItem = () => {
    if (!itemToDelete || !project) return;

    const projectData = projectStorage.getProject(project.id);
    if (!projectData) return;

    // savedItems에서 제거
    const updatedSavedItems = (projectData.savedItems || []).filter(
      item => item.id !== itemToDelete.id
    );
    projectData.savedItems = updatedSavedItems;
    projectStorage.saveProject(projectData);

    // 상태 업데이트
    if (itemToDelete.type === "logo") {
      setLogos(prev => prev.filter(logo => logo.id !== itemToDelete.id));
    } else {
      setShortForms(prev => prev.filter(short => short.id !== itemToDelete.id));
    }

    // 공개 상태도 제거 (localStorage)
    if (itemToDelete.type === "logo") {
      const publicLogos = JSON.parse(localStorage.getItem('public_logos') || '[]');
      const updatedPublicLogos = publicLogos.filter((l: any) => l.id !== itemToDelete.id);
      localStorage.setItem('public_logos', JSON.stringify(updatedPublicLogos));
    } else {
      const publicShortForms = JSON.parse(localStorage.getItem('public_shortforms') || '[]');
      const updatedPublicShortForms = publicShortForms.filter((sf: any) => sf.id !== itemToDelete.id);
      localStorage.setItem('public_shortforms', JSON.stringify(updatedPublicShortForms));
    }

    toast({
      title: itemToDelete.type === "logo" ? "로고가 삭제되었습니다" : "숏폼이 삭제되었습니다",
      description: "저장된 항목에서 제거되었습니다.",
    });

    setIsDeleteItemDialogOpen(false);
    setItemToDelete(null);
  };

  // 삭제 버튼 클릭 핸들러
  const handleDeleteItemClick = (type: "logo" | "short", id: string) => {
    setItemToDelete({ type, id });
    setIsDeleteItemDialogOpen(true);
  };

  if (!project) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">프로젝트를 불러오는 중...</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="pt-20">
        <div className="max-w-7xl mx-auto px-8 py-8">
          {/* 상단 영역 */}
          <div className="mb-8">
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                  {project.name}
                </h1>
                {project.description && (
                  <p className="text-lg text-muted-foreground mb-4">
                    {project.description}
                  </p>
                )}
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(project.date)}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span>로고 {logos.length}개</span>
                    <span>·</span>
                    <span>숏폼 {shortForms.length}개</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 탭 영역 - 한 줄 레이아웃 */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between mb-6">
              <TabsList>
                <TabsTrigger value="logos" className="flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  로고
                </TabsTrigger>
                <TabsTrigger value="shorts" className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  숏폼
                </TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleCreateLogo}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  로고/숏폼 생성하기
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  프로젝트 삭제
                </Button>
              </div>
            </div>

            <TabsContent value="logos" className="mt-0">
              {logos.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-muted-foreground mb-4">아직 생성된 로고가 없습니다.</p>
                  <Button onClick={handleCreateLogo} className="bg-orange-500 hover:bg-orange-600 text-white">
                    로고/숏폼 생성하기
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {logos.map((logo) => (
                    <Card key={logo.id} className="overflow-hidden hover:shadow-lg transition-shadow relative group">
                      <CardContent className="p-0">
                        <div className="aspect-square bg-muted rounded-t-lg overflow-hidden relative">
                          <img
                            src={logo.url}
                            alt={logo.title || "로고"}
                            className="w-full h-full object-cover"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteItemClick("logo", logo.id);
                            }}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 hover:bg-background text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="p-4">
                          <h3 className="font-semibold text-foreground mb-1">
                            {logo.title || "로고"}
                          </h3>
                          <p className="text-xs text-muted-foreground mb-3">
                            {formatDate(logo.createdAt)}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {logo.isPublic ? "공개" : "비공개"}
                            </span>
                            <Switch
                              checked={logo.isPublic || false}
                              onCheckedChange={() => handleTogglePublic(logo.id)}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="shorts" className="mt-0">
              {shortForms.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-muted-foreground mb-4">아직 생성된 숏폼이 없습니다.</p>
                  <p className="text-sm text-muted-foreground">Studio에서 숏폼을 생성할 수 있습니다.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {shortForms.map((shortForm) => (
                    <Card key={shortForm.id} className="overflow-hidden hover:shadow-lg transition-shadow relative group">
                      <CardContent className="p-0">
                        <div className="aspect-[9/16] bg-muted rounded-t-lg overflow-hidden relative">
                          <img
                            src={shortForm.url}
                            alt={shortForm.title || "숏폼"}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                            숏폼
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteItemClick("short", shortForm.id);
                            }}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 hover:bg-background text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs text-muted-foreground">
                              {formatDate(shortForm.createdAt)}
                            </p>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {shortForm.isPublic ? "공개" : "비공개"}
                            </span>
                            <Switch
                              checked={shortForm.isPublic || false}
                              onCheckedChange={() => handleToggleShortFormPublic(shortForm.id)}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Footer />

      {/* 로고/숏폼 삭제 확인 다이얼로그 */}
      <AlertDialog open={isDeleteItemDialogOpen} onOpenChange={setIsDeleteItemDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete?.type === "logo" ? "로고" : "숏폼"}를 삭제하면 저장된 항목에서 제거됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 프로젝트 삭제 확인 다이얼로그 */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>프로젝트를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 프로젝트를 삭제하면 연결된 로고와 숏폼도 모두 삭제됩니다. 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProjectDashboardPage;

