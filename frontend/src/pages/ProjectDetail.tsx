import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import AIChatPanel from "@/components/AIChatPanel";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Image, Video, ArrowLeft, Trash2, Eye, Heart, Globe, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";

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

const ProjectDetail = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [creations, setCreations] = useState<{ logos: Creation[]; shorts: Creation[] }>({
    logos: [],
    shorts: [],
  });

  useEffect(() => {
    // Load project
    const savedProjects = localStorage.getItem("projects");
    if (savedProjects) {
      const projects = JSON.parse(savedProjects);
      const foundProject = projects.find((p: Project) => p.id === projectId);
      if (foundProject) {
        setProject(foundProject);
      } else {
        toast.error("프로젝트를 찾을 수 없습니다");
        navigate("/dashboard");
      }
    }

    // Load creations
    const savedCreations = localStorage.getItem("creations");
    if (savedCreations) {
      setCreations(JSON.parse(savedCreations));
    }
  }, [projectId, navigate]);

  const handleDeleteProject = () => {
    const savedProjects = localStorage.getItem("projects");
    if (savedProjects) {
      const projects = JSON.parse(savedProjects);
      const updatedProjects = projects.filter((p: Project) => p.id !== projectId);
      localStorage.setItem("projects", JSON.stringify(updatedProjects));
      toast.success("프로젝트가 삭제되었습니다");
      navigate("/dashboard");
    }
  };

  const handleTogglePublic = (creationId: string, type: 'logos' | 'shorts') => {
    const updatedCreations = { ...creations };
    const creation = updatedCreations[type].find(c => c.id === creationId);
    if (creation) {
      creation.isPublic = !creation.isPublic;
      setCreations(updatedCreations);
      localStorage.setItem("creations", JSON.stringify(updatedCreations));
      toast.success(creation.isPublic ? "공개로 설정되었습니다" : "비공개로 설정되었습니다");
    }
  };

  const filteredCreations = {
    logos: creations.logos.filter(logo => logo.projectId === projectId),
    shorts: creations.shorts.filter(short => short.projectId === projectId),
  };

  if (!project) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{project.name}</h1>
              {project.description && (
                <p className="text-muted-foreground mt-1">{project.description}</p>
              )}
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="mr-2 h-4 w-4" />
                프로젝트 삭제
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>프로젝트를 삭제하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                  이 작업은 취소할 수 없습니다. 프로젝트와 관련된 모든 데이터가 삭제됩니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteProject}>삭제</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* AI Chat Panel */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <AIChatPanel />
          </div>

          {/* Creations Panel */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            <Card>
              <CardContent className="pt-6">
                <Tabs defaultValue="logos" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="logos">
                      <Image className="mr-2 h-4 w-4" />
                      로고 ({filteredCreations.logos.length})
                    </TabsTrigger>
                    <TabsTrigger value="shorts">
                      <Video className="mr-2 h-4 w-4" />
                      숏폼 ({filteredCreations.shorts.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="logos" className="mt-6">
                    {filteredCreations.logos.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Image className="h-12 w-12 text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground">
                          AI 챗봇에게 로고 생성을 요청해보세요
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {filteredCreations.logos.map((logo) => (
                          <Card key={logo.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                            <img
                              src={logo.image}
                              alt={logo.title}
                              className="w-full h-40 object-cover cursor-pointer"
                            />
                            <CardContent className="p-3 space-y-2">
                              <p className="font-medium text-sm">{logo.title}</p>
                              <p className="text-xs text-muted-foreground">{logo.date}</p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Eye className="w-3 h-3" />
                                  <span>{logo.views}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Heart className="w-3 h-3" />
                                  <span>{logo.likes}</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between pt-2">
                                <div className="flex items-center gap-2">
                                  {logo.isPublic ? (
                                    <Globe className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <Lock className="w-4 h-4 text-muted-foreground" />
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {logo.isPublic ? "공개" : "비공개"}
                                  </span>
                                </div>
                                <Switch
                                  checked={logo.isPublic}
                                  onCheckedChange={() => handleTogglePublic(logo.id, 'logos')}
                                />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="shorts" className="mt-6">
                    {filteredCreations.shorts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Video className="h-12 w-12 text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground">
                          AI 챗봇에게 숏폼 생성을 요청해보세요
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {filteredCreations.shorts.map((short) => (
                          <Card key={short.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                            <div className="relative">
                              <img
                                src={short.image}
                                alt={short.title}
                                className="w-full h-40 object-cover cursor-pointer"
                              />
                              <Badge className="absolute top-2 right-2">Video</Badge>
                            </div>
                            <CardContent className="p-3 space-y-2">
                              <p className="font-medium text-sm">{short.title}</p>
                              <p className="text-xs text-muted-foreground">{short.date}</p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Eye className="w-3 h-3" />
                                  <span>{short.views}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Heart className="w-3 h-3" />
                                  <span>{short.likes}</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between pt-2">
                                <div className="flex items-center gap-2">
                                  {short.isPublic ? (
                                    <Globe className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <Lock className="w-4 h-4 text-muted-foreground" />
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {short.isPublic ? "공개" : "비공개"}
                                  </span>
                                </div>
                                <Switch
                                  checked={short.isPublic}
                                  onCheckedChange={() => handleTogglePublic(short.id, 'shorts')}
                                />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
