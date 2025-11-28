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
import { Plus, Image, Video, MoreVertical, Trash2, Edit, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getProjects, createProject, deleteProject, ProjectListItem, CreateProjectRequest } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { updateProject } from "@/lib/api";

const ProjectsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [deleteProjectId, setDeleteProjectId] = useState<number | null>(null);
  const [editProjectId, setEditProjectId] = useState<number | null>(null);
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectDescription, setEditProjectDescription] = useState("");
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // DB에서 프로젝트 목록 가져오기
  const { data: projects = [], isLoading: isProjectsLoading } = useQuery({
    queryKey: ['userProjects'],
    queryFn: getProjects,
    enabled: isLoggedIn, // 로그인 상태일 때만 조회
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    refetchOnWindowFocus: false, // 윈도우 포커스 시 자동 refetch 비활성화
    refetchOnMount: false, // 마운트 시 자동 refetch 비활성화
  });

  useEffect(() => {
    // localStorage 변경 감지
    const handleStorageChange = () => {
      const isNowLoggedIn = localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true';
      setIsLoggedIn(isNowLoggedIn);
      if (!isNowLoggedIn) {
        navigate("/");
      }
      // refetch() 제거 - interval에서는 refetch 하지 않음
    };

    // 초기 로드
    const loggedIn = localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true';
    setIsLoggedIn(loggedIn);
    
    if (!loggedIn) {
      navigate("/");
      return;
    }

    window.addEventListener('storage', handleStorageChange);
    // interval 제거 - 불필요한 반복 호출 방지

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [navigate]);

  const handleNewProjectClick = () => {
    // localStorage와 sessionStorage에서 직접 확인하여 최신 로그인 상태 반영
    const currentlyLoggedIn = localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true';
    if (!currentlyLoggedIn) {
      setIsLoginOpen(true);
      return;
    }
    setIsDialogOpen(true);
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      toast({
        title: "프로젝트 이름 필요",
        description: "프로젝트 이름을 입력해주세요.",
        status: "warning",
      });
      return;
    }

    setIsCreating(true);
    
    // 프로젝트 정보를 localStorage에 임시 저장 (draft 모드)
    const draftProject = {
      name: projectName.trim(),
      description: projectDescription.trim() || "",
    };
    localStorage.setItem('makery_draft_project', JSON.stringify(draftProject));
    
    setIsDialogOpen(false);
    setProjectName("");
    setProjectDescription("");
    setIsCreating(false);
    
    toast({
      title: "프로젝트 준비 완료",
      description: "브랜드 정보를 입력해주세요.",
      status: "success",
    });

    // draft 모드로 ChatPage로 이동하여 브랜드 정보 수집 시작
    navigate(`/chat`);
  };

  const handleLoginSuccess = (rememberMe?: boolean, isSignUp?: boolean) => {
    setIsLoggedIn(true);
    if (rememberMe) {
      localStorage.setItem('isLoggedIn', 'true');
      sessionStorage.removeItem('isLoggedIn');
    } else {
      sessionStorage.setItem('isLoggedIn', 'true');
      localStorage.removeItem('isLoggedIn');
    }
    setIsLoginOpen(false);
    setIsSignUpOpen(false);
    
    // 프로젝트 목록 다시 가져오기
    queryClient.invalidateQueries({ queryKey: ['userProjects'] });
    
    // 회원가입이 아닌 경우에만 로그인 토스트 표시
    if (!isSignUp) {
      toast({
        title: "로그인 성공",
        description: "MAKERY에 오신 것을 환영합니다!",
        status: "success",
      });
    }
    
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

  const handleDeleteProject = async () => {
    if (!deleteProjectId) return;

    setIsDeleting(true);
    try {
      // Optimistic update: 즉시 UI에서 제거
      queryClient.setQueryData<ProjectListItem[]>(['userProjects'], (old) => {
        if (!old) return old;
        return old.filter(project => project.grp_id !== deleteProjectId);
      });
      
      await deleteProject(deleteProjectId);
      
      // 삭제 성공 후 쿼리 무효화 (백그라운드에서 최신 데이터 가져오기)
      queryClient.invalidateQueries({ queryKey: ['userProjects'] });
      
      toast({
        title: "프로젝트 삭제",
        description: "프로젝트가 삭제되었습니다.",
        status: "success",
      });
      
      setDeleteProjectId(null);
    } catch (error) {
      // 실패 시 원래 데이터로 롤백
      queryClient.invalidateQueries({ queryKey: ['userProjects'] });
      
      toast({
        title: "삭제 실패",
        description: error instanceof Error ? error.message : "프로젝트 삭제에 실패했습니다.",
        status: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditProject = (project: ProjectListItem) => {
    setEditProjectId(project.grp_id);
    setEditProjectName(project.grp_nm);
    setEditProjectDescription(project.grp_desc || "");
  };

  const handleUpdateProject = async () => {
    if (!editProjectId || !editProjectName.trim()) {
      toast({
        title: "입력 오류",
        description: "프로젝트 이름을 입력해주세요.",
        status: "error",
      });
      return;
    }

    try {
      await updateProject(editProjectId, {
        grp_nm: editProjectName.trim(),
        grp_desc: editProjectDescription.trim() || null,
      });

      // 프로젝트 목록 쿼리 무효화하여 다시 가져오기
      queryClient.invalidateQueries({ queryKey: ['userProjects'] });

      toast({
        title: "프로젝트 수정 완료",
        description: "프로젝트 정보가 수정되었습니다.",
        status: "success",
      });

      setEditProjectId(null);
      setEditProjectName("");
      setEditProjectDescription("");
    } catch (error) {
      toast({
        title: "프로젝트 수정 실패",
        description: error instanceof Error ? error.message : "프로젝트 수정에 실패했습니다.",
        variant: "destructive",
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
                      autoComplete="off"
                      data-list-id="project-names"
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
                    disabled={!projectName.trim() || isCreating}
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        생성 중...
                      </>
                    ) : (
                      "생성하기"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {isProjectsLoading ? (
            <div className="text-center py-16">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-xl text-muted-foreground">프로젝트를 불러오는 중...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-xl text-muted-foreground">프로젝트가 없습니다.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(showAllProjects ? projects : projects.slice(0, 9)).map((project) => (
                <Card 
                  key={project.grp_id} 
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
                          handleEditProject(project);
                        }}>
                          <Edit className="h-4 w-4 mr-2" />
                          수정하기
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive hover:bg-destructive hover:text-destructive-foreground focus:bg-destructive focus:text-destructive-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteProjectId(project.grp_id);
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
                      // 프로젝트 디테일 페이지로 이동
                      navigate(`/project?project=${project.grp_id}`);
                    }}
                  >
                    <CardHeader className="pr-12">
                      <CardTitle>
                        {project.grp_nm}
                      </CardTitle>
                      <CardDescription className={project.grp_desc ? "" : "min-h-[1.25rem]"}>
                        {project.grp_desc || "\u00A0"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Image className="w-4 h-4" />
                          <span>로고 {project.logo_count}개</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Video className="w-4 h-4" />
                          <span>숏폼 {project.shortform_count}개</span>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </Card>
                ))}
              </div>
              {projects.length > 9 && !showAllProjects && (
                <div className="text-center mt-8">
                  <Button 
                    variant="outline"
                    onClick={() => setShowAllProjects(true)}
                    className="hover:bg-orange-500 hover:text-white hover:border-orange-500"
                  >
                    더보기
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      <Footer />

      <AlertDialog open={deleteProjectId !== null} onOpenChange={() => setDeleteProjectId(null)}>
        <AlertDialogContent
          onOverlayClick={() => setDeleteProjectId(null)}
        >
          {/* X 버튼 */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 h-6 w-6 rounded-sm opacity-70 ring-offset-background transition-opacity hover:bg-transparent hover:opacity-100 hover:text-foreground focus:outline-none focus:ring-0 z-10"
            onClick={() => setDeleteProjectId(null)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
          <AlertDialogHeader>
            <AlertDialogTitle>프로젝트를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 없습니다. 프로젝트와 관련된 모든 데이터가 영구적으로 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteProject} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  삭제 중...
                </>
              ) : (
                "삭제"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editProjectId !== null} onOpenChange={(open) => {
        if (!open) {
          setEditProjectId(null);
          setEditProjectName("");
          setEditProjectDescription("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>프로젝트 수정</DialogTitle>
            <DialogDescription>
              프로젝트 정보를 수정하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-project-name">프로젝트 이름</Label>
              <Input
                id="edit-project-name"
                placeholder="예: 브랜드 A 마케팅"
                value={editProjectName}
                onChange={(e) => setEditProjectName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-project-description">설명 (선택)</Label>
              <Textarea
                id="edit-project-description"
                placeholder="프로젝트에 대한 간단한 설명을 입력하세요"
                value={editProjectDescription}
                onChange={(e) => setEditProjectDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditProjectId(null);
              setEditProjectName("");
              setEditProjectDescription("");
            }}>
              취소
            </Button>
            <Button 
              onClick={handleUpdateProject}
              disabled={!editProjectName.trim()}
            >
              수정하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectsPage;
