import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { getProjectDetail, ProjectDetail } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
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
import { Trash2, Image, Video, Calendar, X, Upload, Instagram, Youtube, Download } from "lucide-react";
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

  const projectId = searchParams.get('project');
  
  // DB에서 프로젝트 정보 가져오기
  const { data: project, isLoading: isProjectLoading, error: projectError } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProjectDetail(Number(projectId)),
    enabled: !!projectId && isLoggedIn,
    staleTime: 0,
  });

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
    setIsLoggedIn(currentLoggedIn);
    
    if (!currentLoggedIn) {
      navigate("/");
      return;
    }

    if (!projectId) {
      navigate("/projects");
      return;
    }
  }, [navigate, projectId]);

  // 프로젝트 로드 실패 시 처리
  useEffect(() => {
    if (projectError) {
      toast({
        title: "프로젝트를 찾을 수 없습니다",
        description: "프로젝트가 삭제되었거나 존재하지 않습니다.",
        status: "error",
      });
      navigate("/projects");
    }
  }, [projectError, navigate, toast]);

  // 로고/숏폼 목록은 일단 빈 배열로 설정 (나중에 generation_prod 조인하여 추가)
  useEffect(() => {
    if (project) {
      // TODO: DB에서 로고/숏폼 목록 가져오기 (generation_prod 테이블)
      setLogos([]);
      setShortForms([]);
    }
  }, [project]);

  const handleCreateLogo = () => {
    if (!project || !projectId) return;
    // 로고 스튜디오로 이동 (DB 프로젝트 ID 사용)
    navigate(`/studio?project=${projectId}&type=logo`);
  };

  const handleCreateShort = () => {
    if (!project || !projectId) return;
    // 숏폼 스튜디오로 이동 (DB 프로젝트 ID 사용)
    navigate(`/studio?project=${projectId}&type=short`);
  };

  const handleDeleteProject = () => {
    if (!project) return;
    
    // 프로젝트 삭제 전에 localStorage에서 공개된 로고/숏폼도 제거
    const publicLogos = JSON.parse(localStorage.getItem('public_logos') || '[]');
    const publicShortForms = JSON.parse(localStorage.getItem('public_shortforms') || '[]');
    
    // 현재 프로젝트의 공개 로고/숏폼 제거
    if (projectId) {
      const filteredLogos = publicLogos.filter((l: any) => l.projectId !== projectId);
      const filteredShortForms = publicShortForms.filter((sf: any) => sf.projectId !== projectId);
      
      localStorage.setItem('public_logos', JSON.stringify(filteredLogos));
      localStorage.setItem('public_shortforms', JSON.stringify(filteredShortForms));
      
      // 커스텀 이벤트 발생시켜 갤러리에 알림
      window.dispatchEvent(new CustomEvent('publicLogosUpdated'));
      window.dispatchEvent(new CustomEvent('publicShortFormsUpdated'));
    }
    
    // TODO: DB에서 프로젝트 삭제 API 호출
    toast({
      title: "프로젝트가 삭제되었습니다",
      description: "프로젝트와 관련된 모든 데이터가 삭제되었습니다.",
      status: "success",
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
        projectId: projectId || "",
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
      status: "success",
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
          
          // 공개된 로고를 localStorage에 저장 (모든 로고에 워터마크 추가)
          const publicLogos = updatedLogos.filter(l => l.isPublic);
          
          // 모든 공개된 로고에 워터마크 추가 (비동기 처리)
          Promise.all(publicLogos.map(async (l) => {
            // 현재 게시하는 로고는 이미 워터마크가 추가된 URL 사용
            if (l.id === pendingToggleItem.id) {
            return {
              id: l.id,
                url: watermarkedUrl,
              brandName: l.title || "로고",
              likes: 0,
              comments: 0,
              createdAt: new Date(l.createdAt),
              tags: [],
              projectId: projectId || "",
            };
            }
            // 이미 공개된 다른 로고들도 워터마크 추가
            const watermarkedUrlForOther = await addWatermarkToImage(l.url);
            return {
              id: l.id,
              url: watermarkedUrlForOther,
              brandName: l.title || "로고",
              likes: 0,
              comments: 0,
              createdAt: new Date(l.createdAt),
              tags: [],
              projectId: projectId || "",
            };
          })).then((publicLogosData) => {
          // 기존 공개 로고 가져오기
          const existingPublicLogos = JSON.parse(localStorage.getItem('public_logos') || '[]');
          // 현재 프로젝트의 로고 제거 후 새로 추가
          const filteredLogos = existingPublicLogos.filter((l: any) => l.projectId !== projectId);
          const updatedPublicLogos = [...filteredLogos, ...publicLogosData];
          localStorage.setItem('public_logos', JSON.stringify(updatedPublicLogos));
          
          // 커스텀 이벤트 발생시켜 갤러리에 알림
          window.dispatchEvent(new CustomEvent('publicLogosUpdated'));
          }).catch((error) => {
            console.error('워터마크 추가 실패:', error);
            toast({
              title: "오류",
              description: "워터마크 추가 중 오류가 발생했습니다.",
              status: "error",
            });
          });
          
          return updatedLogos;
        });
        
        toast({
          title: "게시되었습니다",
          description: "로고 갤러리에 게시되었습니다.",
          status: "success",
        });
      } catch (error) {
        console.error('워터마크 추가 실패:', error);
        toast({
          title: "오류",
          description: "워터마크 추가 중 오류가 발생했습니다.",
          status: "error",
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
        const filteredShortForms = existingPublicShortForms.filter((sf: any) => sf.projectId !== projectId);
        const updatedPublicShortForms = [...filteredShortForms, ...publicShortFormsData];
        localStorage.setItem('public_shortforms', JSON.stringify(updatedPublicShortForms));
        
        // 커스텀 이벤트 발생시켜 갤러리에 알림
        window.dispatchEvent(new CustomEvent('publicShortFormsUpdated'));
        
        return updatedShortForms;
      });
      
      toast({
        title: "게시되었습니다",
        description: "숏폼 갤러리에 게시되었습니다.",
        status: "success",
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
        projectId: projectId || "",
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
      status: "success",
    });
  };

  // 로고/숏폼 삭제 핸들러
  const handleDeleteItem = () => {
    if (!itemToDelete) return;

    // TODO: DB에서 로고/숏폼 삭제 API 호출 (generation_prod 테이블)
    // 현재는 상태에서만 제거
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
      status: "success",
    });

    setIsDeleteItemDialogOpen(false);
    setItemToDelete(null);
  };

  // 삭제 버튼 클릭 핸들러
  const handleDownload = (url: string, title: string) => {
    try {
      // 이미지를 fetch하여 Blob으로 변환
      fetch(url)
        .then(response => response.blob())
        .then(blob => {
          // Blob URL 생성
          const blobUrl = window.URL.createObjectURL(blob);
          // 임시 링크 요소 생성
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `${title}.png`;
          // 링크 클릭하여 다운로드 시작
          document.body.appendChild(link);
          link.click();
          // 정리
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
          
          toast({
            title: "다운로드 완료",
            description: `${title}이(가) 다운로드되었습니다.`,
            status: "success",
          });
        })
        .catch((error) => {
          console.error("다운로드 오류:", error);
          toast({
            title: "다운로드 실패",
            description: "이미지 다운로드 중 오류가 발생했습니다.",
            status: "error",
          });
        });
    } catch (error) {
      console.error("다운로드 오류:", error);
      toast({
        title: "다운로드 실패",
        description: "이미지 다운로드 중 오류가 발생했습니다.",
        status: "error",
      });
    }
  };

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

  // 숏폼 ID를 savedItems의 ID로 변환 (URL 기반으로도 찾기)
  // TODO: DB에서 로고/숏폼 목록을 가져오면 이 함수도 수정 필요
  const getShortFormSavedItemId = (shortFormId: string, shortFormUrl?: string) => {
    // 일단 shortFormId 그대로 반환 (DB 기반으로 변경 예정)
    return shortFormId;
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
      // 이미 업로드된 플랫폼 확인 (savedItems의 ID 사용, URL도 함께 전달)
      const savedItemId = getShortFormSavedItemId(shortForm.id, shortForm.url);
      const uploadStatus = getShortFormUploadStatus(savedItemId);
      const initialPlatforms = new Set<string>();
      // 이미 업로드된 플랫폼은 선택 불가 (취소 불가)
      // 아직 업로드되지 않은 플랫폼만 선택 가능
      setSelectedPlatforms(initialPlatforms);
    } else {
      toast({
        title: "소셜 미디어 연동 필요",
        description: "숏폼을 업로드하려면 먼저 소셜 미디어 계정을 연동해주세요.",
        status: "warning",
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
        status: "warning",
      });
      return;
    }

    // 이미 업로드된 플랫폼은 취소 불가
    if (selectedShortFormForUpload) {
      const savedItemId = getShortFormSavedItemId(selectedShortFormForUpload.id, selectedShortFormForUpload.url);
      const uploadStatus = getShortFormUploadStatus(savedItemId);
      if (uploadStatus[platform as "instagram" | "youtube"]) {
        toast({
          title: "이미 업로드됨",
          description: `이 숏폼은 이미 ${platform === "instagram" ? "Instagram" : "YouTube"}에 업로드되었습니다.`,
          status: "info",
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
      
      // 업로드 상태 저장 (savedItems의 ID 사용, URL도 함께 전달)
      const savedItemId = getShortFormSavedItemId(selectedShortFormForUpload.id, selectedShortFormForUpload.url);
      platforms.forEach(platform => {
        saveShortFormUploadStatus(savedItemId, platform as "instagram" | "youtube", true);
      });
      
      // 실제 업로드 로직 (여기서는 더미)
      toast({
        title: "업로드 완료",
        description: `숏폼이 ${platformNames}에 성공적으로 업로드되었습니다.`,
        status: "success",
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
                  {project.grp_nm}
                </h1>
                {project.grp_desc && (
                  <p className="text-lg text-muted-foreground mb-4">
                    {project.grp_desc}
                  </p>
                )}
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span>로고 {logos.length}개</span>
                    <span>·</span>
                    <span>숏폼 {shortForms.length}개</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    className="text-destructive hover:bg-destructive hover:text-destructive-foreground h-auto w-auto p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
                  className="text-white gap-2"
                  style={{ backgroundColor: '#7C22C8' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#6B1DB5'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#7C22C8'}
                >
                  <Image className="h-4 w-4" />
                  로고 생성하기
                </Button>
                <Button
                  onClick={handleCreateShort}
                  className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
                >
                  <Video className="h-4 w-4" />
                  숏폼 생성하기
                </Button>
              </div>
            </div>

            <TabsContent value="logos" className="mt-0">
              {logos.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-muted-foreground mb-4">아직 생성된 로고가 없습니다.</p>
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
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 hover:bg-destructive hover:text-destructive-foreground text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(logo.url, logo.title || "로고");
                            }}
                            className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 dark:bg-background/90 hover:bg-black/70 dark:hover:bg-background text-white dark:text-foreground"
                          >
                            <Download className="h-4 w-4" />
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
                            className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 hover:bg-background hover:text-foreground"
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
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 hover:bg-destructive hover:text-destructive-foreground text-destructive"
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
                              className="data-[state=checked]:bg-[#FF8A3D]"
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
        <AlertDialogContent
          onOverlayClick={() => setIsDeleteItemDialogOpen(false)}
        >
          {/* X 버튼 */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 h-6 w-6 rounded-sm opacity-70 ring-offset-background transition-opacity hover:bg-transparent hover:opacity-100 hover:text-foreground focus:outline-none focus:ring-0 z-10"
            onClick={() => setIsDeleteItemDialogOpen(false)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
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
        <AlertDialogContent
          onOverlayClick={() => {
            setIsShareDialogOpen(false);
            setPendingToggleItem(null);
          }}
        >
          {/* X 버튼 */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 h-6 w-6 rounded-sm opacity-70 ring-offset-background transition-opacity hover:bg-transparent hover:opacity-100 hover:text-foreground focus:outline-none focus:ring-0 z-10"
            onClick={() => {
              setIsShareDialogOpen(false);
              setPendingToggleItem(null);
            }}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
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
        <AlertDialogContent
          onOverlayClick={() => setIsDeleteDialogOpen(false)}
        >
          {/* X 버튼 */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 h-6 w-6 rounded-sm opacity-70 ring-offset-background transition-opacity hover:bg-transparent hover:opacity-100 hover:text-foreground focus:outline-none focus:ring-0 z-10"
            onClick={() => setIsDeleteDialogOpen(false)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
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
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">숏폼 업로드</h3>
              {selectedShortFormForUpload && (
                <div className="space-y-2">
                  <div className="aspect-[9/16] w-full max-w-[200px] mx-auto rounded-lg overflow-hidden bg-muted">
                    <video
                      src={selectedShortFormForUpload.url}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      playsInline
                      autoPlay
                    />
                  </div>
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">업로드할 플랫폼을 선택해주세요</p>
              {selectedShortFormForUpload && (() => {
                const connections = checkSocialMediaConnection();
                const savedItemId = getShortFormSavedItemId(selectedShortFormForUpload.id, selectedShortFormForUpload.url);
                const uploadStatus = getShortFormUploadStatus(savedItemId);
                
                return (
                  <div className="flex justify-center gap-4">
                    {/* Instagram 카드 */}
                    <div className="flex flex-col items-center gap-1">
                    <Card 
                      className={`relative cursor-pointer transition-all hover:opacity-80 ${
                        !connections.instagram || uploadStatus.instagram 
                          ? "opacity-50 cursor-not-allowed" 
                          : selectedPlatforms.has("instagram")
                          ? "ring-2 ring-primary"
                          : ""
                      }`}
                      onClick={() => {
                        if (!connections.instagram || uploadStatus.instagram) return;
                        handlePlatformToggle("instagram");
                      }}
                    >
                      <CardContent className="p-6 flex flex-col items-center gap-4 min-w-[140px]">
                        <div className="absolute top-3 left-3">
                          <div className={`h-4 w-4 rounded-full border-2 ${
                            selectedPlatforms.has("instagram")
                              ? "bg-primary border-primary"
                              : "border-muted-foreground/50"
                          }`}>
                            {selectedPlatforms.has("instagram") && (
                              <div className="h-full w-full rounded-full bg-primary flex items-center justify-center">
                                <div className="h-2 w-2 rounded-full bg-background" />
                              </div>
                            )}
                          </div>
                        </div>
                        <img
                          src="/icon/instagram-logo.png"
                          alt="Instagram"
                          className="h-12 w-12 object-contain"
                        />
                        <span className="text-sm font-medium lowercase">instagram</span>
                      </CardContent>
                    </Card>
                      {uploadStatus.instagram && (
                        <span className="text-xs text-muted-foreground mt-1">(이미 업로드됨)</span>
                      )}
                    </div>
                    
                    {/* YouTube 카드 */}
                    <div className="flex flex-col items-center gap-1">
                    <Card 
                      className={`relative cursor-pointer transition-all hover:opacity-80 ${
                        !connections.youtube || uploadStatus.youtube 
                          ? "opacity-50 cursor-not-allowed" 
                          : selectedPlatforms.has("youtube")
                          ? "ring-2 ring-primary"
                          : ""
                      }`}
                      onClick={() => {
                        if (!connections.youtube || uploadStatus.youtube) return;
                        handlePlatformToggle("youtube");
                      }}
                    >
                      <CardContent className="p-6 flex flex-col items-center gap-4 min-w-[140px]">
                        <div className="absolute top-3 left-3">
                          <div className={`h-4 w-4 rounded-full border-2 ${
                            selectedPlatforms.has("youtube")
                              ? "bg-primary border-primary"
                              : "border-muted-foreground/50"
                          }`}>
                            {selectedPlatforms.has("youtube") && (
                              <div className="h-full w-full rounded-full bg-primary flex items-center justify-center">
                                <div className="h-2 w-2 rounded-full bg-background" />
                              </div>
                            )}
                          </div>
                        </div>
                        <img
                          src="/icon/youtube-logo.png"
                          alt="YouTube"
                          className="h-12 w-12 object-contain"
                        />
                        <span className="text-sm font-medium lowercase">youtube</span>
                      </CardContent>
                    </Card>
                      {uploadStatus.youtube && (
                        <span className="text-xs text-muted-foreground mt-1">(이미 업로드됨)</span>
                      )}
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
                  className="hover:bg-transparent hover:text-foreground"
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
            
          </div>
        </DialogContent>
      </Dialog>

      {/* 이미지/비디오 확대 보기 다이얼로그 */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-none w-auto p-0 bg-transparent border-none shadow-none [&>button]:hidden">
          <div className="relative flex items-center justify-center min-w-[300px] min-h-[533px]">
            {selectedImage && (
              selectedImage.type === "short" ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 z-10 bg-background/80 hover:bg-transparent"
                    onClick={() => setSelectedImage(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
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
                </>
              ) : (
                <div className="relative">
                  <img
                    src={selectedImage.url}
                    alt={selectedImage.title}
                    className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 z-10 bg-background/80 hover:bg-transparent"
                    onClick={() => setSelectedImage(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectDashboardPage;

