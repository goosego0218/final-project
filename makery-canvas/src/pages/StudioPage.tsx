import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Send, Zap, ChevronLeft, ChevronRight, Download, RefreshCw, Star, Plus, Upload, X } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { projectStorage, type Message, type Project } from "@/lib/projectStorage";
import StudioTopBar from "@/components/StudioTopBar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles } from "lucide-react";

interface SelectedResult {
  type: "logo" | "short";
  url: string;
  index: number;
}

const StudioPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [isLoggedIn] = useState(() => localStorage.getItem('isLoggedIn') === 'true');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [hasResultPanel, setHasResultPanel] = useState(false);
  const [hasStartedChat, setHasStartedChat] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SelectedResult | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [pendingUploadUrl, setPendingUploadUrl] = useState<string | null>(null);
  const [isCreateNewModalOpen, setIsCreateNewModalOpen] = useState(false);
  const [isProjectSelectModalOpen, setIsProjectSelectModalOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);

  // localStorage에서 사용자 정보 가져오기
  const getUserProfile = () => {
    const stored = localStorage.getItem('userProfile');
    if (stored) {
      const profile = JSON.parse(stored);
      // 기존 name 필드를 nickname으로 마이그레이션
      if (profile.name && !profile.nickname) {
        profile.nickname = profile.name;
        delete profile.name;
      }
      // 기존 email 필드를 id로 마이그레이션
      if (profile.email && !profile.id) {
        profile.id = profile.email;
        delete profile.email;
      }
      return {
        name: profile.nickname || "사용자",
        email: profile.id || "user@example.com",
        tokensUsed: 132,
        tokensTotal: 200,
      };
    }
    return {
      name: "사용자",
      email: "user@example.com",
      tokensUsed: 132,
      tokensTotal: 200,
    };
  };

  const [userProfile, setUserProfile] = useState(getUserProfile());

  // localStorage 변경 감지하여 사용자 정보 업데이트
  useEffect(() => {
    const handleStorageChange = () => {
      setUserProfile(getUserProfile());
    };
    
    const handleProfileUpdate = () => {
      setUserProfile(getUserProfile());
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('profileUpdated', handleProfileUpdate);
    // 같은 탭에서의 변경도 감지하기 위해 interval 사용
    const interval = setInterval(handleStorageChange, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('profileUpdated', handleProfileUpdate);
      clearInterval(interval);
    };
  }, []);

  // 프로젝트 로드
  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/");
      return;
    }

    const projectId = searchParams.get('project');
    if (projectId) {
      const project = projectStorage.getProject(projectId);
      if (project) {
        setCurrentProjectId(projectId);
        setMessages(project.messages);
        setHasStartedChat(project.messages.length > 0);
        projectStorage.setCurrentProject(projectId);
      }
    }

    // 프로젝트 리스트 로드
    setProjects(projectStorage.getProjects());
  }, [isLoggedIn, navigate, searchParams]);

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
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

  const handleSendMessage = () => {
    if ((!inputValue.trim() && attachedImages.length === 0) || !currentProjectId) return;

    // 첫 메시지 전송 시 온보딩 숨김
    if (!hasStartedChat) {
      setHasStartedChat(true);
    }

    const userMessage: Message = { 
      role: "user", 
      content: inputValue || (attachedImages.length > 0 ? "(이미지 첨부)" : ""),
      images: attachedImages.length > 0 ? attachedImages : undefined
    };
    setMessages(prev => [...prev, userMessage]);
    
    // 프로젝트에 메시지 저장
    projectStorage.addMessage(currentProjectId, userMessage);
    
    const currentInput = inputValue;
    const currentImages = attachedImages;
    setInputValue("");
    setAttachedImages([]);

    // 더미 AI 응답
    setTimeout(() => {
      const hasLogo = currentInput.toLowerCase().includes("로고");
      const hasShort = currentInput.toLowerCase().includes("숏폼");
      
      if (hasLogo || hasShort) {
        // 생성물이 있는 응답 (로고는 2개, 숏폼은 1개)
        const imageCount = hasShort ? 1 : 2;
        const dummyImages = Array(imageCount).fill(0).map((_, i) => 
          `https://images.unsplash.com/photo-1634942537034-2531766767d1?w=400&h=400&fit=crop&crop=center&q=80&sig=${i}`
        );
        
        const aiMessage: Message = { 
          role: "assistant", 
          content: `${hasLogo ? "로고" : "숏폼"} 시안 ${imageCount}개를 생성했습니다. 원하시는 것을 클릭하면 크게 볼 수 있어요!`,
          images: dummyImages
        };
        setMessages(prev => [...prev, aiMessage]);
        
        // 프로젝트에 AI 메시지 저장
        projectStorage.addMessage(currentProjectId, aiMessage);
      } else {
        const aiMessage: Message = { 
          role: "assistant", 
          content: "무엇을 도와드릴까요? '로고' 또는 '숏폼'을 포함해서 요청해주세요." 
        };
        setMessages(prev => [...prev, aiMessage]);
        
        // 프로젝트에 AI 메시지 저장
        projectStorage.addMessage(currentProjectId, aiMessage);
      }
    }, 500);
  };

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

  // 소셜 미디어 연동 상태 확인
  const checkSocialMediaConnection = () => {
    const stored = localStorage.getItem('userProfile');
    if (stored) {
      const profile = JSON.parse(stored);
      return {
        instagram: profile.instagram?.connected || false,
        youtube: profile.youtube?.connected || false
      };
    }
    return { instagram: false, youtube: false };
  };

  // 숏폼 업로드 버튼 클릭 핸들러
  const handleShortFormUpload = (url: string) => {
    const connections = checkSocialMediaConnection();
    const hasConnection = connections.instagram || connections.youtube;

    if (hasConnection) {
      // 연동된 경우 확인 다이얼로그 표시
      setPendingUploadUrl(url);
      setIsUploadDialogOpen(true);
    } else {
      // 연동 안된 경우 알림 표시
      toast({
        title: "소셜 미디어 연동 필요",
        description: "숏폼을 업로드하려면 먼저 소셜 미디어 계정을 연동해주세요.",
        variant: "destructive",
      });
    }
  };

  // 업로드 확인 다이얼로그에서 업로드 실행
  const handleConfirmUpload = () => {
    if (pendingUploadUrl) {
      // 실제 업로드 로직 (여기서는 더미)
      toast({
        title: "업로드 완료",
        description: "숏폼이 성공적으로 업로드되었습니다.",
      });
      setIsUploadDialogOpen(false);
      setPendingUploadUrl(null);
    }
  };

  // "이 스타일로 새로운 작품 만들기" 버튼 클릭 핸들러
  const handleCreateNewFromLogo = () => {
    setIsCreateNewModalOpen(true);
  };

  // "내가 하던 프로젝트에서 계속하기" 선택
  const handleContinueExistingProject = () => {
    setIsCreateNewModalOpen(false);
    setIsProjectSelectModalOpen(true);
    setProjects(projectStorage.getProjects());
  };

  // 프로젝트 선택 및 Studio로 이동
  const handleSelectProject = (projectId: string) => {
    setIsProjectSelectModalOpen(false);
    navigate(`/studio?project=${projectId}`);
  };

  // "새 프로젝트로 시작하기" 선택
  const handleStartNewProject = () => {
    setIsCreateNewModalOpen(false);
    // 새 프로젝트 생성
    const newProject = projectStorage.createProject("새 프로젝트", "");
    // ChatPage로 이동 (로고 업로드 단계 제외 플래그)
    navigate(`/chat?project=${newProject.id}&skipLogoUpload=true`);
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col">
        {/* Header */}
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

        {/* Login Required Message */}
        <div className="flex-1 flex items-center justify-center">
          <Card className="p-12 text-center max-w-md">
            <h2 className="text-2xl font-bold mb-4">로그인 후 이용할 수 있는 기능입니다.</h2>
            <p className="text-muted-foreground mb-6">
              AI와 함께 로고와 숏폼을 만들어보세요.
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
        onBack={() => navigate("/projects")}
        onNavigate={(path) => navigate(path)}
        onLogout={handleLogout}
        userName={userProfile.name}
        userEmail={userProfile.email}
        tokensUsed={userProfile.tokensUsed}
        tokensTotal={userProfile.tokensTotal}
      />

      {/* Main Content - Flipped: Canvas Left, Chat Right */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Main Canvas - Results Display */}
          <ResizablePanel defaultSize={70} minSize={60} maxSize={85}>
            <div className="h-full flex flex-col bg-background">
              {!hasResultPanel && !selectedResult ? (
                // Empty State - 완전히 비어있음
                <div className="flex-1" />
              ) : selectedResult ? (
                // Single Selected Result View
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
                    <h2 className="text-lg font-semibold">
                      {selectedResult.type === "logo" ? "로고" : "숏폼"} #{selectedResult.index + 1}
                    </h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedResult(null)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex-1 flex items-center justify-center p-8 bg-muted/20 overflow-auto">
                    {selectedResult.type === "short" ? (
                      <div className="max-h-full aspect-[9/16] relative group">
                        <img 
                          src={selectedResult.url} 
                          alt={`숏폼 ${selectedResult.index + 1}`}
                          className="w-full h-full object-cover rounded-lg shadow-lg"
                        />
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                          <div className="flex flex-wrap gap-2 justify-center items-center">
                            <Button 
                              size="sm" 
                              variant="secondary"
                              onClick={() => handleShortFormUpload(selectedResult.url)}
                              className="bg-background/90 hover:bg-background"
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              업로드
                            </Button>
                            <Button 
                              size="sm" 
                              variant="secondary"
                              className="bg-background/90 hover:bg-background"
                            >
                              <Star className="h-4 w-4 mr-2" />
                              저장
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="relative group max-w-full max-h-full">
                        <img 
                          src={selectedResult.url} 
                          alt={`로고 ${selectedResult.index + 1}`}
                          className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                        />
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                          <div className="flex flex-wrap gap-2 justify-center items-center">
                            <Button 
                              size="sm" 
                              variant="secondary"
                              className="bg-background/90 hover:bg-background"
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              재생성
                            </Button>
                            <Button 
                              size="sm" 
                              variant="secondary"
                              className="bg-background/90 hover:bg-background"
                            >
                              <Star className="h-4 w-4 mr-2" />
                              저장
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // Results Grid View
                <>
                  {/* Results Header */}
                  <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
                    <h2 className="text-lg font-semibold">결과</h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setHasResultPanel(false)}
                    >
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      결과 닫기
                    </Button>
                  </div>

                  {/* Tabs */}
                  <Tabs defaultValue="logos" className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="mx-4 mt-4 flex-shrink-0">
                      <TabsTrigger value="logos">로고</TabsTrigger>
                      <TabsTrigger value="shorts">숏폼</TabsTrigger>
                      <TabsTrigger value="others">기타</TabsTrigger>
                    </TabsList>

                    <TabsContent value="logos" className="flex-1 overflow-y-auto p-4 mt-0">
                      <div className="grid grid-cols-2 gap-4">
                        {[1, 2].map((item) => (
                          <Card key={item} className="p-0 overflow-hidden group">
                            <div className="aspect-square bg-muted rounded-t-lg flex items-center justify-center relative">
                              <span className="text-muted-foreground">로고 {item}</span>
                              {/* Hover Overlay */}
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <div className="flex flex-wrap gap-2 justify-center items-center">
                                  <Button 
                                    size="sm" 
                                    variant="secondary"
                                    className="bg-background/90 hover:bg-background"
                                  >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    재생성
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="secondary"
                                    className="bg-background/90 hover:bg-background"
                                  >
                                    <Star className="h-4 w-4 mr-2" />
                                    저장
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="shorts" className="flex-1 overflow-y-auto p-4 mt-0">
                      <div className="grid grid-cols-1 gap-4">
                        {[1].map((item) => (
                          <Card key={item} className="p-0 overflow-hidden group">
                            <div className="aspect-[9/16] bg-muted rounded-t-lg flex items-center justify-center relative">
                              <span className="text-muted-foreground">숏폼 {item}</span>
                              {/* Hover Overlay */}
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <div className="flex flex-wrap gap-2 justify-center items-center">
                                  <Button 
                                    size="sm" 
                                    variant="secondary"
                                    className="bg-background/90 hover:bg-background"
                                    onClick={() => {
                                      const dummyUrl = `https://images.unsplash.com/photo-1634942537034-2531766767d1?w=400&h=400&fit=crop&crop=center&q=80&sig=${item}`;
                                      handleShortFormUpload(dummyUrl);
                                    }}
                                  >
                                    <Upload className="h-4 w-4 mr-2" />
                                    업로드
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="secondary"
                                    className="bg-background/90 hover:bg-background"
                                  >
                                    <Star className="h-4 w-4 mr-2" />
                                    저장
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="others" className="flex-1 overflow-y-auto p-4 mt-0">
                      <div className="text-center text-muted-foreground py-12">
                        아직 생성된 결과가 없습니다.
                      </div>
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle className="w-1 bg-transparent hover:bg-transparent" withHandle />

          {/* Right Chat Panel */}
          <ResizablePanel defaultSize={30} minSize={15} maxSize={40}>
            <div className="h-full p-4">
              <div className="h-full flex flex-col rounded-2xl bg-studio-chat-panel border border-border shadow-lg overflow-hidden">
              {/* Messages container */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-3">
                  {/* Onboarding Message */}
                  {!hasStartedChat && (
                    <div className="mb-6">
                      <p className="text-xs text-muted-foreground mb-3">Nov 16, 2025</p>
                      <div className="flex justify-start">
                        <Card className="max-w-[80%] p-4 bg-muted">
                          <p className="whitespace-pre-wrap">안녕하세요! MAKERY에 오신 것을 환영합니다.</p>
                        </Card>
                      </div>
                    </div>
                  )}

                  {/* Chat Messages */}
                  {messages.map((message, index) => (
                    <div key={index} className="space-y-1">
                      <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                        <Card
                          className={`max-w-[80%] p-4 ${
                            message.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
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
                          <p className="whitespace-pre-wrap">{message.content}</p>
                          
                          {/* Show image thumbnails in chat (assistant messages) */}
                          {message.role === "assistant" && message.images && message.images.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 mt-3">
                              {message.images.map((img, imgIndex) => {
                                const isShort = message.content.includes("숏폼");
                                return (
                                  <div
                                    key={imgIndex}
                                    className={`${isShort ? "aspect-[9/16]" : "aspect-square"} rounded-md overflow-hidden border border-border relative group cursor-pointer`}
                                    onClick={() => setSelectedResult({
                                      type: isShort ? "short" : "logo",
                                      url: img,
                                      index: imgIndex
                                    })}
                                  >
                                    <img 
                                      src={img} 
                                      alt={`생성물 ${imgIndex + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                    {/* Hover Overlay */}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <div className="flex flex-wrap gap-2 justify-center items-center">
                                        {isShort ? (
                                          <>
                                            <Button 
                                              size="sm" 
                                              variant="secondary"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleShortFormUpload(img);
                                              }}
                                              className="bg-background/90 hover:bg-background"
                                            >
                                              <Upload className="h-4 w-4 mr-2" />
                                              업로드
                                            </Button>
                                            <Button 
                                              size="sm" 
                                              variant="secondary"
                                              onClick={(e) => e.stopPropagation()}
                                              className="bg-background/90 hover:bg-background"
                                            >
                                              <Star className="h-4 w-4 mr-2" />
                                              저장
                                            </Button>
                                          </>
                                        ) : (
                                          <>
                                            <Button 
                                              size="sm" 
                                              variant="secondary"
                                              onClick={(e) => e.stopPropagation()}
                                              className="bg-background/90 hover:bg-background"
                                            >
                                              <RefreshCw className="h-4 w-4 mr-2" />
                                              재생성
                                            </Button>
                                            <Button 
                                              size="sm" 
                                              variant="secondary"
                                              onClick={(e) => e.stopPropagation()}
                                              className="bg-background/90 hover:bg-background"
                                            >
                                              <Star className="h-4 w-4 mr-2" />
                                              저장
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </Card>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input Area */}
              <div className="flex-shrink-0 p-4">
                {attachedImages.length > 0 && (
                  <div className="mb-2 flex gap-2 flex-wrap">
                    {attachedImages.map((img, idx) => (
                      <div key={idx} className="relative">
                        <img src={img} alt={`첨부 ${idx + 1}`} className="w-16 h-16 object-cover rounded border" />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
                    placeholder="브랜드명과 업종을 알려주세요"
                    className="min-h-[80px] resize-none pr-12 text-sm w-full"
                  />
                  <Button
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    variant="ghost"
                    className="absolute bottom-2 left-2 h-8 w-8 p-0 bg-transparent border-0 hover:bg-transparent"
                  >
                    <Plus className="h-4 w-4 text-primary" />
                  </Button>
                  <Button 
                    onClick={handleSendMessage} 
                    size="icon"
                    variant="ghost"
                    className="absolute bottom-2 right-2 h-8 w-8 hover:bg-transparent"
                    disabled={!inputValue.trim() && attachedImages.length === 0}
                  >
                    <Send className="h-4 w-4 text-primary" />
                  </Button>
                </div>
              </div>
            </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* 업로드 확인 다이얼로그 */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>업로드 하시겠습니까?</DialogTitle>
            <DialogDescription>
              숏폼을 소셜 미디어에 업로드하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleConfirmUpload}>
              업로드 하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 새로운 작품 만들기 선택 모달 */}
      <Dialog open={isCreateNewModalOpen} onOpenChange={setIsCreateNewModalOpen}>
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
              className="w-full h-auto py-6"
            >
              <div className="flex flex-col items-start gap-1">
                <span className="font-semibold">내가 하던 프로젝트에서 계속하기</span>
                <span className="text-sm text-muted-foreground">기존 프로젝트를 선택하여 이어서 작업합니다</span>
              </div>
            </Button>
            <Button 
              onClick={handleStartNewProject}
              className="w-full h-auto py-6 bg-primary hover:bg-primary/90"
            >
              <div className="flex flex-col items-start gap-1">
                <span className="font-semibold">새 프로젝트로 시작하기</span>
                <span className="text-sm text-primary-foreground/80">새로운 프로젝트를 생성하여 시작합니다</span>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateNewModalOpen(false)}>
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 프로젝트 선택 모달 */}
      <Dialog open={isProjectSelectModalOpen} onOpenChange={setIsProjectSelectModalOpen}>
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
            <Button variant="outline" onClick={() => setIsProjectSelectModalOpen(false)}>
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudioPage;
