import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AuthModals } from "./AuthModals";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { projectStorage } from "@/lib/projectStorage";

const HeroSection = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");

  const handleStartChat = () => {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true';
    
    if (isLoggedIn) {
      setIsProjectDialogOpen(true);
    } else {
      setIsLoginOpen(true);
    }
  };

  const handleCreateProject = () => {
    if (projectName.trim()) {
      // 로그인 상태 확인
      const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true';
      if (!isLoggedIn) {
        toast({
          title: "로그인이 필요합니다",
          description: "프로젝트를 생성하려면 로그인해주세요.",
        });
        return;
      }
      
      // 임시 상태(draft)로만 저장 - 실제 프로젝트 생성은 ChatPage의 [생성하기]에서만
      const draftProject = {
        name: projectName,
        description: projectDescription,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('makery_draft_project', JSON.stringify(draftProject));
      
      setIsProjectDialogOpen(false);
      setProjectName("");
      setProjectDescription("");
      // ChatPage로 이동 (draft 모드)
      navigate(`/chat?draft=true&skipLogoUpload=true`);
    }
  };

  const handleLoginSuccess = (rememberMe: boolean) => {
    if (rememberMe) {
      localStorage.setItem('isLoggedIn', 'true');
    } else {
      sessionStorage.setItem('isLoggedIn', 'true');
    }
    setIsLoginOpen(false);
    setIsSignUpOpen(false);
    toast({
      title: "로그인 되었습니다",
      description: "환영합니다!",
    });
    setIsProjectDialogOpen(true);
  };

  const handleSwitchToSignUp = () => {
    setIsLoginOpen(false);
    setIsSignUpOpen(true);
  };

  const handleSwitchToLogin = () => {
    setIsSignUpOpen(false);
    setIsLoginOpen(true);
  };

  return (
    <>
      <AuthModals
        isLoginOpen={isLoginOpen}
        isSignUpOpen={isSignUpOpen}
        onLoginClose={() => setIsLoginOpen(false)}
        onSignUpClose={() => setIsSignUpOpen(false)}
        onSwitchToSignUp={handleSwitchToSignUp}
        onSwitchToLogin={handleSwitchToLogin}
        onLoginSuccess={handleLoginSuccess}
      />
      <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
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
              다음으로
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden px-12 pt-20">
        {/* Background Video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0"
        >
          <source src="/videos/background.mp4" type="video/mp4" />
        </video>
        
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-0" />
        
        <div className="text-center w-full relative z-10">
        <h1 className="text-hero text-foreground mb-8 font-bold">
          MAKERY,<br />당신 브랜드의 첫 AI 크리에이터
        </h1>
        
        <p className="text-xl text-foreground/90 mb-4 max-w-3xl mx-auto leading-relaxed dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
          브랜드 아이덴티티를 AI가 이해하고, 로고와 숏폼 영상을 자동으로 생성합니다.
        </p>
        <p className="text-xl text-foreground/90 mb-16 max-w-3xl mx-auto leading-relaxed dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
          인스타그램, 유튜브 등 주요 플랫폼에 원클릭으로 업로드하고,<br />트렌드에 맞는 콘텐츠로 브랜드를 성장시키세요.
        </p>

        <div className="flex justify-center">
          <Button 
            size="lg" 
            className="rounded-full px-12 py-6 text-lg bg-primary hover:bg-primary/90 text-primary-foreground dark:shadow-lg"
            onClick={handleStartChat}
          >
            MAKERY 시작하기
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
        </div>
      </section>
    </>
  );
};

export default HeroSection;
