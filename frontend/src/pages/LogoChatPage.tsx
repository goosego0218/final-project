// LogoChatPage.tsx는 StudioPage.tsx의 로고 관련 부분만 추출한 파일입니다.
// StudioPage.tsx가 매우 크므로 (3437줄), 핵심 로직만 추출하여 새 파일을 생성합니다.
// 이 파일은 StudioPage.tsx의 로고 관련 로직을 기반으로 작성되었습니다.

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Send, ChevronLeft, RefreshCw, Star, Plus, X, FolderOpen, Folder, Trash2, Image, Loader2, Download, Info } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { projectStorage, type Message, type SavedItem } from "@/lib/projectStorage";
import StudioTopBar from "@/components/StudioTopBar";
import { getLogoIntro, sendLogoChat, getProjectDetail } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";
import { saveLogo, getLogoList, deleteLogo } from "@/lib/api";
import { Save } from "lucide-react";
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
  type: "logo";
  url: string;
  index: number;
}

const LogoChatPage = () => {
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
  
  // 저장된 로고 추적
  const [savedLogos, setSavedLogos] = useState<SavedItem[]>([]);
  const [activeStorageTab, setActiveStorageTab] = useState<"logos" | null>("logos"); // 기본적으로 열려있음
  
  // 로고 생성 시 브랜드 정보 및 디자인 방향
  const [brandInfo, setBrandInfo] = useState<{ brand_name: string; industry: string } | null>(null);
  const [selectedLogoType, setSelectedLogoType] = useState<"text" | "text-icon" | "emblem" | null>(null);
  const [logoTypeSelected, setLogoTypeSelected] = useState(false);
  
  // 로고 추천 단계 관리
  const [recommendationStep, setRecommendationStep] = useState<"none" | "first" | "second">("none");
  const [firstRecommendations, setFirstRecommendations] = useState<string[]>([]);
  const [secondRecommendations, setSecondRecommendations] = useState<string[]>([]);
  const [selectedFirstLogo, setSelectedFirstLogo] = useState<string | null>(null);
  const [selectedSecondLogo, setSelectedSecondLogo] = useState<string | null>(null);
  const [previewLogoImage, setPreviewLogoImage] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [isWaitingFinalLogoDetail, setIsWaitingFinalLogoDetail] = useState(false);
  const [finalLogoExtraDescription, setFinalLogoExtraDescription] = useState<string>("");
  const [isChatLoaded, setIsChatLoaded] = useState(false);
  const [isLoadingLogoIntro, setIsLoadingLogoIntro] = useState(false);
  const [hasCalledLogoIntro, setHasCalledLogoIntro] = useState(false);
  const [logoSessionId, setLogoSessionId] = useState<string | null>(null);
  const [isLoadingLogoChat, setIsLoadingLogoChat] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const introCalledRef = useRef(false); // 중복 호출 방지용 ref

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
      setHasCalledLogoIntro(false);
      setMessages([]);
    }
    
    if (projectId) {
      const project = projectStorage.getProject(projectId);
      const isDbProjectId = /^\d+$/.test(projectId);
      
      setCurrentProjectId(projectId);
      
      if (isDbProjectId && !project) {
        setIsChatLoaded(true);
      }
      
      // DB 프로젝트 ID인 경우: 즉시 고정 인사 메시지 표시 후 intro API 호출
      if (isDbProjectId && !project && !hasCalledLogoIntro && !introCalledRef.current && messages.length === 0) {
        const dbProjectIdNum = parseInt(projectId);
        introCalledRef.current = true; // 중복 호출 방지
        setHasCalledLogoIntro(true);
        
        // 즉시 고정 인사 메시지 표시 (페이지 로드 시 바로 보이도록)
        const greetingMessage: Message = {
          role: "assistant",
          content: "저는 로고 생성 전용 에이전트 입니다.\n\n먼저 고객님의 브랜드 정보와 최신 로고 트렌드 분석을 알려드리겠습니다.\n\n잠시만 기다려주세요.",
          studioType: "logo"
        };
        setMessages([greetingMessage]);
        setHasStartedChat(true);
        setIsChatLoaded(true);
        
        // 로딩 인디케이터 즉시 표시 (getProjectDetail 대기 시간 동안 사용자에게 피드백 제공)
        setIsLoadingLogoIntro(true);
        
        // 프로젝트 접근 권한 확인 후 intro API 호출
        getProjectDetail(dbProjectIdNum)
          .then(() => {
            // 접근 권한이 있으면 intro API 호출 (로딩은 이미 표시됨)
            return getLogoIntro({ project_id: dbProjectIdNum });
          })
          .then((response) => {
            if (response && response.logo_session_id) {
              setLogoSessionId(response.logo_session_id);
            }
            if (response) {
              const introMessage: Message = {
                role: "assistant",
                content: response.reply,
                studioType: "logo"
              };
              // 고정 인사 메시지 뒤에 LLM 응답 추가
              setMessages(prev => [...prev, introMessage]);
            }
          })
          .catch((error) => {
            console.error('로고 intro API 호출 실패:', error);
            // 에러 발생 시 로딩 인디케이터 제거
            setIsLoadingLogoIntro(false);
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
                content: `${userProfile.name}님, 로고를 만들어볼까요?`,
                studioType: "logo"
              };
              // 고정 인사 메시지가 있으면 그 뒤에 추가, 없으면 새로 생성
              setMessages(prev => {
                if (prev.length > 0 && prev[0].content.includes("로고 생성 전용 에이전트")) {
                  return [...prev, fallbackMessage];
                }
                return [fallbackMessage];
              });
            }
          })
          .finally(() => {
            setIsLoadingLogoIntro(false);
          });
        return;
      }
      
      if (project) {
        // 기존 프로젝트 로딩 로직 (로고 관련만)
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
  }, [isLoggedIn, navigate, searchParams, hasCalledLogoIntro, userProfile.name, toast]);

  // 프로젝트 로드 시 DB에서 로고 목록 불러오기
  useEffect(() => {
    if (currentProjectId && isLoggedIn) {
      loadLogosFromDb(parseInt(currentProjectId));
    }
  }, [currentProjectId, isLoggedIn]);

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && attachedImages.length === 0) || !currentProjectId) return;

    const userMessage: Message = {
      role: "user",
      content: inputValue || (attachedImages.length > 0 ? "(이미지 첨부)" : ""),
      images: attachedImages.length > 0 ? attachedImages : undefined,
      studioType: "logo"
    };
    setMessages(prev => [...prev, userMessage]);
    
    const currentInput = inputValue;
    const currentImages = attachedImages;
    setInputValue("");
    setAttachedImages([]);
    
    setIsLoadingLogoChat(true);

    try {
      const response = await sendLogoChat({
        project_id: parseInt(currentProjectId),
        message: currentInput,
        logo_session_id: logoSessionId || undefined,
        reference_images: currentImages.length > 0 ? currentImages : undefined,
      });
      if (response.logo_session_id) {
        setLogoSessionId(response.logo_session_id);
      }
      const aiMessage: Message = {
        role: "assistant",
        content: response.reply,
        studioType: "logo"
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
      setIsLoadingLogoChat(false);
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
    if (isLoadingLogoIntro) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [isLoadingLogoIntro]);

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

  const handleSave = (url: string, type: "logo", index: number) => {
    if (!currentProjectId) return;
    
    const item: SavedItem = {
      id: `${type}_${Date.now()}_${index}`,
      url,
      type,
      index,
      title: `로고 ${savedLogos.length + 1}`,
      createdAt: new Date().toISOString(),
    };

    const project = projectStorage.getProject(currentProjectId);
    if (project) {
      const existingInProject = project.savedItems?.some(saved => saved.url === url && saved.type === "logo");
      if (existingInProject) {
        toast({
          title: "이미 저장된 로고입니다",
          description: "이 로고는 이미 저장되어 있습니다.",
        });
        return;
      }
    }
    
    setSavedLogos(prev => {
      if (prev.some(saved => saved.url === url)) {
        toast({
          title: "이미 저장된 로고입니다",
          description: "이 로고는 이미 저장되어 있습니다.",
        });
        return prev;
      }
      
      const updated = [...prev, item];
      
      if (project) {
        const allSavedItems = [...(project.savedItems || []), item];
        project.savedItems = allSavedItems;
        projectStorage.saveProject(project);
      }
      
      toast({
        title: "로고가 저장되었습니다",
        description: "하단 보관함에서 확인할 수 있습니다.",
      });
      return updated;
    });
  };

  const handleToggleStorageTab = (tab: "logos") => {
    if (activeStorageTab === tab) {
      setActiveStorageTab(null);
    } else {
      setActiveStorageTab(tab);
    }
  };

  const handleSavedItemClick = (item: SavedItem) => {
    setSelectedResult({
      type: "logo",
      url: item.url,
      index: item.index,
    });
    setHasResultPanel(false);
  };


  // DB에서 로고 목록 불러오기
  const loadLogosFromDb = async (projectId: number) => {
    try {
      const logoList = await getLogoList(projectId);
      // DB에서 가져온 데이터를 SavedItem 형식으로 변환
      // 오래된 것일수록 낮은 번호를 가지도록 역순으로 번호 매기기
      const dbLogos: SavedItem[] = logoList.map((item, index) => ({
        id: `db_${item.prod_id}`,
        url: item.file_url,
        type: "logo" as const,
        index: index,
        title: `로고 ${logoList.length - index}`, // 역순으로 번호 매기기
        createdAt: item.create_dt || new Date().toISOString(),
      }));
      // 상태 업데이트 - 이렇게 하면 isLogoSaved가 자동으로 재계산됨
      setSavedLogos(dbLogos);
    } catch (error) {
      console.error("로고 목록 로드 실패:", error);
      // 에러 발생 시 빈 배열로 설정
      setSavedLogos([]);
    }
  };

  // 이미지를 base64로 변환하는 함수
  const convertImageToBase64 = async (imageUrl: string): Promise<string> => {
    try {
      const response = await fetch(imageUrl);
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
      throw new Error("이미지를 변환하는데 실패했습니다.");
    }
  };

  // 보관함에 저장 핸들러
  const handleSaveToStorage = async () => {
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
      // 이미지를 base64로 변환
      const base64Image = await convertImageToBase64(selectedResult.url);
      
      // API 호출
      const response = await saveLogo({
        base64_image: base64Image,
        project_id: parseInt(currentProjectId),
        prod_type_id: 1,
      });

      toast({
        title: "저장 완료",
        description: response.message || "로고가 보관함에 저장되었습니다.",
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
        await loadLogosFromDb(parseInt(currentProjectId));
      }
    } catch (error: any) {
      console.error("로고 저장 실패:", error);
      toast({
        title: "저장 실패",
        description: error.message || "로고 저장에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 프로젝트에서 삭제 핸들러
  const handleDeleteFromStorage = async () => {
    if (!selectedResult || !currentProjectId) {
      return;
    }

    // savedLogos에서 현재 선택된 로고 찾기
    const savedLogo = savedLogos.find(
      item => item.url === selectedResult.url && item.type === selectedResult.type
    );

    if (!savedLogo) {
      toast({
        title: "삭제 실패",
        description: "저장된 로고를 찾을 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    // prod_id 추출 (id가 "db_123" 형식이므로 숫자 부분만 추출)
    const prodId = parseInt(savedLogo.id.replace('db_', ''));

    if (isNaN(prodId)) {
      toast({
        title: "삭제 실패",
        description: "유효하지 않은 로고 ID입니다.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      await deleteLogo(prodId);

      toast({
        title: "삭제 완료",
        description: "로고가 프로젝트에서 삭제되었습니다.",
      });
      
      // 삭제 성공 후 목록 새로고침
      if (currentProjectId) {
        await loadLogosFromDb(parseInt(currentProjectId));
      }
      
      // 미리보기에서 이미지 제거
      setSelectedResult(null);
      setHasResultPanel(false);
    } catch (error: any) {
      console.error("로고 삭제 실패:", error);
      toast({
        title: "삭제 실패",
        description: error.message || "로고 삭제에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
      setShowDeleteConfirm(false);
    }
  };

  // 현재 선택된 로고가 저장되어 있는지 확인
  const isLogoSaved = selectedResult ? savedLogos.some(
    item => item.url === selectedResult.url && item.type === selectedResult.type
  ) : false;

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
              AI와 함께 로고를 만들어보세요.
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
        studioType="logo"
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
                      <h2 className="text-lg font-semibold">로고 #{selectedResult.index + 1}</h2>
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
                      <div className="relative max-w-xs max-h-full group">
                        <img 
                          src={selectedResult.url} 
                          alt={`로고 ${selectedResult.index + 1}`}
                          className="w-full h-auto object-contain rounded-lg shadow-lg"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg pointer-events-none">
                          <div className="flex flex-col gap-2 justify-center items-center pointer-events-auto">
                            <Button 
                              size="sm" 
                              variant="secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                
                                // 로컬에 다운로드
                                const link = document.createElement('a');
                                link.href = selectedResult.url;
                                link.download = `logo_${Date.now()}.png`;
                                link.click();
                                
                                toast({
                                  title: "다운로드 시작",
                                  description: "로고를 로컬에 저장합니다.",
                                });
                              }}
                              className="bg-background/90 hover:bg-background"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              다운로드
                            </Button>
                            <Button 
                              size="sm" 
                              variant="secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isLogoSaved) {
                                  setShowDeleteConfirm(true);
                                } else {
                                  handleSaveToStorage();
                                }
                              }}
                              disabled={isSaving}
                              className="bg-background/90 hover:bg-background"
                            >
                              {isSaving ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  {isLogoSaved ? "삭제 중..." : "저장 중..."}
                                </>
                              ) : (
                                <>
                                  {isLogoSaved ? (
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
                      {activeStorageTab === "logos" && savedLogos.length > 0 && (
                        <div className="flex gap-3 justify-center pb-2">
                          {savedLogos.map((logo) => (
                            <div
                              key={logo.id}
                              onClick={() => handleSavedItemClick(logo)}
                              className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 cursor-pointer transition-all relative ${
                                selectedResult?.url === logo.url && selectedResult?.type === "logo"
                                  ? "shadow-md"
                                  : "border-border"
                              }`}
                              style={selectedResult?.url === logo.url && selectedResult?.type === "logo" ? { borderColor: '#7C22C8' } : {}}
                            >
                              <img
                                src={logo.url}
                                alt={logo.title}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-1 py-0.5 text-center truncate">
                                {logo.title}
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
                    variant={activeStorageTab === "logos" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleToggleStorageTab("logos")}
                    className={activeStorageTab === "logos" ? "text-white" : "hover:bg-[#7C22C8] hover:text-white hover:border-[#7C22C8]"}
                    style={activeStorageTab === "logos" ? { backgroundColor: '#7C22C8' } : {}}
                  >
                    {activeStorageTab === "logos" ? (
                      <FolderOpen className="h-4 w-4 mr-2" />
                    ) : (
                      <Folder className="h-4 w-4 mr-2" />
                    )}
                    로고 보관함
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
                                style={message.role === "user" ? { backgroundColor: '#7C22C8' } : undefined}
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
                                  const logoUrlMatch = message.content.match(/\[LOGO_URL\](.*?)\[\/LOGO_URL\]/);
                                  
                                  if (logoUrlMatch && message.role === "assistant") {
                                    const logoUrl = logoUrlMatch[1];
                                    const textContent = message.content
                                      .replace(/\[LOGO_URL\].*?\[\/LOGO_URL\]/g, '')
                                      .trim();
                                    
                                    return (
                                      <>
                                        {textContent && <p className="whitespace-pre-wrap break-words mb-2">{textContent}</p>}
                                        <div className="mt-1 bg-black/5 rounded-lg p-2">
                                          <div 
                                            className="relative w-48 mx-auto cursor-pointer hover:opacity-80 transition-opacity"
                                            onClick={() => {
                                              // 클릭 시 왼쪽 패널에서 보기
                                              setSelectedResult({
                                                type: "logo",
                                                url: logoUrl,
                                                index: savedLogos.length,
                                              });
                                              setHasResultPanel(false);
                                            }}
                                          >
                                            <img 
                                              src={logoUrl} 
                                              alt="Generated Logo"
                                              className="w-full h-auto rounded-md object-contain"
                                            />
                                          </div>
                                          <p className="text-center text-sm text-muted-foreground mt-2 mb-2">
                                          </p>
                                        </div>
                                      </>
                                    );
                                  }
                                  
                                  return <p className="whitespace-pre-wrap break-words">{message.content}</p>;
                                })()}                              
                              </Card>
                            </div>
                            {/* 로고가 생성된 경우에만 "내 프로젝트로 이동" 버튼 표시 */}
                            {(() => {
                              const logoUrlMatch = message.content.match(/\[LOGO_URL\](.*?)\[\/LOGO_URL\]/);
                              if (logoUrlMatch && message.role === "assistant" && currentProjectId) {
                                return (
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      navigate(`/project?project=${currentProjectId}`);
                                    }}
                                    className="text-sm text-white"
                                    style={{ backgroundColor: '#7C22C8' }}
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
                    {isLoadingLogoIntro && (
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
                    {isLoadingLogoChat && (
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
                      className="min-h-[40px] max-h-[40px] resize-none pr-12 pl-12 py-2 text-sm w-full focus-visible:ring-[#7C22C8]"
                      rows={1}
                      disabled={isLoadingLogoIntro || isLoadingLogoChat}
                    />
                    <Button
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      variant="ghost"
                      className="absolute bottom-1 left-2 h-8 w-8 p-0 bg-transparent border-0 hover:bg-transparent"
                      disabled={isLoadingLogoIntro || isLoadingLogoChat}
                    >
                      <Plus className="h-4 w-4" style={{ color: '#7C22C8' }} />
                    </Button>
                    <Button 
                      onClick={handleSendMessage} 
                      size="icon"
                      variant="ghost"
                      className="absolute bottom-1 right-1 h-8 w-8 hover:bg-transparent"
                      disabled={(!inputValue.trim() && attachedImages.length === 0) || isLoadingLogoIntro || isLoadingLogoChat}
                    >
                      {(isLoadingLogoIntro || isLoadingLogoChat) ? (
                        <RefreshCw className="h-4 w-4 animate-spin" style={{ color: '#7C22C8' }} />
                      ) : (
                        <Send className="h-4 w-4" style={{ color: '#7C22C8' }} />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>로고 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 로고를 프로젝트에서 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFromStorage}
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

export default LogoChatPage;

