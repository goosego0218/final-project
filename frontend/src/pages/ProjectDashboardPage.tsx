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
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Trash2, Image, Video, Calendar, X, Upload, Instagram, Youtube } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { addWatermarkToImage, addWatermarkToVideo } from "@/utils/watermark";

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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState("logos");
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [pendingToggleItem, setPendingToggleItem] = useState<{ type: "logo" | "short"; id: string } | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ url: string; title: string; type: "logo" | "short" } | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedShortFormForUpload, setSelectedShortFormForUpload] = useState<ShortFormItem | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set());

  // localStorage 변경 감지하여 로그인 상태 업데이트
  useEffect(() => {
    // 초기 로그인 상태 확인
    setIsLoggedIn(localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true');
    
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
    // localStorage/sessionStorage에서 직접 로그인 상태 확인
    const currentLoggedIn = localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true';
    
    if (!currentLoggedIn) {
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
    // 로고 스튜디오로 이동
    navigate(`/studio?project=${project.id}&type=logo`);
  };

  const handleCreateShort = () => {
    if (!project) return;
    // 숏폼 스튜디오로 이동
    navigate(`/studio?project=${project.id}&type=short`);
  };

  const handleDeleteProject = () => {
    if (!project) return;
    
    // 프로젝트 삭제 전에 localStorage에서 공개된 로고/숏폼도 제거
    const publicLogos = JSON.parse(localStorage.getItem('public_logos') || '[]');
    const publicShortForms = JSON.parse(localStorage.getItem('public_shortforms') || '[]');
    
    // 현재 프로젝트의 공개 로고/숏폼 제거
    const filteredLogos = publicLogos.filter((l: any) => l.projectId !== project.id);
    const filteredShortForms = publicShortForms.filter((sf: any) => sf.projectId !== project.id);
    
      localStorage.setItem('public_logos', JSON.stringify(filteredLogos));
      localStorage.setItem('public_shortforms', JSON.stringify(filteredShortForms));
      
      // 커스텀 이벤트 발생시켜 갤러리에 알림
      window.dispatchEvent(new CustomEvent('publicLogosUpdated'));
      window.dispatchEvent(new CustomEvent('publicShortFormsUpdated'));
      
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
    const logo = logos.find(l => l.id === logoId);
    if (!logo) return;
    
    // 비공개에서 공개로 바꾸는 경우 확인 다이얼로그 표시
    if (!logo.isPublic) {
      setPendingToggleItem({ type: "logo", id: logoId });
      setIsShareDialogOpen(true);
      return;
    }
    
    // 공개에서 비공개로 바꾸는 경우 바로 처리
    setLogos(prevLogos => {
      const updatedLogos = prevLogos.map(l => 
        l.id === logoId ? { ...l, isPublic: false } : l
      );
      
      // 공개된 로고를 localStorage에 저장
      const publicLogos = updatedLogos.filter(l => l.isPublic);
      const publicLogosData = publicLogos.map(l => ({
        id: l.id,
        url: l.url,
        brandName: l.title || "로고",
        likes: 0,
        comments: 0,
        createdAt: new Date(l.createdAt),
        tags: [],
        projectId: project?.id || "",
      }));
      
      // 기존 공개 로고 가져오기
      const existingPublicLogos = JSON.parse(localStorage.getItem('public_logos') || '[]');
      // 현재 프로젝트의 로고 제거 후 새로 추가
      const filteredLogos = existingPublicLogos.filter((l: any) => l.projectId !== project?.id);
      const updatedPublicLogos = [...filteredLogos, ...publicLogosData];
      localStorage.setItem('public_logos', JSON.stringify(updatedPublicLogos));
      
      // 커스텀 이벤트 발생시켜 갤러리에 알림
      window.dispatchEvent(new CustomEvent('publicLogosUpdated'));
      
      return updatedLogos;
    });
    
    toast({
      title: "비공개로 변경되었습니다",
      description: "갤러리에서 제거되었습니다.",
    });
  };
  
  const handleConfirmShare = async () => {
    if (!pendingToggleItem || !project) return;
    
    if (pendingToggleItem.type === "logo") {
      const logo = logos.find(l => l.id === pendingToggleItem.id);
      if (!logo) return;
      
      try {
        // 워터마크 추가
        const watermarkedUrl = await addWatermarkToImage(logo.url);
        
        setLogos(prevLogos => {
          const updatedLogos = prevLogos.map(l => 
            l.id === pendingToggleItem.id 
              ? { ...l, isPublic: true }
              : l
          );
          
          // 공개된 로고를 localStorage에 저장 (워터마크가 추가된 URL 사용)
          const publicLogos = updatedLogos.filter(l => l.isPublic);
          const publicLogosData = publicLogos.map(l => {
            // 현재 로고인 경우 워터마크가 추가된 URL 사용
            const url = l.id === pendingToggleItem.id ? watermarkedUrl : l.url;
            return {
              id: l.id,
              url: url,
              brandName: l.title || "로고",
              likes: 0,
              comments: 0,
              createdAt: new Date(l.createdAt),
              tags: [],
              projectId: project.id,
            };
          });
          
          // 기존 공개 로고 가져오기
          const existingPublicLogos = JSON.parse(localStorage.getItem('public_logos') || '[]');
          // 현재 프로젝트의 로고 제거 후 새로 추가
          const filteredLogos = existingPublicLogos.filter((l: any) => l.projectId !== project.id);
          const updatedPublicLogos = [...filteredLogos, ...publicLogosData];
          localStorage.setItem('public_logos', JSON.stringify(updatedPublicLogos));
          
          // 커스텀 이벤트 발생시켜 갤러리에 알림
          window.dispatchEvent(new CustomEvent('publicLogosUpdated'));
          
          return updatedLogos;
        });
        
        toast({
          title: "게시되었습니다",
          description: "로고 갤러리에 게시되었습니다.",
        });
      } catch (error) {
        console.error('워터마크 추가 실패:', error);
        toast({
          title: "오류",
          description: "워터마크 추가 중 오류가 발생했습니다.",
          variant: "destructive",
        });
        return;
      }
    } else {
      setShortForms(prevShortForms => {
        const updatedShortForms = prevShortForms.map(shortForm => 
          shortForm.id === pendingToggleItem.id 
            ? { ...shortForm, isPublic: true }
            : shortForm
        );
        
        // 공개된 숏폼을 localStorage에 저장
        const publicShortForms = updatedShortForms.filter(sf => sf.isPublic);
        const publicShortFormsData = publicShortForms.map(sf => ({
          id: sf.id,
          thumbnailUrl: sf.url, // 비디오 URL (썸네일로도 사용)
          videoUrl: sf.url, // 실제 비디오 URL
          title: sf.title || "숏폼",
          likes: 0,
          comments: 0,
          duration: "0:15",
          createdAt: new Date(sf.createdAt),
          tags: [],
          projectId: project.id,
        }));
        
        // 기존 공개 숏폼 가져오기
        const existingPublicShortForms = JSON.parse(localStorage.getItem('public_shortforms') || '[]');
        // 현재 프로젝트의 숏폼 제거 후 새로 추가
        const filteredShortForms = existingPublicShortForms.filter((sf: any) => sf.projectId !== project.id);
        const updatedPublicShortForms = [...filteredShortForms, ...publicShortFormsData];
        localStorage.setItem('public_shortforms', JSON.stringify(updatedPublicShortForms));
        
        // 커스텀 이벤트 발생시켜 갤러리에 알림
        window.dispatchEvent(new CustomEvent('publicShortFormsUpdated'));
        
        return updatedShortForms;
      });
      
      toast({
        title: "게시되었습니다",
        description: "숏폼 갤러리에 게시되었습니다.",
      });
    }
    
    setIsShareDialogOpen(false);
    setPendingToggleItem(null);
  };

  const handleToggleShortFormPublic = (shortFormId: string) => {
    const shortForm = shortForms.find(sf => sf.id === shortFormId);
    if (!shortForm) return;
    
    // 비공개에서 공개로 바꾸는 경우 확인 다이얼로그 표시
    if (!shortForm.isPublic) {
      setPendingToggleItem({ type: "short", id: shortFormId });
      setIsShareDialogOpen(true);
      return;
    }
    
    // 공개에서 비공개로 바꾸는 경우 바로 처리
    setShortForms(prevShortForms => {
      const updatedShortForms = prevShortForms.map(sf => 
        sf.id === shortFormId ? { ...sf, isPublic: false } : sf
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
      // 현재 프로젝트의 숏폼 제거 후 새로 추가
      const filteredShortForms = existingPublicShortForms.filter((sf: any) => sf.projectId !== project?.id);
      const updatedPublicShortForms = [...filteredShortForms, ...publicShortFormsData];
      localStorage.setItem('public_shortforms', JSON.stringify(updatedPublicShortForms));
      
      // 커스텀 이벤트 발생시켜 갤러리에 알림
      window.dispatchEvent(new CustomEvent('publicShortFormsUpdated'));
      
      return updatedShortForms;
    });
    
    toast({
      title: "비공개로 변경되었습니다",
      description: "갤러리에서 제거되었습니다.",
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

    // 공개 상태도 제거 (localStorage) - 삭제할 항목의 id와 일치하는 것 제거
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

  // SNS 연동 여부 확인
  const checkSocialMediaConnection = () => {
    const profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    if (profile && (profile.instagram || profile.youtube)) {
      return {
        instagram: profile.instagram?.connected || false,
        youtube: profile.youtube?.connected || false,
      };
    }
    return { instagram: false, youtube: false };
  };

  // 숏폼 업로드 상태 확인 (localStorage에서)
  const getShortFormUploadStatus = (shortFormId: string) => {
    const uploadStatuses = JSON.parse(localStorage.getItem('shortFormUploadStatuses') || '{}');
    return uploadStatuses[shortFormId] || { instagram: false, youtube: false };
  };

  // 숏폼 ID를 savedItems의 ID로 변환
  const getShortFormSavedItemId = (shortFormId: string) => {
    if (!project) return shortFormId;
    const savedItem = project.savedItems?.find(item => item.id === shortFormId && item.type === "short");
    return savedItem ? savedItem.id : shortFormId;
  };

  // 숏폼 업로드 상태 저장
  const saveShortFormUploadStatus = (shortFormId: string, platform: "instagram" | "youtube", uploaded: boolean) => {
    const uploadStatuses = JSON.parse(localStorage.getItem('shortFormUploadStatuses') || '{}');
    if (!uploadStatuses[shortFormId]) {
      uploadStatuses[shortFormId] = { instagram: false, youtube: false };
    }
    uploadStatuses[shortFormId][platform] = uploaded;
    localStorage.setItem('shortFormUploadStatuses', JSON.stringify(uploadStatuses));
  };

  // 숏폼 업로드 버튼 클릭 핸들러
  const handleShortFormUploadClick = (shortForm: ShortFormItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const connections = checkSocialMediaConnection();
    const hasConnection = connections.instagram || connections.youtube;

    if (hasConnection) {
      setSelectedShortFormForUpload(shortForm);
      setIsUploadDialogOpen(true);
      // 이미 업로드된 플랫폼 확인 (savedItems의 ID 사용)
      const savedItemId = getShortFormSavedItemId(shortForm.id);
      const uploadStatus = getShortFormUploadStatus(savedItemId);
      const initialPlatforms = new Set<string>();
      // 이미 업로드된 플랫폼은 선택 불가 (취소 불가)
      // 아직 업로드되지 않은 플랫폼만 선택 가능
      setSelectedPlatforms(initialPlatforms);
    } else {
      toast({
        title: "소셜 미디어 연동 필요",
        description: "숏폼을 업로드하려면 먼저 소셜 미디어 계정을 연동해주세요.",
        variant: "destructive",
      });
    }
  };

  // 플랫폼 선택 토글
  const handlePlatformToggle = (platform: string) => {
    const connections = checkSocialMediaConnection();
    const isConnected = platform === "instagram" ? connections.instagram : connections.youtube;
    
    if (!isConnected) {
      toast({
        title: "소셜 미디어 연동 필요",
        description: `${platform === "instagram" ? "Instagram" : "YouTube"} 계정을 먼저 연동해주세요.`,
        variant: "destructive",
      });
      return;
    }

    // 이미 업로드된 플랫폼은 취소 불가
    if (selectedShortFormForUpload) {
      const savedItemId = getShortFormSavedItemId(selectedShortFormForUpload.id);
      const uploadStatus = getShortFormUploadStatus(savedItemId);
      if (uploadStatus[platform as "instagram" | "youtube"]) {
        toast({
          title: "이미 업로드됨",
          description: `이 숏폼은 이미 ${platform === "instagram" ? "Instagram" : "YouTube"}에 업로드되었습니다.`,
        });
        return;
      }
    }
    
    setSelectedPlatforms(prev => {
      const newSet = new Set(prev);
      if (newSet.has(platform)) {
        newSet.delete(platform);
      } else {
        newSet.add(platform);
      }
      return newSet;
    });
  };

  // 업로드 실행
  const handleConfirmUpload = () => {
    if (selectedShortFormForUpload && selectedPlatforms.size > 0) {
      const platforms = Array.from(selectedPlatforms);
      const platformNames = platforms.map(p => p === "instagram" ? "Instagram" : "YouTube").join(", ");
      
      // 업로드 상태 저장 (savedItems의 ID 사용)
      const savedItemId = getShortFormSavedItemId(selectedShortFormForUpload.id);
      platforms.forEach(platform => {
        saveShortFormUploadStatus(savedItemId, platform as "instagram" | "youtube", true);
      });
      
      // 실제 업로드 로직 (여기서는 더미)
      toast({
        title: "업로드 완료",
        description: `숏폼이 ${platformNames}에 성공적으로 업로드되었습니다.`,
      });
      
      setIsUploadDialogOpen(false);
      setSelectedShortFormForUpload(null);
      setSelectedPlatforms(new Set());
    }
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
                  로고 생성하기
                </Button>
                <Button
                  onClick={handleCreateShort}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  숏폼 생성하기
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
                    <Card key={logo.id} className="overflow-hidden hover:shadow-lg transition-shadow relative group cursor-pointer" onClick={() => setSelectedImage({ url: logo.url, title: logo.title || "로고", type: "logo" })}>
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
                          <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                            <span className="text-xs text-muted-foreground">
                              {logo.isPublic ? "게시" : "비게시"}
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
                  <Button onClick={handleCreateShort} className="bg-orange-500 hover:bg-orange-600 text-white">
                    숏폼 생성하기
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {shortForms.map((shortForm) => (
                    <Card key={shortForm.id} className="overflow-hidden hover:shadow-lg transition-shadow relative group cursor-pointer" onClick={() => setSelectedImage({ url: shortForm.url, title: shortForm.title || "숏폼", type: "short" })}>
                      <CardContent className="p-0">
                        <div className="aspect-[9/16] bg-muted rounded-t-lg overflow-hidden relative">
                          <video
                            src={shortForm.url}
                            className="w-full h-full object-cover"
                            muted
                            loop
                            playsInline
                            autoPlay
                          />
                          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded z-10">
                            숏폼
                          </div>
                          {/* 업로드 버튼 - 왼쪽 하단 */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleShortFormUploadClick(shortForm, e)}
                            className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 hover:bg-background"
                          >
                            <Upload className="h-4 w-4 mr-1" />
                            <span className="text-xs">업로드</span>
                          </Button>
                          {/* 삭제 버튼 - 오른쪽 상단 */}
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
                          <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                            <span className="text-xs text-muted-foreground">
                              {shortForm.isPublic ? "게시" : "비게시"}
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

      {/* 공유 확인 다이얼로그 */}
      <AlertDialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>게시하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              작품을 게시하면 갤러리에 공개되어, 다른 사용자들과 공유되고 함께 감상할 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsShareDialogOpen(false);
              setPendingToggleItem(null);
            }}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmShare} className="bg-primary hover:bg-primary/90">
              게시하기
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

      {/* 숏폼 업로드 다이얼로그 */}
      <Dialog open={isUploadDialogOpen} onOpenChange={(open) => {
        setIsUploadDialogOpen(open);
        if (!open) {
          setSelectedShortFormForUpload(null);
          setSelectedPlatforms(new Set());
        }
      }}>
        <DialogContent className="max-w-[500px]">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">숏폼 업로드</h3>
              {selectedShortFormForUpload && (
                <div className="aspect-[9/16] w-32 mx-auto mb-4 rounded-lg overflow-hidden bg-muted">
                  <video
                    src={selectedShortFormForUpload.url}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                    autoPlay
                  />
                </div>
              )}
            </div>
            
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">업로드할 플랫폼을 선택하세요</p>
              {selectedShortFormForUpload && (() => {
                const connections = checkSocialMediaConnection();
                const savedItemId = getShortFormSavedItemId(selectedShortFormForUpload.id);
                const uploadStatus = getShortFormUploadStatus(savedItemId);
                
                return (
                  <div className="flex flex-col gap-3">
                    {/* Instagram */}
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="upload-instagram"
                        checked={selectedPlatforms.has("instagram")}
                        onCheckedChange={() => handlePlatformToggle("instagram")}
                        disabled={!connections.instagram || uploadStatus.instagram}
                      />
                      <label
                        htmlFor="upload-instagram"
                        className={`text-sm font-medium leading-none cursor-pointer flex items-center gap-2 ${
                          !connections.instagram || uploadStatus.instagram ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                      >
                        <Instagram className="h-4 w-4" />
                        Instagram
                        {uploadStatus.instagram && (
                          <span className="text-xs text-muted-foreground ml-1">(이미 업로드됨)</span>
                        )}
                      </label>
                    </div>
                    
                    {/* YouTube */}
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="upload-youtube"
                        checked={selectedPlatforms.has("youtube")}
                        onCheckedChange={() => handlePlatformToggle("youtube")}
                        disabled={!connections.youtube || uploadStatus.youtube}
                      />
                      <label
                        htmlFor="upload-youtube"
                        className={`text-sm font-medium leading-none cursor-pointer flex items-center gap-2 ${
                          !connections.youtube || uploadStatus.youtube ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                      >
                        <Youtube className="h-4 w-4" />
                        YouTube
                        {uploadStatus.youtube && (
                          <span className="text-xs text-muted-foreground ml-1">(이미 업로드됨)</span>
                        )}
                      </label>
                    </div>
                  </div>
                );
              })()}
            </div>
            
            {selectedPlatforms.size > 0 && (
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsUploadDialogOpen(false);
                    setSelectedShortFormForUpload(null);
                    setSelectedPlatforms(new Set());
                  }}
                >
                  취소
                </Button>
                <Button
                  onClick={handleConfirmUpload}
                >
                  업로드 하기
                </Button>
              </div>
            )}
            
            {selectedPlatforms.size === 0 && (
              <p className="text-xs text-muted-foreground text-center">
                업로드할 플랫폼을 선택해주세요
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 이미지/비디오 확대 보기 다이얼로그 */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-none w-auto p-0 bg-transparent border-none shadow-none">
          <div className="relative flex items-center justify-center min-w-[300px] min-h-[533px]">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 bg-background/80 hover:bg-background"
              onClick={() => setSelectedImage(null)}
            >
              <X className="h-4 w-4" />
            </Button>
            {selectedImage && (
              selectedImage.type === "short" ? (
                <video
                  src={selectedImage.url}
                  className="rounded-lg"
                  style={{ 
                    width: 'min(90vw, 400px)',
                    height: 'auto',
                    aspectRatio: '9/16'
                  }}
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              ) : (
                <img
                  src={selectedImage.url}
                  alt={selectedImage.title}
                  className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
                />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectDashboardPage;

