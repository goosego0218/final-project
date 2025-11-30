import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { getProjectDetail, deleteProject, ProjectDetail, ProjectListItem, getShortsList, getLogoList, uploadToYouTube, uploadToTikTok, updateLogoPubYn, updateShortsPubYn, downloadLogo, deleteLogo, deleteShorts } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, Image, Video, Calendar, X, Upload, Instagram, Youtube, Download } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { addWatermarkToImage, addWatermarkToVideo } from "@/utils/watermark";

interface LogoItem {
  id: string;
  url: string;
  createdAt: string;
  title?: string;
  isPublic?: boolean;
  prodId?: number; // DB prod_id 추가
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
  const queryClient = useQueryClient();
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState(""); // 제목 입력 상태

  const projectId = searchParams.get('project');
  
  // DB에서 프로젝트 정보 가져오기
  const { data: project, isLoading: isProjectLoading, error: projectError } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProjectDetail(Number(projectId)),
    enabled: !!projectId && isLoggedIn,
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지 (중복 호출 방지)
    gcTime: 10 * 60 * 1000, // 10분간 메모리 유지
    refetchOnWindowFocus: false, // 탭 전환 시 자동 refetch 방지
    refetchOnMount: false, // 마운트 시 refetch 방지
  });

  // localStorage 변경 감지하여 로그인 상태 업데이트
  useEffect(() => {
    // 초기 로그인 상태 확인
    setIsLoggedIn(localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true');
    
    const handleStorageChange = () => {
      setIsLoggedIn(localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true');
    };
    
    window.addEventListener('storage', handleStorageChange);
    // interval 제거: 불필요한 반복 호출 방지
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
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
      // React Query 에러에서 상태 코드 확인
      const error = projectError as any;
      const statusCode = error?.response?.status || error?.status;
      
      if (statusCode === 403 || (projectError instanceof Error && projectError.message.includes("접근 권한"))) {
        toast({
          title: "접근 권한 없음",
          description: "이 프로젝트에 접근할 수 없습니다.",
          status: "error",
        });
      } else {
        toast({
          title: "프로젝트를 찾을 수 없습니다",
          description: "프로젝트가 삭제되었거나 존재하지 않습니다.",
          status: "error",
        });
      }
      navigate("/projects");
    }
  }, [projectError, navigate, toast]);

  // 로고/숏폼 목록은 일단 빈 배열로 설정 (나중에 generation_prod 조인하여 추가)
  useEffect(() => {
    if (project && projectId) {
      // DB에서 로고 목록 가져오기
      const loadLogos = async () => {
        try {
          const logoList = await getLogoList(Number(projectId));
          // DB에서 가져온 데이터를 LogoItem 형식으로 변환
          // 오래된 것일수록 낮은 번호를 가지도록 역순으로 번호 매기기
          const dbLogos: LogoItem[] = logoList.map((item, index) => ({
            id: `db_${item.prod_id}`,
            url: item.file_url,
            createdAt: item.create_dt || new Date().toISOString(),
            title: `로고 ${logoList.length - index}`, // 역순으로 번호 매기기
            isPublic: item.pub_yn === 'Y', // DB에서 가져온 pub_yn 값 사용
            prodId: item.prod_id, // prod_id 추가
          }));
          setLogos(dbLogos);
        } catch (error) {
          console.error("로고 목록 로드 실패:", error);
          setLogos([]);
        }
      };
      
      // DB에서 숏폼 목록 가져오기
      const loadShorts = async () => {
        try {
          const shortsList = await getShortsList(Number(projectId));
          // DB에서 가져온 데이터를 ShortFormItem 형식으로 변환
          // 오래된 것일수록 낮은 번호를 가지도록 역순으로 번호 매기기
          const dbShortForms: ShortFormItem[] = shortsList.map((item, index) => ({
            id: `db_${item.prod_id}`,
            url: item.file_url,
            createdAt: item.create_dt || new Date().toISOString(),
            title: `숏폼 ${shortsList.length - index}`, // 역순으로 번호 매기기
            isPublic: item.pub_yn === 'Y', // DB에서 가져온 pub_yn 값 사용
          }));
          setShortForms(dbShortForms);
        } catch (error) {
          console.error("숏폼 목록 로드 실패:", error);
          setShortForms([]);
        }
      };
      
      loadLogos();
      loadShorts();
    }
  }, [project, projectId]);

  const handleCreateLogo = () => {
    if (!project || !projectId) return;
    // 로고 챗봇으로 이동
    navigate(`/chat/logo?project=${projectId}`);
  };

  const handleCreateShort = () => {
    if (!project || !projectId) return;
    // 숏폼 챗봇으로 이동
    navigate(`/chat/shorts?project=${projectId}`);
  };

  const handleDeleteProject = async () => {
    if (!project || !projectId) return;

    setIsDeleting(true);
    try {
      // Optimistic update: 프로젝트 목록에서 즉시 제거
      queryClient.setQueryData<ProjectListItem[]>(['userProjects'], (old) => {
        if (!old) return old;
        return old.filter(p => p.grp_id !== Number(projectId));
      });
      
      // DB에서 프로젝트 삭제 API 호출
      await deleteProject(Number(projectId));
      
      // 프로젝트 삭제 전에 localStorage에서 공개된 로고/숏폼도 제거
      const publicLogos = JSON.parse(localStorage.getItem('public_logos') || '[]');
      const publicShortForms = JSON.parse(localStorage.getItem('public_shortforms') || '[]');
      
      // 현재 프로젝트의 공개 로고/숏폼 제거
      const filteredLogos = publicLogos.filter((l: any) => l.projectId !== projectId);
      const filteredShortForms = publicShortForms.filter((sf: any) => sf.projectId !== projectId);
      
      localStorage.setItem('public_logos', JSON.stringify(filteredLogos));
      localStorage.setItem('public_shortforms', JSON.stringify(filteredShortForms));
      
      // 커스텀 이벤트 발생시켜 갤러리에 알림
      window.dispatchEvent(new CustomEvent('publicLogosUpdated'));
      window.dispatchEvent(new CustomEvent('publicShortFormsUpdated'));
      
      // 삭제 성공 후 쿼리 무효화 (백그라운드에서 최신 데이터 가져오기)
      queryClient.invalidateQueries({ queryKey: ['userProjects'] });
      
      toast({
        title: "프로젝트 삭제",
        description: "프로젝트가 삭제되었습니다.",
        status: "success",
      });
      
      navigate("/projects");
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleTogglePublic = async (logoId: string) => {
    const logo = logos.find(l => l.id === logoId);
    if (!logo) return;
    
    // prod_id 추출 (id가 "db_123" 형식이므로)
    const prodId = parseInt(logoId.replace('db_', ''));
    if (isNaN(prodId)) {
      toast({
        title: "오류",
        description: "유효하지 않은 로고 ID입니다.",
        status: "error",
      });
      return;
    }
    
    // 비공개에서 공개로 바꾸는 경우 확인 다이얼로그 표시
    if (!logo.isPublic) {
      setPendingToggleItem({ type: "logo", id: logoId });
      setIsShareDialogOpen(true);
      return;
    }
    
    // 공개에서 비공개로 바꾸는 경우 바로 처리
    try {
      await updateLogoPubYn(prodId, 'N');
      
      setLogos(prevLogos => {
        return prevLogos.map(l => 
          l.id === logoId ? { ...l, isPublic: false } : l
        );
      });
      
      // 갤러리 데이터 갱신
      queryClient.invalidateQueries({ queryKey: ['logoGallery'] });
      
      toast({
        title: "비공개로 변경되었습니다",
        description: "갤러리에서 제거되었습니다.",
        status: "success",
      });
    } catch (error) {
      toast({
        title: "업데이트 실패",
        description: error instanceof Error ? error.message : "공개 여부 업데이트에 실패했습니다.",
        status: "error",
      });
    }
  };
  
  const handleConfirmShare = async () => {
    if (!pendingToggleItem || !project) return;
    
    if (pendingToggleItem.type === "logo") {
      const logo = logos.find(l => l.id === pendingToggleItem.id);
      if (!logo) return;
      
      // prod_id 추출
      const prodId = parseInt(pendingToggleItem.id.replace('db_', ''));
      if (isNaN(prodId)) {
        toast({
          title: "오류",
          description: "유효하지 않은 로고 ID입니다.",
          status: "error",
        });
        return;
      }
      
      try {
        // DB에 PUB_YN 업데이트
        await updateLogoPubYn(prodId, 'Y');
        
        // UI 업데이트
        setLogos(prevLogos => {
          return prevLogos.map(l => 
            l.id === pendingToggleItem.id 
              ? { ...l, isPublic: true }
              : l
          );
        });
        
        // 갤러리 데이터 갱신
        queryClient.invalidateQueries({ queryKey: ['logoGallery'] });
        
        setIsShareDialogOpen(false);
        setPendingToggleItem(null);
        
        toast({
          title: "게시되었습니다",
          description: "로고 갤러리에 게시되었습니다.",
          status: "success",
        });
      } catch (error) {
        console.error('공개 여부 업데이트 실패:', error);
        toast({
          title: "오류",
          description: error instanceof Error ? error.message : "공개 여부 업데이트에 실패했습니다.",
          status: "error",
        });
      }
    } else {
      // 숏폼 게시
      const shortForm = shortForms.find(sf => sf.id === pendingToggleItem.id);
      if (!shortForm) return;
      
      // prod_id 추출
      const prodId = parseInt(pendingToggleItem.id.replace('db_', ''));
      if (isNaN(prodId)) {
        toast({
          title: "오류",
          description: "유효하지 않은 숏폼 ID입니다.",
          status: "error",
        });
        return;
      }
      
      try {
        // DB에 PUB_YN 업데이트
        await updateShortsPubYn(prodId, 'Y');
        
        // UI 업데이트
        setShortForms(prevShortForms => {
          return prevShortForms.map(sf => 
            sf.id === pendingToggleItem.id 
              ? { ...sf, isPublic: true }
              : sf
          );
        });
        
        // 갤러리 데이터 갱신
        queryClient.invalidateQueries({ queryKey: ['shortsGallery'] });
        
        setIsShareDialogOpen(false);
        setPendingToggleItem(null);
        
        toast({
          title: "게시되었습니다",
          description: "숏폼 갤러리에 게시되었습니다.",
          status: "success",
        });
      } catch (error) {
        console.error('공개 여부 업데이트 실패:', error);
        toast({
          title: "오류",
          description: error instanceof Error ? error.message : "공개 여부 업데이트에 실패했습니다.",
          status: "error",
        });
      }
    }
    
    setIsShareDialogOpen(false);
    setPendingToggleItem(null);
  };

  const handleToggleShortFormPublic = async (shortFormId: string) => {
    const shortForm = shortForms.find(sf => sf.id === shortFormId);
    if (!shortForm) return;
    
    // prod_id 추출
    const prodId = parseInt(shortFormId.replace('db_', ''));
    if (isNaN(prodId)) {
      toast({
        title: "오류",
        description: "유효하지 않은 숏폼 ID입니다.",
        status: "error",
      });
      return;
    }
    
    // 비공개에서 공개로 바꾸는 경우 확인 다이얼로그 표시
    if (!shortForm.isPublic) {
      setPendingToggleItem({ type: "short", id: shortFormId });
      setIsShareDialogOpen(true);
      return;
    }
    
    // 공개에서 비공개로 바꾸는 경우 바로 처리
    try {
      await updateShortsPubYn(prodId, 'N');
      
      setShortForms(prevShortForms => {
        return prevShortForms.map(sf => 
          sf.id === shortFormId ? { ...sf, isPublic: false } : sf
        );
      });
      
      // 갤러리 데이터 갱신
      queryClient.invalidateQueries({ queryKey: ['shortsGallery'] });
      
      toast({
        title: "비공개로 변경되었습니다",
        description: "갤러리에서 제거되었습니다.",
        status: "success",
      });
    } catch (error) {
      toast({
        title: "업데이트 실패",
        description: error instanceof Error ? error.message : "공개 여부 업데이트에 실패했습니다.",
        status: "error",
      });
    }
  };

  // 로고/숏폼 삭제 핸들러 (DB에서 실제 삭제)
  const handleDeleteItem = async () => {
    if (!itemToDelete || !projectId) return;

    try {
      // prod_id 추출 (id가 "db_123" 형식이므로)
      const prodId = parseInt(itemToDelete.id.replace('db_', ''));
      if (isNaN(prodId)) {
        toast({
          title: "삭제 실패",
          description: "유효하지 않은 항목 ID입니다.",
          variant: "destructive",
        });
        setIsDeleteItemDialogOpen(false);
        setItemToDelete(null);
        return;
      }

      // DB에서 삭제 API 호출
      if (itemToDelete.type === "logo") {
        await deleteLogo(prodId);
      } else {
        await deleteShorts(prodId);
      }

      // 삭제 성공 후 목록 새로고침 (DB에서 다시 가져오기)
      if (itemToDelete.type === "logo") {
        const logoList = await getLogoList(Number(projectId));
        const dbLogos: LogoItem[] = logoList.map((item, index) => ({
          id: `db_${item.prod_id}`,
          url: item.file_url,
          createdAt: item.create_dt || new Date().toISOString(),
          title: `로고 ${logoList.length - index}`,
          isPublic: item.pub_yn === 'Y',
          prodId: item.prod_id,
        }));
        setLogos(dbLogos);
      } else {
        const shortsList = await getShortsList(Number(projectId));
        const dbShortForms: ShortFormItem[] = shortsList.map((item, index) => ({
          id: `db_${item.prod_id}`,
          url: item.file_url,
          createdAt: item.create_dt || new Date().toISOString(),
          title: `숏폼 ${shortsList.length - index}`,
          isPublic: item.pub_yn === 'Y',
        }));
        setShortForms(dbShortForms);
      }

      // 갤러리 데이터도 무효화 (삭제된 항목이 갤러리에 있을 수 있음)
      queryClient.invalidateQueries({ queryKey: ['logoGallery'] });
      queryClient.invalidateQueries({ queryKey: ['shortsGallery'] });
      queryClient.invalidateQueries({ queryKey: ['homePopularLogos'] });
      queryClient.invalidateQueries({ queryKey: ['homePopularShorts'] });

      toast({
        title: itemToDelete.type === "logo" ? "로고가 삭제되었습니다" : "숏폼이 삭제되었습니다",
      });

      setIsDeleteItemDialogOpen(false);
      setItemToDelete(null);
    } catch (error: any) {
      console.error("삭제 오류:", error);
      toast({
        title: "삭제 실패",
        description: error.message || "항목 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // 다운로드 버튼 클릭 핸들러 (백엔드 프록시 사용)
  const handleDownload = async (logo: LogoItem) => {
    if (!logo.prodId) {
      toast({
        title: "다운로드 실패",
        description: "로고 정보를 찾을 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      await downloadLogo(logo.prodId, `${logo.title || "로고"}.png`);
      toast({
        title: "다운로드 완료",
        description: `${logo.title || "로고"}이(가) 다운로드되었습니다.`,
      });
    } catch (error: any) {
      console.error("다운로드 오류:", error);
      toast({
        title: "다운로드 실패",
        description: error.message || "이미지 다운로드 중 오류가 발생했습니다.",
        variant: "destructive",
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
        description: `${platform === "instagram" ? "TikTok" : "YouTube"} 계정을 먼저 연동해주세요.`,
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
          description: `이 숏폼은 이미 ${platform === "instagram" ? "TikTok" : "YouTube"}에 업로드되었습니다.`,
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
  const handleConfirmUpload = async () => {
    if (selectedShortFormForUpload && selectedPlatforms.size > 0) {
      // 이미 업로드 중이면 중복 실행 방지
      if (isUploading) {
        return;
      }
      
      setIsUploading(true); // 업로드 시작
      const platforms = Array.from(selectedPlatforms);
      
      // 각 플랫폼별 업로드 결과 추적
      const uploadResults: { platform: string; success: boolean; error?: string }[] = [];
      
      // 각 플랫폼을 개별적으로 처리
      for (const platform of platforms) {
        try {
          if (platform === 'youtube') {
            await uploadToYouTube({
              video_url: selectedShortFormForUpload.url,
              title: uploadTitle || selectedShortFormForUpload.title || "숏폼", // 사용자 입력 제목 사용
              project_id: Number(projectId), // 프로젝트 ID 전달 (백엔드에서 브랜드 프로필 가져옴)
              tags: [],
              privacy: 'public'
            });
            uploadResults.push({ platform: 'youtube', success: true });
          } else if (platform === 'instagram') {
            await uploadToTikTok({
              video_url: selectedShortFormForUpload.url,
              caption: uploadTitle || selectedShortFormForUpload.title || "숏폼",
              project_id: Number(projectId),
            });
            uploadResults.push({ platform: 'instagram', success: true });
          }
        } catch (error: any) {
          console.error(`${platform} 업로드 실패:`, error);
          uploadResults.push({ 
            platform, 
            success: false, 
            error: error.message || `${platform} 업로드 중 오류가 발생했습니다.` 
          });
          // 개별 플랫폼 실패해도 다른 플랫폼은 계속 진행
        }
      }
      
      // 성공한 플랫폼만 상태 저장
      const savedItemId = getShortFormSavedItemId(selectedShortFormForUpload.id, selectedShortFormForUpload.url);
      uploadResults.forEach(result => {
        if (result.success) {
          saveShortFormUploadStatus(savedItemId, result.platform as "instagram" | "youtube", true);
        }
      });
      
      // 결과 메시지 표시
      const successPlatforms = uploadResults.filter(r => r.success).map(r => r.platform === "instagram" ? "TikTok" : "YouTube");
      const failedPlatforms = uploadResults.filter(r => !r.success).map(r => r.platform === "instagram" ? "TikTok" : "YouTube");
      
      if (successPlatforms.length > 0 && failedPlatforms.length === 0) {
        // 모두 성공
        toast({
          title: "업로드 완료",
          description: `숏폼이 ${successPlatforms.join(", ")}에 성공적으로 업로드되었습니다.`,
          status: "success",
        });
        setIsUploadDialogOpen(false);
        setSelectedShortFormForUpload(null);
        setSelectedPlatforms(new Set());
        setUploadTitle(""); // 제목 초기화
      } else if (successPlatforms.length > 0 && failedPlatforms.length > 0) {
        // 부분 성공
        toast({
          title: "부분 업로드 완료",
          description: `${successPlatforms.join(", ")} 업로드 성공, ${failedPlatforms.join(", ")} 업로드 실패`,
          status: "warning",
        });
        // 다이얼로그는 유지 (실패한 플랫폼 재시도 가능)
      } else {
        // 모두 실패
        toast({
          title: "업로드 실패",
          description: `플랫폼 업로드에 실패했습니다. ${failedPlatforms.join(", ")}`,
          status: "error",
        });
        // 다이얼로그는 유지 (재시도 가능)
      }
      
      setIsUploading(false);
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
                              handleDownload(logo);
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
                          playsInline
                          preload="metadata"
                          onLoadedMetadata={(e) => {
                            // 메타데이터 로드 후 명시적으로 정지 상태로 설정
                            e.currentTarget.pause();
                            e.currentTarget.currentTime = 0;
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.play().catch(() => {
                              // 재생 실패 시 무시 (브라우저 정책 등)
                            });
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.pause();
                            e.currentTarget.currentTime = 0;
                          }}
                        />
                        {/* 재생 아이콘 오버레이 */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-t-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="bg-white/90 rounded-full p-3">
                            <Video className="h-6 w-6 text-primary" />
                          </div>
                        </div>
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
                          <h3 className="font-semibold text-foreground mb-1">
                            {shortForm.title || "숏폼"}
                          </h3>
                          <p className="text-xs text-muted-foreground mb-3">
                            {formatDate(shortForm.createdAt)}
                          </p>
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
                "삭제하기"
              )}
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
          setUploadTitle(""); // 다이얼로그 닫을 때 초기화
        } else if (selectedShortFormForUpload) {
          // 다이얼로그 열 때 기본 제목 설정
          setUploadTitle(selectedShortFormForUpload.title || "");
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
            
            {/* 제목 입력 필드 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                제목 (필수)
              </label>
              <Input
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="숏폼 제목을 입력하세요"
                disabled={isUploading}
                required
              />
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">업로드할 플랫폼을 선택해주세요</p>
              {selectedShortFormForUpload && (() => {
                const connections = checkSocialMediaConnection();
                const savedItemId = getShortFormSavedItemId(selectedShortFormForUpload.id, selectedShortFormForUpload.url);
                const uploadStatus = getShortFormUploadStatus(savedItemId);
                
                return (
                  <div className="flex justify-center gap-4">
                    {/* TikTok 카드 */}
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
                          src="/icon/tiktok-logo.png"
                          alt="TikTok"
                          className="h-12 w-12 object-contain"
                        />
                        <span className="text-sm font-medium lowercase">tiktok</span>
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
                    if (isUploading) return; // 업로드 중에는 취소 불가
                    setIsUploadDialogOpen(false);
                    setSelectedShortFormForUpload(null);
                    setSelectedPlatforms(new Set());
                    setUploadTitle(""); // 제목 초기화
                  }}
                  disabled={isUploading} // 업로드 중 비활성화
                  className="hover:bg-transparent hover:text-foreground"
                >
                  취소
                </Button>
                <Button
                  onClick={handleConfirmUpload}
                  disabled={isUploading || !uploadTitle.trim()} // 업로드 중이거나 제목이 없으면 비활성화
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      업로드 중...
                    </>
                  ) : (
                    "업로드 하기"
                  )}
                </Button>
              </div>
            )}
            
          </div>
        </DialogContent>
      </Dialog>

      {/* 이미지/비디오 확대 보기 다이얼로그 */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-none w-auto p-0 bg-transparent border-none shadow-none [&>button]:hidden">
          <DialogTitle className="sr-only">{selectedImage?.title || "미리보기"}</DialogTitle>  
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

