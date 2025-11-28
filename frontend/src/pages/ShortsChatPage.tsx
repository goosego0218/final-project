// ShortsChatPage.tsx는 StudioPage.tsx의 숏폼 관련 부분만 추출한 파일입니다.
// StudioPage.tsx가 매우 크므로 (3437줄), 핵심 로직만 추출하여 새 파일을 생성합니다.
// 이 파일은 StudioPage.tsx의 숏폼 관련 로직을 기반으로 작성되었습니다.

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Send, ChevronLeft, RefreshCw, Star, Plus, X, FolderOpen, Trash2, Video, Loader2, Upload } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { projectStorage, type Message, type SavedItem } from "@/lib/projectStorage";
import StudioTopBar from "@/components/StudioTopBar";
import { getShortsIntro, sendShortsChat, getProjectDetail, getShortsList } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ThemeToggle from "@/components/ThemeToggle";
import { saveShorts } from "@/lib/api";
import { Save } from "lucide-react";

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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<SavedItem | null>(null);
  
  // 저장된 숏폼 추적
  const [savedShorts, setSavedShorts] = useState<SavedItem[]>([]);
  const [activeStorageTab, setActiveStorageTab] = useState<"shorts" | null>(null);
  
  const [isChatLoaded, setIsChatLoaded] = useState(false);
  const [isLoadingShortsIntro, setIsLoadingShortsIntro] = useState(false);
  const [hasCalledShortsIntro, setHasCalledShortsIntro] = useState(false);
  const [shortsSessionId, setShortsSessionId] = useState<string | null>(null);
  const [isLoadingShortsChat, setIsLoadingShortsChat] = useState(false);
  const introCalledRef = useRef(false); // 중복 호출 방지용 ref
  const [isSaving, setIsSaving] = useState(false);

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
        instagram: profile.instagram?.connected || false,
        youtube: profile.youtube?.connected || false,
        tokensUsed: 132,
        tokensTotal: 200,
      };
    }
    return {
      name: "사용자",
      email: "user@example.com",
      avatar: null,
      instagram: false,
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

  const handleSave = (url: string, type: "short", index: number) => {
    if (!currentProjectId) return;
    
    const item: SavedItem = {
      id: `${type}_${Date.now()}_${index}`,
      url,
      type,
      index,
      title: `숏폼 ${savedShorts.length + 1}`,
      createdAt: new Date().toISOString(),
    };

    const project = projectStorage.getProject(currentProjectId);
    if (project) {
      const existingInProject = project.savedItems?.some(saved => saved.url === url && saved.type === "short");
      if (existingInProject) {
        toast({
          title: "이미 저장된 숏폼입니다",
          description: "이 숏폼은 이미 저장되어 있습니다.",
        });
        return;
      }
    }
    
    setSavedShorts(prev => {
      if (prev.some(saved => saved.url === url)) {
        toast({
          title: "이미 저장된 숏폼입니다",
          description: "이 숏폼은 이미 저장되어 있습니다.",
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
        title: "숏폼이 저장되었습니다",
        description: "보관함에 저장되었습니다.",
      });
      return updated;
    });
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

  const handleDelete = () => {
    if (!itemToDelete || !currentProjectId) return;

    const project = projectStorage.getProject(currentProjectId);
    if (!project) return;

    const updatedSavedItems = (project.savedItems || []).filter(
      item => item.id !== itemToDelete.id
    );
    project.savedItems = updatedSavedItems;
    projectStorage.saveProject(project);

    setSavedShorts(prev => prev.filter(item => item.id !== itemToDelete.id));

    if (selectedResult && selectedResult.url === itemToDelete.url) {
      setSelectedResult(null);
      setHasResultPanel(false);
    }

    toast({
      title: "숏폼이 삭제되었습니다",
      description: "저장된 항목에서 제거되었습니다.",
    });

    setIsDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const handleDeleteClick = () => {
    if (!selectedResult || !currentProjectId) return;

    const foundItem = savedShorts.find(
      item => item.url === selectedResult.url && item.type === selectedResult.type
    );

    if (foundItem) {
      setItemToDelete(foundItem);
      setIsDeleteDialogOpen(true);
    } else {
      toast({
        title: "저장된 항목이 아닙니다",
        description: "저장된 항목만 삭제할 수 있습니다.",
        variant: "destructive",
      });
    }
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
        description: response.message || "쇼츠가 보관함에 저장되었습니다.",
      });
      
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
        instagramConnected={userProfile.instagram}
        youtubeConnected={userProfile.youtube}
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
                          variant="default"
                          size="sm"
                          onClick={handleSaveToStorage}
                          disabled={isSaving}
                          className="bg-primary hover:bg-primary/90"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              저장 중...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              보관함에 저장
                            </>
                          )}
                        </Button>
                        {savedShorts.some(
                          item => item.url === selectedResult.url && item.type === selectedResult.type
                        ) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDeleteClick}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
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
                                
                                // 로컬에 다운로드
                                const link = document.createElement('a');
                                link.href = selectedResult.url;
                                link.download = `shorts_${Date.now()}.mp4`;
                                link.click();
                                
                                toast({
                                  title: "다운로드 시작",
                                  description: "쇼츠 영상을 로컬에 저장합니다.",
                                });
                              }}
                              className="bg-background/90 hover:bg-background"
                            >
                              <Star className="h-4 w-4 mr-2" />
                              다운로드
                            </Button>
                            <Button 
                              size="sm" 
                              variant="secondary"
                              className="bg-background/90 hover:bg-background"
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              업로드
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
                
                <div className="flex justify-center gap-2 pb-6">
                  <Button
                    variant={activeStorageTab === "shorts" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleToggleStorageTab("shorts")}
                    className={activeStorageTab === "shorts" ? "bg-primary hover:bg-primary/90 text-primary-foreground" : ""}
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    숏폼 보관함
                  </Button>
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
                          <div className={`flex items-end gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
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

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>삭제하시겠습니까?</DialogTitle>
            <DialogDescription>
              숏폼을 삭제하면 저장된 항목에서 제거됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="hover:bg-transparent hover:border-border hover:text-foreground">
              취소
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShortsChatPage;

