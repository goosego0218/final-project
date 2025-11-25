import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { projectStorage, type Project } from "@/lib/projectStorage";

interface CreateFromStyleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseAssetType: "logo" | "shortform";
  baseAssetId: number | string;
  baseAssetImageUrl?: string;
}

const CreateFromStyleModal = ({
  open,
  onOpenChange,
  baseAssetType,
  baseAssetId,
  baseAssetImageUrl,
}: CreateFromStyleModalProps) => {
  const navigate = useNavigate();
  const [isProjectSelectModalOpen, setIsProjectSelectModalOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");

  // "내가 하던 프로젝트에서 계속하기" 선택
  const handleContinueExistingProject = () => {
    // 프로젝트 선택 모달을 열기만 하고, 부모의 onOpenChange는 호출하지 않음
    // (부모에서 selectedXXXForCreate를 null로 만들어서 모달이 언마운트되는 것을 방지)
    setIsProjectSelectModalOpen(true);
    setProjects(projectStorage.getProjects());
    // 부모 모달은 닫지 않고 유지 (프로젝트 선택 모달이 열려있는 동안)
  };

  // 프로젝트 선택 및 로고 스튜디오로 이동
  const handleSelectProject = (projectId: string) => {
    setIsProjectSelectModalOpen(false);
    projectStorage.setCurrentProject(projectId);
    // from_style 정보를 URL 파라미터로 전달
    navigate(`/studio?project=${projectId}&type=logo&from_style=true&baseAssetType=${baseAssetType}&baseAssetId=${baseAssetId}`);
  };

  // "새 프로젝트로 시작하기" 선택
  const handleStartNewProject = () => {
    // 프로젝트 이름/설명 입력 모달 열기
    setIsNewProjectModalOpen(true);
  };

  // 새 프로젝트 생성 및 ChatPage로 이동
  const handleCreateNewProject = () => {
    if (projectName.trim()) {
      // draft 프로젝트 정보를 localStorage에 저장
      const draftProject = {
        name: projectName,
        description: projectDescription,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('makery_draft_project', JSON.stringify(draftProject));
      
      // 모달 닫기
      setIsNewProjectModalOpen(false);
      onOpenChange(false);
      setProjectName("");
      setProjectDescription("");
      
      // ChatPage로 이동 (draft=true만 제거, 나머지 파라미터는 유지)
      navigate(`/chat?skipLogoUpload=true&from_style=true&baseAssetType=${baseAssetType}&baseAssetId=${baseAssetId}`);
    }
  };

  return (
    <>
      {/* 새로운 작품 만들기 선택 모달 */}
      <Dialog 
        open={open} 
        onOpenChange={(newOpen) => {
          // 프로젝트 선택 모달이나 새 프로젝트 모달이 열려있을 때는 부모 모달을 닫지 않음
          if (!newOpen && (isProjectSelectModalOpen || isNewProjectModalOpen)) {
            return; // 하위 모달이 열려있으면 부모 모달 닫기 방지
          }
          onOpenChange(newOpen);
        }}
      >
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
              className="w-full h-auto py-6 hover:!bg-[#7C22C8] hover:!text-white hover:!border-[#7C22C8]"
            >
              <div className="flex flex-col items-start gap-1">
                <span className="font-semibold">내가 하던 프로젝트에서 계속하기</span>
                <span className="text-sm text-muted-foreground">기존 프로젝트를 선택하여 이어서 작업합니다</span>
              </div>
            </Button>
            <Button 
              onClick={handleStartNewProject}
              variant="outline"
              className="w-full h-auto py-6 hover:!bg-[#7C22C8] hover:!text-white hover:!border-[#7C22C8]"
            >
              <div className="flex flex-col items-start gap-1">
                <span className="font-semibold">새 프로젝트로 시작하기</span>
                <span className="text-sm text-muted-foreground">새로운 프로젝트를 생성하여 시작합니다</span>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="hover:bg-transparent hover:text-foreground">
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 프로젝트 선택 모달 */}
      <Dialog open={isProjectSelectModalOpen} onOpenChange={(open) => {
        setIsProjectSelectModalOpen(open);
        // 프로젝트 선택 모달이 닫힐 때, 부모 모달도 함께 닫기
        if (!open) {
          onOpenChange(false);
        }
      }}>
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
            <Button variant="outline" onClick={() => {
              setIsProjectSelectModalOpen(false);
              // 취소 버튼 클릭 시 부모 모달도 닫기
              onOpenChange(false);
            }} className="hover:bg-transparent hover:text-foreground">
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 새 프로젝트 생성 모달 */}
      <Dialog 
        open={isNewProjectModalOpen} 
        onOpenChange={(newOpen) => {
          setIsNewProjectModalOpen(newOpen);
          // 새 프로젝트 모달이 닫힐 때, 부모 모달도 함께 닫기
          if (!newOpen) {
            onOpenChange(false);
          }
        }}
      >
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
            <Button variant="outline" onClick={() => {
              setIsNewProjectModalOpen(false);
              onOpenChange(false);
            }} className="hover:bg-transparent hover:text-foreground">
              취소
            </Button>
            <Button 
              onClick={handleCreateNewProject}
              disabled={!projectName.trim()}
            >
              다음으로
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CreateFromStyleModal;

