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
}

const ProjectDashboardPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [logos, setLogos] = useState<LogoItem[]>([]);
  const [shortForms, setShortForms] = useState<ShortFormItem[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLoggedIn] = useState(() => localStorage.getItem('isLoggedIn') === 'true');
  const [activeTab, setActiveTab] = useState("logos");

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

    // 프로젝트의 메시지에서 로고와 숏폼 추출
    const extractedLogos: LogoItem[] = [];
    const extractedShortForms: ShortFormItem[] = [];

    loadedProject.messages.forEach((message: Message, index: number) => {
      if (message.images && message.images.length > 0 && message.role === "assistant") {
        const isLogo = message.content.includes("로고");
        const isShort = message.content.includes("숏폼");
        
        if (isLogo) {
          message.images.forEach((img, imgIndex) => {
            extractedLogos.push({
              id: `logo_${index}_${imgIndex}`,
              url: img,
              createdAt: loadedProject.lastUpdated,
              title: `로고 ${extractedLogos.length + 1}`,
              isPublic: false, // 기본값은 비공개
            });
          });
        } else if (isShort) {
          message.images.forEach((img, imgIndex) => {
            extractedShortForms.push({
              id: `short_${index}_${imgIndex}`,
              url: img,
              createdAt: loadedProject.lastUpdated,
              title: `숏폼 ${extractedShortForms.length + 1}`,
            });
          });
        }
      }
    });

    // 프로젝트에 저장된 로고가 있으면 추가 (업로드된 로고)
    if (loadedProject.logo) {
      extractedLogos.unshift({
        id: 'uploaded_logo',
        url: loadedProject.logo.url,
        createdAt: loadedProject.logo.uploadedAt,
        title: "업로드된 로고",
        isPublic: false, // 기본값은 비공개
      });
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
    setLogos(prevLogos => 
      prevLogos.map(logo => 
        logo.id === logoId 
          ? { ...logo, isPublic: !logo.isPublic }
          : logo
      )
    );
    // TODO: 실제 API 호출로 공개 상태 저장
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
                    <span>로고 {project.logoCount}개</span>
                    <span>·</span>
                    <span>숏폼 {project.shortFormCount}개</span>
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
                  로고 생성하기
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
                    로고 생성하기
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {logos.map((logo) => (
                    <Card key={logo.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      <CardContent className="p-0">
                        <div className="aspect-square bg-muted rounded-t-lg overflow-hidden">
                          <img
                            src={logo.url}
                            alt={logo.title || "로고"}
                            className="w-full h-full object-cover"
                          />
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
                    <Card key={shortForm.id} className="overflow-hidden hover:shadow-lg transition-shadow">
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
                        </div>
                        <div className="p-4">
                          <h3 className="font-semibold text-foreground mb-1">
                            {shortForm.title || "숏폼"}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(shortForm.createdAt)}
                          </p>
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

