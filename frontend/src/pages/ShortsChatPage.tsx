// ShortsChatPage.tsx는 StudioPage.tsx의 숏폼 관련 부분만 추출한 파일입니다.
// StudioPage.tsx가 매우 크므로 (3437줄), 핵심 로직만 추출하여 새 파일을 생성합니다.
// 이 파일은 StudioPage.tsx의 숏폼 관련 로직을 기반으로 작성되었습니다.

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Send, ChevronLeft, RefreshCw, Star, Plus, X, FolderOpen, Folder, Trash2, Video, Loader2, Upload, Save, Instagram, Youtube, Info } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { projectStorage, type Message, type SavedItem } from "@/lib/projectStorage";
import StudioTopBar from "@/components/StudioTopBar";
import { getShortsIntro, sendShortsChat, getProjectDetail, getShortsList, saveShorts, deleteShorts, uploadToYouTube, uploadToTikTok, getTikTokConnectionStatus, getYouTubeConnectionStatus } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

interface SelectedResult {
  type: "short";
  url: string;
  index: number;
}

const ShortsChatPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [hasResultPanel, setHasResultPanel] = useState(false);
  const [hasStartedChat, setHasStartedChat] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SelectedResult | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => {
    return searchParams.get('project');
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 저장된 숏폼 추적
  const [savedShorts, setSavedShorts] = useState<SavedItem[]>([]);
  const [activeStorageTab, setActiveStorageTab] = useState<"shorts" | null>("shorts"); // 디폴트가 펼쳐진 상태
  
  const [isChatLoaded, setIsChatLoaded] = useState(false);
  const [isLoadingShortsIntro, setIsLoadingShortsIntro] = useState(false);
  const [hasCalledShortsIntro, setHasCalledShortsIntro] = useState(false);
  const [shortsSessionId, setShortsSessionId] = useState<string | null>(null);
  const [isLoadingShortsChat, setIsLoadingShortsChat] = useState(false);
  const introCalledRef = useRef(false); // 중복 호출 방지용 ref
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // SNS 업로드 관련 state
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedShortFormForUpload, setSelectedShortFormForUpload] = useState<SelectedResult | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [socialConnections, setSocialConnections] = useState<{ tiktok: boolean; youtube: boolean }>({ tiktok: false, youtube: false });

  // localStorage에서 사용자 정보 가져오기
  const getUserProfile = () => {
    const stored = localStorage.getItem('userProfile');
    if (stored) {
      const profile = JSON.parse(stored);
      if (profile.name && !profile.nickname) {
        profile.nickname = profile.name;
        delete profile.name;
      }
      if (profile.email && !profile.id) {
        profile.id = profile.email;
        delete profile.email;
      }
      return {
        name: profile.nickname || "사용자",
        email: profile.id || "user@example.com",
        avatar: profile.avatar || null,
        tiktok: profile.tiktok?.connected || false,
        youtube: profile.youtube?.connected || false,
        tokensUsed: 132,
        tokensTotal: 200,
      };
    }
    return {
      name: "사용자",
      email: "user@example.com",
      avatar: null,
      tiktok: false,
      youtube: false,
      tokensUsed: 132,
      tokensTotal: 200,
    };
  };

  const [userProfile, setUserProfile] = useState(getUserProfile());

  useEffect(() => {
    setIsLoggedIn(localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true');
    
    const handleStorageChange = () => {
      setUserProfile(getUserProfile());
      setIsLoggedIn(localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true');
    };
    
    const handleProfileUpdate = () => {
      setUserProfile(getUserProfile());
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('profileUpdated', handleProfileUpdate);
    const interval = setInterval(handleStorageChange, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('profileUpdated', handleProfileUpdate);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    setIsLoggedIn(localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true');
  }, []);

  // 프로젝트 로드
  useEffect(() => {
    const currentLoggedIn = localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true';
    setIsLoggedIn(currentLoggedIn);
    if (!currentLoggedIn) {
      navigate("/");
      return;
    }

    const projectId = searchParams.get('project');
    
    // 프로젝트 ID가 변경되면 ref와 플래그 리셋
    if (projectId !== currentProjectId) {
      introCalledRef.current = false;
      setHasCalledShortsIntro(false);
      setMessages([]);
    }
    
    if (projectId) {
      const project = projectStorage.getProject(projectId);
      const isDbProjectId = /^\d+$/.test(projectId);
      
      setCurrentProjectId(projectId);
      
      // DB 프로젝트 ID인 경우 숏츠 목록 불러오기
      if (isDbProjectId) {
        const dbProjectIdNum = parseInt(projectId);
        loadShortsFromDb(dbProjectIdNum);
      }
      
      if (isDbProjectId && !project) {
        setIsChatLoaded(true);
      }
      
      // DB 프로젝트 ID인 경우: 즉시 고정 인사 메시지 표시 후 intro API 호출
      if (isDbProjectId && !project && !hasCalledShortsIntro && !introCalledRef.current && messages.length === 0) {
        const dbProjectIdNum = parseInt(projectId);
        introCalledRef.current = true; // 중복 호출 방지
        setHasCalledShortsIntro(true);
        
        // 즉시 고정 인사 메시지 표시 (페이지 로드 시 바로 보이도록)
        const greetingMessage: Message = {
          role: "assistant",
          content: "저는 숏폼 생성 전용 에이전트 입니다.\n\n먼저 고객님의 브랜드 정보와 최신 숏폼 트렌드 분석을 알려드리겠습니다.\n\n잠시만 기다려주세요.",
          studioType: "short"
        };
        setMessages([greetingMessage]);
        setHasStartedChat(true);
        setIsChatLoaded(true);
        
        // 로딩 인디케이터 즉시 표시 (getProjectDetail 대기 시간 동안 사용자에게 피드백 제공)
        setIsLoadingShortsIntro(true);
        
        // 프로젝트 접근 권한 확인 후 intro API 호출
        getProjectDetail(dbProjectIdNum)
          .then(() => {
            // 접근 권한이 있으면 intro API 호출 (로딩은 이미 표시됨)
            return getShortsIntro({ project_id: dbProjectIdNum });
          })
          .then((response) => {
            if (response && response.shorts_session_id) {
              setShortsSessionId(response.shorts_session_id);
            }
            if (response) {
              const introMessage: Message = {
                role: "assistant",
                content: response.reply,
                studioType: "short"
              };
              // 고정 인사 메시지 뒤에 LLM 응답 추가
              setMessages(prev => [...prev, introMessage]);
            }
          })
          .catch((error) => {
            console.error('숏폼 intro API 호출 실패:', error);
            // 에러 발생 시 로딩 인디케이터 제거
            setIsLoadingShortsIntro(false);
            // 403 또는 404 에러인 경우 프로젝트 목록으로 리다이렉트
            if (error.message.includes('접근 권한') || error.message.includes('찾을 수 없습니다')) {
              // 접근 권한이 없으면 표시된 메시지 제거
              setMessages([]);
              toast({
                title: "프로젝트 접근 불가",
                description: error.message || "프로젝트에 접근할 수 없습니다.",
                variant: "destructive",
              });
              navigate("/projects");
            } else {
              toast({
                title: "브랜드 정보 로드 실패",
                description: "브랜드 요약 정보를 가져오는데 실패했습니다.",
                variant: "destructive",
              });
              const fallbackMessage: Message = {
                role: "assistant",
                content: `${userProfile.name}님, 숏폼을 만들어볼까요?`,
                studioType: "short"
              };
              // 고정 인사 메시지가 있으면 그 뒤에 추가, 없으면 새로 생성
              setMessages(prev => {
                if (prev.length > 0 && prev[0].content.includes("숏폼 생성 전용 에이전트")) {
                  return [...prev, fallbackMessage];
                }
                return [fallbackMessage];
              });
            }
          })
          .finally(() => {
            setIsLoadingShortsIntro(false);
          });
        return;
      }
      
      if (project) {
        // 기존 프로젝트 로딩 로직 (숏폼 관련만)
        setIsChatLoaded(true);
      } else {
        if (isDbProjectId) {
          setIsChatLoaded(true);
        } else {
          setIsChatLoaded(false);
        }
      }
    } else {
      setCurrentProjectId(null);
      setIsChatLoaded(false);
    }
  }, [isLoggedIn, navigate, searchParams, hasCalledShortsIntro, userProfile.name, toast]);

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && attachedImages.length === 0) || !currentProjectId) return;

    const userMessage: Message = {
      role: "user",
      content: inputValue || (attachedImages.length > 0 ? "(이미지 첨부)" : ""),
      images: attachedImages.length > 0 ? attachedImages : undefined,
      studioType: "short"
    };
    setMessages(prev => [...prev, userMessage]);
    
    const currentInput = inputValue;
    const currentImages = attachedImages;
    setInputValue("");
    setAttachedImages([]);
    
    setIsLoadingShortsChat(true);

    try {
      const response = await sendShortsChat({
        project_id: parseInt(currentProjectId),
        message: currentInput,
        shorts_session_id: shortsSessionId || undefined,
        images: currentImages.length > 0 ? currentImages : undefined,  // 이미지 추가
      });
      if (response.shorts_session_id) {
        setShortsSessionId(response.shorts_session_id);
      }
      const aiMessage: Message = {
        role: "assistant",
        content: response.reply,
        studioType: "short"
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error("Chat API 호출 실패:", error);
      toast({
        title: "챗봇 응답 실패",
        description: "챗봇 응답을 가져오는데 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingShortsChat(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userProfile');
    toast({
      title: "로그아웃되었습니다",
      description: "다음에 또 만나요!",
    });
    navigate("/");
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isLoadingShortsIntro) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [isLoadingShortsIntro]);

  const handleImageAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/') && (file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/jpg')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setAttachedImages(prev => [...prev, event.target.result as string]);
          }
        };
        reader.readAsDataURL(file);
      } else {
        toast({
          title: "지원하지 않는 파일 형식",
          description: "PNG 또는 JPG 파일만 첨부할 수 있습니다.",
          variant: "destructive",
        });
      }
    });
  };

  const handleRemoveImage = (index: number) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };


  const handleToggleStorageTab = (tab: "shorts") => {
    if (activeStorageTab === tab) {
      setActiveStorageTab(null);
    } else {
      setActiveStorageTab(tab);
    }
  };

  const handleSavedItemClick = (item: SavedItem) => {
    setSelectedResult({
      type: "short",
      url: item.url,
      index: item.index,
    });
    setHasResultPanel(false);
  };


  // DB에서 숏츠 목록 불러오기
  const loadShortsFromDb = async (projectId: number) => {
    try {
      const shortsList = await getShortsList(projectId);
      // DB에서 가져온 데이터를 SavedItem 형식으로 변환
      // 오래된 것일수록 낮은 번호를 가지도록 역순으로 번호 매기기
      const dbShorts: SavedItem[] = shortsList.map((item, index) => ({
        id: `db_${item.prod_id}`,
        url: item.file_url,
        type: "short" as const,
        index: index,
        title: `숏폼 ${shortsList.length - index}`, // 역순으로 번호 매기기
        createdAt: item.create_dt || new Date().toISOString(),
      }));
      setSavedShorts(dbShorts);
    } catch (error) {
      console.error("숏츠 목록 로드 실패:", error);
      // 에러 발생 시 빈 배열로 설정
      setSavedShorts([]);
    }
  };

  // 비디오를 base64로 변환하는 함수
  const convertVideoToBase64 = async (videoUrl: string): Promise<string> => {
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      throw new Error("비디오를 변환하는데 실패했습니다.");
    }
  };

  // 프로젝트에 저장 핸들러
  const handleSaveToProject = async () => {
    if (!selectedResult || !currentProjectId) {
      toast({
        title: "저장 실패",
        description: "프로젝트 정보가 없습니다.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // 비디오를 base64로 변환
      const base64Video = await convertVideoToBase64(selectedResult.url);
      
      // API 호출
      const response = await saveShorts({
        base64_video: base64Video,
        project_id: parseInt(currentProjectId),
        prod_type_id: 2,
      });

      toast({
        title: "저장 완료",
        description: response.message || "쇼츠가 프로젝트에 저장되었습니다.",
      });
      
      // selectedResult.url을 저장된 파일 URL로 업데이트 (버튼이 "프로젝트에서 삭제"로 바뀌도록)
      if (response.file_url && selectedResult) {
        setSelectedResult({
          ...selectedResult,
          url: response.file_url,
        });
      }
      
      // 저장 성공 후 목록 새로고침
      if (currentProjectId) {
        await loadShortsFromDb(parseInt(currentProjectId));
      }
    } catch (error: any) {
      console.error("쇼츠 저장 실패:", error);
      toast({
        title: "저장 실패",
        description: error.message || "쇼츠 저장에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 프로젝트에서 삭제 핸들러
  const handleDeleteFromProject = async () => {
    if (!selectedResult || !currentProjectId) {
      return;
    }

    // savedShorts에서 현재 선택된 쇼츠 찾기
    const savedShort = savedShorts.find(
      item => item.url === selectedResult.url && item.type === selectedResult.type
    );

    if (!savedShort) {
      toast({
        title: "삭제 실패",
        description: "저장된 쇼츠를 찾을 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    // prod_id 추출 (id가 "db_123" 형식이므로 숫자 부분만 추출)
    const prodId = parseInt(savedShort.id.replace('db_', ''));

    if (isNaN(prodId)) {
      toast({
        title: "삭제 실패",
        description: "유효하지 않은 쇼츠 ID입니다.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      await deleteShorts(prodId);

      toast({
        title: "삭제 완료",
        description: "쇼츠가 프로젝트에서 삭제되었습니다.",
      });
      
      // 삭제 성공 후 목록 새로고침
      if (currentProjectId) {
        await loadShortsFromDb(parseInt(currentProjectId));
      }
      
      // 미리보기에서 비디오 제거
      setSelectedResult(null);
      setHasResultPanel(false);
    } catch (error: any) {
      console.error("쇼츠 삭제 실패:", error);
      toast({
        title: "삭제 실패",
        description: error.message || "쇼츠 삭제에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
      setShowDeleteConfirm(false);
    }
  };

  // 현재 선택된 쇼츠가 저장되어 있는지 확인
  const isShortSaved = selectedResult ? savedShorts.some(
    item => item.url === selectedResult.url && item.type === selectedResult.type
  ) : false;

  // SNS 연동 여부 확인 (DB에서 조회)
  const checkSocialMediaConnection = () => {
    return socialConnections;
  };

  // DB에서 연동 상태 조회
  useEffect(() => {
    const loadConnectionStatus = async () => {
      try {
        const [tiktokStatus, youtubeStatus] = await Promise.all([
          getTikTokConnectionStatus().catch(() => ({ connected: false })),
          getYouTubeConnectionStatus().catch(() => ({ connected: false })),
        ]);
        
        setSocialConnections({
          tiktok: tiktokStatus.connected || false,
          youtube: youtubeStatus.connected || false,
        });
      } catch (error) {
        console.error('연동 상태 조회 실패:', error);
        setSocialConnections({ tiktok: false, youtube: false });
      }
    };

    loadConnectionStatus();
  }, []);

  // 플랫폼 선택 토글
  const handlePlatformToggle = (platform: string) => {
    const connections = checkSocialMediaConnection();
    const isConnected = platform === "tiktok" ? connections.tiktok : connections.youtube;
    
    if (!isConnected) {
      toast({
        title: "소셜 미디어 연동 필요",
        description: `${platform === "tiktok" ? "TikTok" : "YouTube"} 계정을 먼저 연동해주세요.`,
        variant: "destructive",
      });
      return;
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

  // 업로드 버튼 클릭 핸들러
  const handleUploadClick = () => {
    if (!selectedResult) return;
    
    const connections = checkSocialMediaConnection();
    const hasConnection = connections.tiktok || connections.youtube;

    if (hasConnection) {
      setSelectedShortFormForUpload(selectedResult);
      setIsUploadDialogOpen(true);
      setSelectedPlatforms(new Set());
      setUploadTitle(`숏폼 ${selectedResult.index + 1}`);
    } else {
      toast({
        title: "소셜 미디어 연동 필요",
        description: "숏폼을 업로드하려면 먼저 소셜 미디어 계정을 연동해주세요.",
        variant: "destructive",
      });
    }
  };

  // 업로드 실행
  const handleConfirmUpload = async () => {
    if (selectedShortFormForUpload && selectedPlatforms.size > 0 && currentProjectId) {
      if (isUploading) {
        return;
      }
      
      setIsUploading(true);
      const platforms = Array.from(selectedPlatforms);
      
      // 각 플랫폼별 업로드 결과 추적
      const uploadResults: { platform: string; success: boolean; error?: string }[] = [];
      
      // 각 플랫폼을 개별적으로 처리
      for (const platform of platforms) {
        try {
          if (platform === 'youtube') {
            await uploadToYouTube({
              video_url: selectedShortFormForUpload.url,
              title: uploadTitle || `숏폼 ${selectedShortFormForUpload.index + 1}`,
              project_id: Number(currentProjectId),
              tags: [],
              privacy: 'public'
            });
            uploadResults.push({ platform: 'youtube', success: true });
          } else if (platform === 'tiktok') {
            await uploadToTikTok({
              video_url: selectedShortFormForUpload.url,
              caption: uploadTitle || `숏폼 ${selectedShortFormForUpload.index + 1}`,
              project_id: Number(currentProjectId),
            });
            uploadResults.push({ platform: 'tiktok', success: true });
          }
        } catch (error: any) {
          console.error(`${platform} 업로드 실패:`, error);
          uploadResults.push({ 
            platform, 
            success: false, 
            error: error.message || `${platform} 업로드 중 오류가 발생했습니다.` 
          });
        }
      }
      
      // 결과 메시지 표시
      const successPlatforms = uploadResults.filter(r => r.success).map(r => r.platform === "tiktok" ? "TikTok" : "YouTube");
      const failedPlatforms = uploadResults.filter(r => !r.success).map(r => r.platform === "tiktok" ? "TikTok" : "YouTube");
      
      if (successPlatforms.length > 0 && failedPlatforms.length === 0) {
        toast({
          title: "업로드 완료",
          description: `숏폼이 ${successPlatforms.join(", ")}에 성공적으로 업로드되었습니다.`,
        });
        setIsUploadDialogOpen(false);
        setSelectedShortFormForUpload(null);
        setSelectedPlatforms(new Set());
        setUploadTitle("");
      } else if (successPlatforms.length > 0 && failedPlatforms.length > 0) {
        toast({
          title: "부분 업로드 완료",
          description: `${successPlatforms.join(", ")} 업로드 성공, ${failedPlatforms.join(", ")} 업로드 실패`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "업로드 실패",
          description: `플랫폼 업로드에 실패했습니다. ${failedPlatforms.join(", ")}`,
          variant: "destructive",
        });
      }
      
      setIsUploading(false);
    }
  };

  const currentLoggedIn = localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true';
  if (!currentLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="w-full px-12 py-4 flex items-center justify-between">
            <Link to="/" className="text-2xl font-bold tracking-tight text-foreground hover:opacity-80 transition-opacity">
              MAKERY
            </Link>
            <div className="flex items-center gap-3">
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center">
          <Card className="p-12 text-center max-w-md">
            <h2 className="text-2xl font-bold mb-4">로그인 후 이용할 수 있는 기능입니다.</h2>
            <p className="text-muted-foreground mb-6">
              AI와 함께 숏폼을 만들어보세요.
            </p>
            <Button size="lg" onClick={() => navigate("/")}>
              로그인하기
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <StudioTopBar
        onBack={() => {
          if (currentProjectId) {
            navigate(`/project?project=${currentProjectId}`);
          } else {
            navigate("/projects");
          }
        }}
        onNavigate={(path) => navigate(path)}
        onLogout={handleLogout}
        userName={userProfile.name}
        userEmail={userProfile.email}
        tokensUsed={userProfile.tokensUsed}
        tokensTotal={userProfile.tokensTotal}
        userAvatar={userProfile.avatar}
        tiktokConnected={userProfile.tiktok}
        youtubeConnected={userProfile.youtube}
        studioType="shorts"
      />

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={60} minSize={60} maxSize={85}>
            <div className="h-full flex flex-col bg-background">
              <div className="flex-1 min-h-0 overflow-hidden">
                {!hasResultPanel && !selectedResult ? (
                  <div className="h-full" />
                ) : selectedResult ? (
                  <div className="h-full flex flex-col">
                    <div className="p-4 flex items-center justify-between flex-shrink-0">
                      <h2 className="text-lg font-semibold">숏폼 #{selectedResult.index + 1}</h2>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedResult(null);
                            setHasResultPanel(false);
                          }}
                          className="hover:bg-transparent"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-8 overflow-auto bg-background">
                      <div className="max-h-full aspect-[9/16] relative group">
                        <video 
                          src={selectedResult.url} 
                          className="w-full h-full object-cover rounded-lg shadow-lg"
                          autoPlay
                          loop
                          muted
                          playsInline
                          controls
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg pointer-events-none">
                          <div className="flex flex-col gap-2 justify-center items-center pointer-events-auto">
                            <Button 
                              size="sm" 
                              variant="secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUploadClick();
                              }}
                              disabled={isUploading}
                              className="bg-background/90 hover:bg-background"
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              업로드
                            </Button>
                            <Button 
                              size="sm" 
                              variant="secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isShortSaved) {
                                  setShowDeleteConfirm(true);
                                } else {
                                  handleSaveToProject();
                                }
                              }}
                              disabled={isSaving}
                              className="bg-background/90 hover:bg-background"
                            >
                              {isSaving ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  {isShortSaved ? "삭제 중..." : "저장 중..."}
                                </>
                              ) : (
                                <>
                                  {isShortSaved ? (
                                    <>
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      프로젝트에서 삭제
                                    </>
                                  ) : (
                                    <>
                                      <Save className="h-4 w-4 mr-2" />
                                      프로젝트에 저장
                                    </>
                                  )}
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full" />
                )}
              </div>

              <div className="flex-shrink-0 bg-background">
                {activeStorageTab && (
                  <div className="px-8 py-4">
                    <div className="overflow-x-auto">
                      {activeStorageTab === "shorts" && savedShorts.length > 0 && (
                        <div className="flex gap-3 justify-center pb-2">
                          {savedShorts.map((short) => (
                            <div
                              key={short.id}
                              onClick={() => handleSavedItemClick(short)}
                              className={`flex-shrink-0 w-14 h-24 rounded-lg overflow-hidden border-2 cursor-pointer transition-all relative ${
                                selectedResult?.url === short.url && selectedResult?.type === "short"
                                  ? "shadow-md"
                                  : "border-border"
                              }`}
                            >
                              <video
                                src={short.url}
                                className="w-full h-full object-cover"
                                muted
                                loop
                                playsInline
                                autoPlay
                              />
                              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-1 py-0.5 text-center truncate">
                                {short.title}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="flex justify-center items-center gap-2 pb-6">
                  <Button
                    variant={activeStorageTab === "shorts" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleToggleStorageTab("shorts")}
                    className={activeStorageTab === "shorts" ? "bg-primary hover:bg-primary/90 text-primary-foreground" : ""}
                  >
                    {activeStorageTab === "shorts" ? (
                      <FolderOpen className="h-4 w-4 mr-2" />
                    ) : (
                      <Folder className="h-4 w-4 mr-2" />
                    )}
                    숏폼 보관함
                  </Button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:bg-transparent hover:text-muted-foreground"
                        >
                          <Info className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-xs">
                          본 서비스에서 생성된 콘텐츠는 AI에 의해 자동 생성되며, 저작권, 상표권 등 법적 책임은 사용자에게 있습니다. MAKERY는 생성된 콘텐츠와 관련된 법적 분쟁에 대해 책임을 지지 않습니다.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle className="w-1 bg-transparent hover:bg-transparent" withHandle />

          <ResizablePanel defaultSize={40} minSize={15} maxSize={40}>
            <div className="h-full p-4">
              <div className="h-full flex flex-col rounded-2xl bg-studio-chat-panel border border-border shadow-lg overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
                  <div className="space-y-3">
                    {messages.map((message, index) => (
                      <div key={index} className="space-y-1">
                        {message.role === "assistant" && (
                          <div className="flex items-center gap-2 mb-1">
                            <img 
                              src="/makery-logo.png" 
                              alt="Makery Logo" 
                              className="h-5 w-5"
                            />
                            <span className="text-sm font-semibold text-foreground">MAKERY</span>
                          </div>
                        )}
                        {message.content && message.content.trim() && (
                          <div className={`flex flex-col gap-2 ${message.role === "user" ? "items-end" : "items-start"}`}>
                            <div className={`flex items-end gap-2 w-full ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                              <Card
                                className={`max-w-[80%] p-4 ${
                                  message.role === "user"
                                    ? "text-white border-0"
                                    : "bg-muted"
                                }`}
                                style={message.role === "user" ? { backgroundColor: '#FF8A3D' } : undefined}
                              >
                                {message.role === "user" && message.images && message.images.length > 0 && (
                                  <div className="mb-3 space-y-2">
                                    {message.images.map((img, imgIdx) => (
                                      <div key={imgIdx} className="relative">
                                        <img
                                          src={img}
                                          alt={`첨부 이미지 ${imgIdx + 1}`}
                                          className="max-w-full max-h-48 rounded-md object-cover"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                                
                                {(() => {
                                  const videoUrlMatch = message.content.match(/\[VIDEO_URL\](.*?)\[\/VIDEO_URL\]/);
                                  
                                  if (videoUrlMatch && message.role === "assistant") {
                                    const videoUrl = videoUrlMatch[1];
                                    const textContent = message.content
                                      .replace(/\[VIDEO_URL\].*?\[\/VIDEO_URL\]/, '')
                                      .trim();
                                    
                                    return (
                                      <>
                                        {textContent && <p className="whitespace-pre-wrap mb-3">{textContent}</p>}
                                        <div className="mt-2 bg-black/5 rounded-lg p-2">
                                          {/* 썸네일 영상 (자동재생 없음) */}
                                          <div 
                                            className="relative w-48 mx-auto cursor-pointer hover:opacity-80 transition-opacity"
                                            onClick={() => {
                                              // 클릭 시 왼쪽 패널에서 재생
                                              setSelectedResult({
                                                type: "short",
                                                url: videoUrl,
                                                index: savedShorts.length,
                                              });
                                              setHasResultPanel(false);
                                            }}
                                          >
                                            <video 
                                              src={videoUrl} 
                                              className="w-full h-auto rounded-md"
                                              muted
                                              playsInline
                                              style={{ aspectRatio: '9/16' }}
                                              onMouseEnter={(e) => e.currentTarget.play()}
                                              onMouseLeave={(e) => {
                                                e.currentTarget.pause();
                                                e.currentTarget.currentTime = 0;
                                              }}
                                            />
                                            {/* 재생 아이콘 오버레이 */}
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-md pointer-events-none">
                                              <div className="bg-white/90 rounded-full p-3">
                                                <Video className="h-6 w-6 text-primary" />
                                              </div>
                                            </div>
                                          </div>
                                          <p className="text-center text-sm text-muted-foreground mt-2 mb-2">
                                          </p>
                                        </div>
                                      </>
                                    );
                                  }
                                  
                                  // VIDEO_URL이 없으면 기존 텍스트 렌더링
                                  return <p className="whitespace-pre-wrap break-words">{message.content}</p>;
                                })()}
                              </Card>
                            </div>
                            {/* 숏폼이 생성된 경우에만 "내 프로젝트로 이동" 버튼 표시 */}
                            {(() => {
                              const videoUrlMatch = message.content.match(/\[VIDEO_URL\](.*?)\[\/VIDEO_URL\]/);
                              if (videoUrlMatch && message.role === "assistant" && currentProjectId) {
                                return (
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      navigate(`/project?project=${currentProjectId}`);
                                    }}
                                    className="text-sm text-white"
                                    style={{ backgroundColor: '#FF8B3D' }}
                                  >
                                    내 프로젝트로 이동
                                  </Button>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        )}
                      </div>
                    ))}
                    {isLoadingShortsIntro && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 mb-1">
                          <img 
                            src="/makery-logo.png" 
                            alt="Makery Logo" 
                            className="h-5 w-5"
                          />
                          <span className="text-sm font-semibold text-foreground">MAKERY</span>
                        </div>
                        <div className="flex justify-start">
                          <Card className="max-w-[80%] p-4 bg-muted">
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              <p className="text-muted-foreground">브랜드 정보와 트렌드 정보를 제공 중입니다...</p>
                            </div>
                          </Card>
                        </div>
                      </div>
                    )}
                    {isLoadingShortsChat && (
                      <div className="flex justify-start">
                        <Card className="max-w-[80%] p-4 bg-muted">
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            <p className="text-muted-foreground">답변을 생성 중입니다...</p>
                          </div>
                        </Card>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                <div className="flex-shrink-0 p-4">
                  {attachedImages.length > 0 && (
                    <div className="mb-2 flex gap-2 flex-wrap">
                      {attachedImages.map((img, idx) => (
                        <div key={idx} className="relative">
                          <img src={img} alt={`첨부 ${idx + 1}`} className="w-16 h-16 object-cover rounded border" />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => handleRemoveImage(idx)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="relative">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageAttach}
                      accept="image/png,image/jpeg,image/jpg"
                      multiple
                      className="hidden"
                    />
                    <Textarea
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="메시지를 입력하세요..."
                      className="min-h-[40px] max-h-[40px] resize-none pr-12 pl-12 py-2 text-sm w-full"
                      rows={1}
                      disabled={isLoadingShortsIntro || isLoadingShortsChat}
                    />
                    <Button
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      variant="ghost"
                      className="absolute bottom-1 left-2 h-8 w-8 p-0 bg-transparent border-0 hover:bg-transparent"
                      disabled={isLoadingShortsIntro || isLoadingShortsChat}
                    >
                      <Plus className="h-4 w-4 text-primary" />
                    </Button>
                    <Button 
                      onClick={handleSendMessage} 
                      size="icon"
                      variant="ghost"
                      className="absolute bottom-1 right-1 h-8 w-8 hover:bg-transparent"
                      disabled={(!inputValue.trim() && attachedImages.length === 0) || isLoadingShortsIntro || isLoadingShortsChat}
                    >
                      {(isLoadingShortsIntro || isLoadingShortsChat) ? (
                        <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <Send className="h-4 w-4 text-primary" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* 숏폼 업로드 다이얼로그 */}
      <Dialog open={isUploadDialogOpen} onOpenChange={(open) => {
        setIsUploadDialogOpen(open);
        if (!open) {
          setSelectedShortFormForUpload(null);
          setSelectedPlatforms(new Set());
          setUploadTitle("");
        } else if (selectedShortFormForUpload) {
          setUploadTitle(`숏폼 ${selectedShortFormForUpload.index + 1}`);
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
                
                return (
                  <div className="flex justify-center gap-4">
                    {/* TikTok 카드 */}
                    <div className="flex flex-col items-center gap-1">
                      <Card 
                        className={`relative cursor-pointer transition-all hover:opacity-80 ${
                          !connections.tiktok
                            ? "opacity-50 cursor-not-allowed" 
                            : selectedPlatforms.has("tiktok")
                            ? "ring-2 ring-primary"
                            : ""
                        }`}
                        onClick={() => {
                          if (!connections.tiktok) return;
                          handlePlatformToggle("tiktok");
                        }}
                      >
                        <CardContent className="p-6 flex flex-col items-center gap-4 min-w-[140px]">
                          <div className="absolute top-3 left-3">
                            <div className={`h-4 w-4 rounded-full border-2 ${
                              selectedPlatforms.has("tiktok")
                                ? "bg-primary border-primary"
                                : "border-muted-foreground/50"
                            }`}>
                              {selectedPlatforms.has("tiktok") && (
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
                    </div>
                    
                    {/* YouTube 카드 */}
                    <div className="flex flex-col items-center gap-1">
                      <Card 
                        className={`relative cursor-pointer transition-all hover:opacity-80 ${
                          !connections.youtube
                            ? "opacity-50 cursor-not-allowed" 
                            : selectedPlatforms.has("youtube")
                            ? "ring-2 ring-primary"
                            : ""
                        }`}
                        onClick={() => {
                          if (!connections.youtube) return;
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
                    if (isUploading) return;
                    setIsUploadDialogOpen(false);
                    setSelectedShortFormForUpload(null);
                    setSelectedPlatforms(new Set());
                    setUploadTitle("");
                  }}
                  disabled={isUploading}
                  className="hover:bg-transparent hover:text-foreground"
                >
                  취소
                </Button>
                <Button
                  onClick={handleConfirmUpload}
                  disabled={isUploading || !uploadTitle.trim()}
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

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>숏폼 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 숏폼을 프로젝트에서 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFromProject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ShortsChatPage;

