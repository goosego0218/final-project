import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Image, Video, Plus, FolderPlus } from "lucide-react";
import { toast } from "sonner";

interface Creation {
  id: string;
  title: string;
  image: string;
  date: string;
  projectId: string;
  isPublic: boolean;
  views: number;
  likes: number;
}

interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");

  // Load projects from localStorage
  useEffect(() => {
    const savedProjects = localStorage.getItem("projects");
    if (savedProjects) {
      const parsedProjects = JSON.parse(savedProjects);
      setProjects(parsedProjects);
    }
  }, []);

  const handleCreateProject = () => {
    if (!newProjectName.trim()) {
      toast.error("프로젝트 이름을 입력해주세요");
      return;
    }

    const newProject: Project = {
      id: Date.now().toString(),
      name: newProjectName,
      description: newProjectDescription,
      createdAt: new Date().toISOString(),
    };

    const updatedProjects = [...projects, newProject];
    setProjects(updatedProjects);
    localStorage.setItem("projects", JSON.stringify(updatedProjects));
    
    setNewProjectName("");
    setNewProjectDescription("");
    setIsCreateDialogOpen(false);
    toast.success("프로젝트가 생성되었습니다");
    
    // Navigate to the new project
    navigate(`/project/${newProject.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl">내 프로젝트</CardTitle>
                      <CardDescription>AI로 생성한 로고와 숏폼</CardDescription>
                    </div>
                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <FolderPlus className="mr-2 h-4 w-4" />
                          새 프로젝트
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>새 프로젝트 만들기</DialogTitle>
                          <DialogDescription>
                            새로운 프로젝트를 생성하여 로고와 숏폼을 관리하세요
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <Label htmlFor="name">프로젝트 이름</Label>
                            <Input
                              id="name"
                              placeholder="예: 브랜드 A 마케팅"
                              value={newProjectName}
                              onChange={(e) => setNewProjectName(e.target.value)}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="description">설명 (선택)</Label>
                            <Input
                              id="description"
                              placeholder="프로젝트 설명을 입력하세요"
                              value={newProjectDescription}
                              onChange={(e) => setNewProjectDescription(e.target.value)}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                            취소
                          </Button>
                          <Button onClick={handleCreateProject}>생성하기</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {projects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FolderPlus className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">프로젝트가 없습니다</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      새 프로젝트를 만들어 시작하세요
                    </p>
                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                      <FolderPlus className="mr-2 h-4 w-4" />
                      첫 프로젝트 만들기
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                    {projects.map((project) => (
                      <Card 
                        key={project.id} 
                        className="overflow-hidden hover:shadow-lg transition-all cursor-pointer group"
                        onClick={() => navigate(`/project/${project.id}`)}
                      >
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg group-hover:text-primary transition-colors">
                            {project.name}
                          </CardTitle>
                          {project.description && (
                            <CardDescription className="line-clamp-2">
                              {project.description}
                            </CardDescription>
                          )}
                        </CardHeader>
                        <CardContent>
                          <div className="flex gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Image className="h-4 w-4" />
                              <span>0개</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Video className="h-4 w-4" />
                              <span>0개</span>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-3">
                            {new Date(project.createdAt).toLocaleDateString('ko-KR')}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
