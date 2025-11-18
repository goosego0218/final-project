import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { AuthModals } from "@/components/AuthModals";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Image, Video, MoreVertical, Pin, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { projectStorage, type Project } from "@/lib/projectStorage";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const ProjectsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);

  useEffect(() => {
    const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
    setIsLoggedIn(loggedIn);
    
    if (loggedIn) {
      setProjects(projectStorage.getProjects());
    }

    // localStorage 변경 감지
    const handleStorageChange = () => {
      const isNowLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
      setIsLoggedIn(isNowLoggedIn);
      if (isNowLoggedIn) {
        setProjects(projectStorage.getProjects());
      }
    };

    window.addEventListener('storage', handleStorageChange);
    // 같은 탭에서의 변경도 감지하기 위해 interval 사용
    const interval = setInterval(handleStorageChange, 500);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const handleNewProjectClick = () => {
    // localStorage에서 직접 확인하여 최신 로그인 상태 반영
    const currentlyLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (!currentlyLoggedIn) {
      setIsLoginOpen(true);
      return;
    }
    setIsDialogOpen(true);
  };

  const handleCreateProject = () => {
    if (projectName.trim()) {
      const project = projectStorage.createProject(projectName, projectDescription);
      setProjects(projectStorage.getProjects());
      setIsDialogOpen(false);
      setProjectName("");
      setProjectDescription("");
      navigate("/chat");
    }
  };

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    localStorage.setItem('isLoggedIn', 'true');
    setIsLoginOpen(false);
    setIsSignUpOpen(false);
    setProjects(projectStorage.getProjects()); // 프로젝트 목록 새로고침
    toast({
      title: "로그인 성공",
      description: "MAKERY에 오신 것을 환영합니다!",
    });
    setIsDialogOpen(true);
  };

  const handleSwitchToSignUp = () => {
    setIsLoginOpen(false);
    setIsSignUpOpen(true);
  };

  const handleSwitchToLogin = () => {
    setIsSignUpOpen(false);
    setIsLoginOpen(true);
  };

  const handleTogglePin = (projectId: string) => {
    projectStorage.togglePinProject(projectId);
    setProjects(projectStorage.getProjects());
    toast({
      title: "프로젝트 고정 상태 변경",
      description: "프로젝트가 업데이트되었습니다.",
    });
  };

  const handleDeleteProject = () => {
    if (deleteProjectId) {
      projectStorage.deleteProject(deleteProjectId);
      setProjects(projectStorage.getProjects());
      setDeleteProjectId(null);
      toast({
        title: "프로젝트 삭제",
        description: "프로젝트가 삭제되었습니다.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <AuthModals
        isLoginOpen={isLoginOpen}
        isSignUpOpen={isSignUpOpen}
        onLoginClose={() => setIsLoginOpen(false)}
        onSignUpClose={() => setIsSignUpOpen(false)}
        onSwitchToSignUp={handleSwitchToSignUp}
        onSwitchToLogin={handleSwitchToLogin}
        onLoginSuccess={handleLoginSuccess}
      />
      <div className="pt-20">
        <div className="max-w-6xl mx-auto px-8 py-16">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              내 프로젝트
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              진행 중이거나 완료된 프로젝트들을 관리하세요.
            </p>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <Button size="lg" className="gap-2" onClick={handleNewProjectClick}>
                <Plus className="w-5 h-5" />
                새 프로젝트
              </Button>
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
                  <Button 
                    onClick={handleCreateProject}
                    disabled={!projectName.trim()}
                  >
                    생성하기
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {projects.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-xl text-muted-foreground">프로젝트가 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <Card 
                  key={project.id} 
                  className="hover:shadow-lg transition-shadow relative"
                >
                  <div className="absolute top-4 right-4 z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleTogglePin(project.id);
                        }}>
                          <Pin className="h-4 w-4 mr-2" />
                          {project.pinned ? "고정 해제" : "고정하기"}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteProjectId(project.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          삭제하기
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div 
                    className="cursor-pointer"
                    onClick={() => {
                      // 정보 수집 완료 여부 확인 (system 메시지가 있으면 완료)
                      const hasSystemMessage = project.messages.some(m => m.role === "system");
                      if (hasSystemMessage) {
                        navigate(`/studio?project=${project.id}`);
                      } else {
                        navigate(`/chat?project=${project.id}`);
                      }
                    }}
                  >
                    <CardHeader className="pr-12">
                      <CardTitle className="flex items-center gap-2">
                        {project.name}
                        {project.pinned && <Pin className="h-4 w-4 text-primary" />}
                      </CardTitle>
                      <CardDescription>{project.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Image className="w-4 h-4" />
                          <span>로고 {project.logoCount}개</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Video className="w-4 h-4" />
                          <span>숏폼 {project.shortFormCount}개</span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {project.date}
                      </div>
                    </CardContent>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <Footer />

      <AlertDialog open={deleteProjectId !== null} onOpenChange={() => setDeleteProjectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>프로젝트를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 없습니다. 프로젝트와 관련된 모든 데이터가 영구적으로 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProjectsPage;
