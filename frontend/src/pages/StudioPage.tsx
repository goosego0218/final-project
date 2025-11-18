import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Send, Zap, ChevronLeft, ChevronRight, Download, RefreshCw, Star, MoreVertical, User, FolderOpen, CreditCard, Heart } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { projectStorage, type Message } from "@/lib/projectStorage";

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

  const dummyUser = {
    name: "홍길동",
    tokensUsed: 132,
    tokensTotal: 200,
  };

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
  }, [isLoggedIn, navigate, searchParams]);

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    toast({
      title: "로그아웃되었습니다",
      description: "다음에 또 만나요!",
    });
    navigate("/");
  };

  const getUserInitials = () => {
    return dummyUser.name.charAt(0);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputValue.trim() || !currentProjectId) return;

    // 첫 메시지 전송 시 온보딩 숨김
    if (!hasStartedChat) {
      setHasStartedChat(true);
    }

    const userMessage: Message = { role: "user", content: inputValue };
    setMessages(prev => [...prev, userMessage]);
    
    // 프로젝트에 메시지 저장
    projectStorage.addMessage(currentProjectId, userMessage);
    
    setInputValue("");

    // 더미 AI 응답
    setTimeout(() => {
      const hasLogo = inputValue.toLowerCase().includes("로고");
      const hasShort = inputValue.toLowerCase().includes("숏폼");
      
      if (hasLogo || hasShort) {
        // 생성물이 있는 응답 (로고는 4개, 숏폼은 2개)
        const imageCount = hasShort ? 2 : 4;
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
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
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-xl flex-shrink-0">
        <div className="w-full px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/projects")}
              className="h-9 w-9"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Link to="/" className="text-2xl font-bold tracking-tight text-foreground hover:opacity-80 transition-opacity">
              MAKERY
            </Link>
          </div>
          
          <div className="flex items-center gap-3">
            <ThemeToggle />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {/* User Info */}
                <div className="px-2 py-3 flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{dummyUser.name}</p>
                    <p className="text-xs text-muted-foreground">user@example.com</p>
                  </div>
                </div>
                
                <DropdownMenuSeparator />
                
                {/* Token Usage */}
                <div className="px-2 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">토큰 사용량</span>
                    <span className="text-xs font-semibold text-foreground">
                      {dummyUser.tokensUsed} / {dummyUser.tokensTotal}
                    </span>
                  </div>
                  <Progress 
                    value={(dummyUser.tokensUsed / dummyUser.tokensTotal) * 100} 
                    className="h-1.5"
                  />
                </div>
                
                <DropdownMenuSeparator />
                
                {/* Menu Items */}
                <DropdownMenuItem onClick={() => navigate("/projects")}>
                  <FolderOpen className="h-4 w-4 mr-2" />
                  내 프로젝트
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/plans")}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  플랜 관리
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/mypage")}>
                  <Heart className="h-4 w-4 mr-2" />
                  마이페이지
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/account")}>
                  <User className="h-4 w-4 mr-2" />
                  내 프로필
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={handleLogout}>
                  로그아웃
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

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
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      뒤로
                    </Button>
                  </div>
                  <div className="flex-1 flex items-center justify-center p-8 bg-muted/20 overflow-auto">
                    {selectedResult.type === "short" ? (
                      <div className="max-h-full aspect-[9/16]">
                        <img 
                          src={selectedResult.url} 
                          alt={`숏폼 ${selectedResult.index + 1}`}
                          className="w-full h-full object-cover rounded-lg shadow-lg"
                        />
                      </div>
                    ) : (
                      <img 
                        src={selectedResult.url} 
                        alt={`로고 ${selectedResult.index + 1}`}
                        className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                      />
                    )}
                  </div>
                  <div className="p-4 border-t border-border flex gap-2 justify-center">
                    <Button size="sm" variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      다운로드
                    </Button>
                    <Button size="sm" variant="outline">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      재생성
                    </Button>
                    <Button size="sm" variant="outline">
                      <Star className="h-4 w-4 mr-2" />
                      저장
                    </Button>
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
                        {[1, 2, 3, 4].map((item) => (
                          <Card key={item} className="p-4">
                            <div className="aspect-square bg-muted rounded-lg mb-3 flex items-center justify-center">
                              <span className="text-muted-foreground">로고 {item}</span>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="flex-1">
                                <Download className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="outline" className="flex-1">
                                <RefreshCw className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="outline" className="flex-1">
                                <Star className="h-3 w-3" />
                              </Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="shorts" className="flex-1 overflow-y-auto p-4 mt-0">
                      <div className="grid grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map((item) => (
                          <Card key={item} className="p-4">
                            <div className="aspect-[9/16] bg-muted rounded-lg mb-3 flex items-center justify-center">
                              <span className="text-muted-foreground">숏폼 {item}</span>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="flex-1">
                                <Download className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="outline" className="flex-1">
                                <RefreshCw className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="outline" className="flex-1">
                                <Star className="h-3 w-3" />
                              </Button>
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
              <div className="h-full flex flex-col rounded-2xl bg-[#E8E8E8] border border-[#CCCCCC] shadow-lg overflow-hidden">
              {/* Messages container */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-3">
                  {/* Onboarding Message */}
                  {!hasStartedChat && (
                    <div className="mb-6">
                      <p className="text-xs text-gray-500 mb-3">Nov 16, 2025</p>
                      <div className="bg-[#E8E8E8] border border-[#CCCCCC] rounded-lg p-4 text-sm text-black leading-relaxed">
                        <p>안녕하세요! MAKERY에 오신 것을 환영합니다.</p>
                      </div>
                    </div>
                  )}

                  {/* Chat Messages */}
                  {messages.map((message, index) => (
                    <div key={index} className="space-y-1">
                      <div
                        className={`rounded-lg p-3 text-sm leading-relaxed bg-[#E8E8E8] border border-[#CCCCCC] text-black ${
                          message.role === "user"
                            ? "ml-auto max-w-[85%]"
                            : "max-w-[85%]"
                        }`}
                      >
                        {message.content}
                        
                        {/* Show image thumbnails in chat */}
                        {message.images && message.images.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 mt-3">
                            {message.images.map((img, imgIndex) => {
                              const isShort = message.content.includes("숏폼");
                              return (
                                <button
                                  key={imgIndex}
                                  onClick={() => setSelectedResult({
                                    type: isShort ? "short" : "logo",
                                    url: img,
                                    index: imgIndex
                                  })}
                                  className={`${isShort ? "aspect-[9/16]" : "aspect-square"} rounded-md overflow-hidden border border-border hover:border-primary transition-colors cursor-pointer`}
                                >
                                  <img 
                                    src={img} 
                                    alt={`생성물 ${imgIndex + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input Area */}
              <div className="flex-shrink-0 p-4">
                <div className="relative">
                  <Textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="브랜드명과 업종을 알려주세요"
                    className="min-h-[80px] resize-none pr-12 text-sm bg-[#E8E8E8] border-[#CCCCCC] text-black placeholder:text-gray-500 focus:ring-0 focus:border-[#CCCCCC] focus:bg-[#E8E8E8] focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <Button 
                    onClick={handleSendMessage} 
                    size="icon"
                    variant="ghost"
                    className="absolute bottom-2 right-2 h-8 w-8 hover:bg-transparent"
                    disabled={!inputValue.trim()}
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
    </div>
  );
};

export default StudioPage;
