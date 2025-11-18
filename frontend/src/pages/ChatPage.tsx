import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Send, Plus, Upload } from "lucide-react";
import { projectStorage, type Message } from "@/lib/projectStorage";
import { useToast } from "@/hooks/use-toast";
import StudioTopBar from "@/components/StudioTopBar";

type InfoStep = "collecting" | "logoQuestion" | "complete";

interface BrandInfo {
  brand_name: string;
  industry: string;
  mood: string;
  core_keywords: string[];
  target_age: string;
  target_gender: string;
  avoid_trends: string[];
  slogan: string;
  preferred_colors: string[];
}

const ChatPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<InfoStep>("collecting");
  const [collectedInfo, setCollectedInfo] = useState<BrandInfo>({
    brand_name: "",
    industry: "",
    mood: "",
    core_keywords: [],
    target_age: "",
    target_gender: "",
    avoid_trends: [],
    slogan: "",
    preferred_colors: [],
  });
  const [hasLogo, setHasLogo] = useState<boolean | null>(null);
  const [uploadedLogo, setUploadedLogo] = useState<string | null>(null);
  const [showSkipDialog, setShowSkipDialog] = useState(false);
  const [showLogoDialog, setShowLogoDialog] = useState(false);
  const [showUploadInDialog, setShowUploadInDialog] = useState(false); // 팝업 내 업로드 UI 표시 여부
  const [isSkippedFlow, setIsSkippedFlow] = useState(false); // 넘어가기 버튼 경로인지 구분
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogFileInputRef = useRef<HTMLInputElement>(null);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('isLoggedIn') === 'true');

  // localStorage 변경 감지하여 사용자 정보 업데이트
  useEffect(() => {
    const handleStorageChange = () => {
      setUserProfile(getUserProfile());
      setIsLoggedIn(localStorage.getItem('isLoggedIn') === 'true');
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

  // 로그인 상태 확인
  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/");
    }
  }, [isLoggedIn, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    toast({
      title: "로그아웃되었습니다",
      description: "다음에 또 만나요!",
    });
    navigate("/");
  };

  // 프로그레스 계산
  const calculateProgress = () => {
    const fields = [
      collectedInfo.brand_name,
      collectedInfo.industry,
      collectedInfo.mood,
      collectedInfo.core_keywords.length > 0 ? "filled" : "",
      collectedInfo.target_age,
      collectedInfo.target_gender,
      collectedInfo.avoid_trends.length > 0 ? "filled" : "",
      collectedInfo.slogan,
      collectedInfo.preferred_colors.length > 0 ? "filled" : "",
    ];
    const answeredCount = fields.filter((f) => f && f.trim() !== "").length;
    return {
      answered: answeredCount,
      total: 9,
      percentage: (answeredCount / 9) * 100,
    };
  };

  // 공통 Studio 이동 함수
  const handleGoToStudio = (projectId: string) => {
    if (!projectId) {
      toast({
        title: "오류",
        description: "프로젝트를 찾을 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    const project = projectStorage.getProject(projectId);
    if (!project) {
      toast({
        title: "오류",
        description: "프로젝트를 찾을 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    // 브랜드 정보 저장 (아직 저장되지 않은 경우)
    const infoMessage: Message = {
      role: "system",
      content: JSON.stringify(collectedInfo)
    };
    projectStorage.addMessage(projectId, infoMessage);

    // Studio로 이동
    toast({
      title: "스튜디오로 이동합니다",
      description: project.logo ? "업로드한 로고를 사용합니다." : "Studio에서 로고를 생성할 수 있습니다.",
    });
    
    navigate(`/studio?project=${projectId}`);
  };

  useEffect(() => {
    const projectId = searchParams.get('project') || projectStorage.getCurrentProjectId();
    if (!projectId) {
      navigate("/projects");
      return;
    }
    setCurrentProjectId(projectId);
    
    const project = projectStorage.getProject(projectId);
    const skipLogoUpload = searchParams.get('skipLogoUpload') === 'true';
    
    if (project) {
      const chatMessages = project.messages.filter(m => m.role !== "system" && m.role !== "assistant" || m.content !== "안녕하세요! 브랜드 정보를 수집하기 위해 몇 가지 질문을 드리겠습니다.\n\n먼저 브랜드명을 알려주세요.");
      setMessages(chatMessages);
      
      // 이미 수집된 정보가 있으면 복원
      const systemMessage = project.messages.find(m => m.role === "system");
      if (systemMessage) {
        try {
          const info = JSON.parse(systemMessage.content);
          setCollectedInfo(info);
          if (info.brand_name && info.industry) {
            // skipLogoUpload가 true면 로고 질문 단계를 건너뛰고 바로 Studio로
            if (skipLogoUpload) {
              // 브랜드 정보 저장 후 바로 Studio로 이동
              handleGoToStudio(projectId);
              return;
            }
            setCurrentStep("logoQuestion");
            setCurrentQuestion(null);
          }
        } catch (e) {
          // 파싱 실패 시 무시
        }
      }
      
      // 프로젝트에 로고가 있으면 복원
      if (project.logo) {
        setUploadedLogo(project.logo.url);
        setHasLogo(true);
        setCurrentStep("complete");
      }
    }
  }, [navigate, searchParams]);

  // 첫 진입 시 환영 메시지 추가
  useEffect(() => {
    if (currentProjectId && messages.length === 0 && currentStep === "collecting" && !currentQuestion) {
      const welcomeMessage: Message = {
        role: "assistant",
        content: "안녕하세요! 브랜드 정보를 수집하기 위해 몇 가지 질문을 드리겠습니다.\n\n먼저 브랜드명을 알려주세요."
      };
      setMessages([welcomeMessage]);
      setCurrentQuestion("brand_name");
      projectStorage.addMessage(currentProjectId, welcomeMessage);
    }
  }, [currentProjectId, messages.length, currentStep, currentQuestion]);

  // 메시지 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputMessage.trim() || !currentProjectId) return;
    if (currentStep !== "collecting") return;

    const userMessage: Message = {
      role: "user",
      content: inputMessage
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    projectStorage.addMessage(currentProjectId, userMessage);

    let assistantResponse = "";
    let nextQuestion: string | null = null;

    // 현재 질문이 없으면 첫 질문으로 처리
    const question = currentQuestion || "brand_name";

    // 현재 질문에 따라 정보 수집
    if (question === "brand_name") {
      setCollectedInfo(prev => ({ ...prev, brand_name: inputMessage }));
      assistantResponse = "좋습니다! 어떤 업종이나 카테고리인가요? (예: 베이커리, 카페, IT 등)";
      nextQuestion = "industry";
    } else if (question === "industry") {
      setCollectedInfo(prev => ({ ...prev, industry: inputMessage }));
      assistantResponse = "브랜드의 분위기나 무드를 알려주세요. (선택사항, 건너뛰려면 '없음' 또는 '건너뛰기'라고 입력해주세요)";
      nextQuestion = "mood";
    } else if (question === "mood") {
      if (!inputMessage.toLowerCase().includes("없음") && !inputMessage.toLowerCase().includes("건너뛰기")) {
        setCollectedInfo(prev => ({ ...prev, mood: inputMessage }));
      }
      assistantResponse = "핵심 키워드를 알려주세요. (예: 친근함, 프리미엄, 혁신 등, 쉼표로 구분, 선택사항, 건너뛰려면 '없음' 입력)";
      nextQuestion = "core_keywords";
    } else if (question === "core_keywords") {
      if (!inputMessage.toLowerCase().includes("없음") && !inputMessage.toLowerCase().includes("건너뛰기")) {
        const keywords = inputMessage.split(',').map(k => k.trim()).filter(k => k);
        setCollectedInfo(prev => ({ ...prev, core_keywords: keywords }));
      }
      assistantResponse = "타겟 연령대를 알려주세요. (예: 20-30대, 30-40대 등, 선택사항, 건너뛰려면 '없음' 입력)";
      nextQuestion = "target_age";
    } else if (question === "target_age") {
      if (!inputMessage.toLowerCase().includes("없음") && !inputMessage.toLowerCase().includes("건너뛰기")) {
        setCollectedInfo(prev => ({ ...prev, target_age: inputMessage }));
      }
      assistantResponse = "타겟 성별을 알려주세요. (예: 남성, 여성, 무관 등, 선택사항, 건너뛰려면 '없음' 입력)";
      nextQuestion = "target_gender";
    } else if (question === "target_gender") {
      if (!inputMessage.toLowerCase().includes("없음") && !inputMessage.toLowerCase().includes("건너뛰기")) {
        setCollectedInfo(prev => ({ ...prev, target_gender: inputMessage }));
      }
      assistantResponse = "피하고 싶은 트렌드나 스타일이 있나요? (예: 과도한 장식, 어두운 색상 등, 쉼표로 구분, 선택사항, 건너뛰려면 '없음' 입력)";
      nextQuestion = "avoid_trends";
    } else if (question === "avoid_trends") {
      if (!inputMessage.toLowerCase().includes("없음") && !inputMessage.toLowerCase().includes("건너뛰기")) {
        const trends = inputMessage.split(',').map(t => t.trim()).filter(t => t);
        setCollectedInfo(prev => ({ ...prev, avoid_trends: trends }));
      }
      assistantResponse = "슬로건이나 캐치프레이즈가 있나요? (선택사항, 건너뛰려면 '없음' 입력)";
      nextQuestion = "slogan";
    } else if (question === "slogan") {
      if (!inputMessage.toLowerCase().includes("없음") && !inputMessage.toLowerCase().includes("건너뛰기")) {
        setCollectedInfo(prev => ({ ...prev, slogan: inputMessage }));
      }
      assistantResponse = "선호하는 색상을 알려주세요. (예: 빨강, 파랑, 주황 등, 쉼표로 구분, 선택사항, 건너뛰려면 '없음' 입력)";
      nextQuestion = "preferred_colors";
    } else if (question === "preferred_colors") {
      if (!inputMessage.toLowerCase().includes("없음") && !inputMessage.toLowerCase().includes("건너뛰기")) {
        const colors = inputMessage.split(',').map(c => c.trim()).filter(c => c);
        setCollectedInfo(prev => ({ ...prev, preferred_colors: colors }));
      }
      // 모든 질문 완료
      const skipLogoUpload = searchParams.get('skipLogoUpload') === 'true';
      if (skipLogoUpload) {
        // 로고 업로드 단계 제외 - 바로 Studio로 이동
        assistantResponse = "브랜드 정보 입력이 완료되었습니다. Studio로 이동합니다.";
        nextQuestion = null;
        // 브랜드 정보 저장 후 Studio로 이동하는 로직은 setTimeout에서 처리
      } else {
        // 채팅 흐름으로 온 경우 - 로고 질문 단계로
        assistantResponse = "브랜드 정보 입력이 거의 끝났어요. 혹시 기존에 사용 중인 로고가 있으신가요?";
        nextQuestion = null;
        setCurrentStep("logoQuestion");
        setIsSkippedFlow(false); // 채팅 흐름으로 온 경우
      }
    }

    const assistantMessage: Message = {
      role: "assistant",
      content: assistantResponse
    };

    setTimeout(() => {
      setMessages([...newMessages, assistantMessage]);
      projectStorage.addMessage(currentProjectId, assistantMessage);
      setCurrentQuestion(nextQuestion);
      
      // 모든 질문이 끝났을 때 처리
      if (nextQuestion === null && question === "preferred_colors") {
        const skipLogoUpload = searchParams.get('skipLogoUpload') === 'true';
        if (skipLogoUpload) {
          // 로고 업로드 단계 제외 - 브랜드 정보 저장 후 바로 Studio로 이동
          const infoMessage: Message = {
            role: "system",
            content: JSON.stringify(collectedInfo)
          };
          projectStorage.addMessage(currentProjectId, infoMessage);
          
          // Studio로 이동
          setTimeout(() => {
            handleGoToStudio(currentProjectId);
          }, 1000);
        } else {
          // 채팅 흐름으로 온 경우 - 로고 질문 단계로
          setCurrentStep("logoQuestion");
          setIsSkippedFlow(false);
        }
      }
    }, 500);

    setInputMessage("");
  };

  const handleSkipClick = () => {
    // 필수 필드 체크
    if (!collectedInfo.brand_name.trim() || !collectedInfo.industry.trim()) {
      toast({
        title: "필수 항목 미입력",
        description: "브랜드명과 업종은 필수 항목입니다.",
        variant: "destructive",
      });
      return;
    }
    setShowSkipDialog(true);
  };

  const handleSkipConfirm = () => {
    if (!currentProjectId) return;

    // 정보 저장
    const infoMessage: Message = {
      role: "system",
      content: JSON.stringify(collectedInfo)
    };
    projectStorage.addMessage(currentProjectId, infoMessage);

    // 넘어가기 버튼 경로로 표시
    setIsSkippedFlow(true);
    setShowSkipDialog(false);
    
    // 채팅창에 메시지 추가하지 않고 바로 로고 선택 팝업 표시
    setShowLogoDialog(true);
  };

  const handleLogoQuestion = (hasLogoFile: boolean, fromDialog: boolean = false) => {
    if (!currentProjectId) return;

    if (hasLogoFile) {
      // 기존 로고 업로드하기
      if (fromDialog) {
        // 팝업 내에서 업로드 UI 표시
        setShowUploadInDialog(true);
      } else {
        // 채팅 흐름에서 온 경우
        const userMessage: Message = {
          role: "user",
          content: "기존 로고 업로드하기"
        };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        projectStorage.addMessage(currentProjectId, userMessage);

        setCurrentStep("logoQuestion");
        setHasLogo(true); // + 버튼이 보이도록 설정
        const assistantMessage: Message = {
          role: "assistant",
          content: "좋습니다! 아래 + 버튼을 눌러 로고 파일을 업로드해주세요."
        };
        setTimeout(() => {
          setMessages(prev => [...prev, assistantMessage]);
          projectStorage.addMessage(currentProjectId, assistantMessage);
        }, 500);
      }
    } else {
      // 새 로고 만들기 - 바로 Studio로 이동
      if (fromDialog) {
        setShowLogoDialog(false);
      } else {
        const userMessage: Message = {
          role: "user",
          content: "새 로고 만들기"
        };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        projectStorage.addMessage(currentProjectId, userMessage);
      }

      // 브랜드 정보 저장
      const infoMessage: Message = {
        role: "system",
        content: JSON.stringify(collectedInfo)
      };
      projectStorage.addMessage(currentProjectId, infoMessage);

      // Studio로 이동
      navigate(`/studio?project=${currentProjectId}`);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, fromDialog: boolean = false) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      console.log("파일이 선택되지 않았습니다.");
      return;
    }

    const file = files[0];
    console.log("선택된 파일:", file.name, file.type, "fromDialog:", fromDialog);
    
    // 파일 타입 체크
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    const isValidType = file.type.startsWith('image/') && validTypes.some(type => file.type === type);
    
    if (!isValidType) {
      toast({
        title: "지원하지 않는 파일 형식",
        description: "PNG, JPG, SVG 이미지 파일만 업로드할 수 있습니다.",
        variant: "destructive",
      });
      // 파일 입력 초기화
      if (e.target) {
        e.target.value = '';
      }
      return;
    }

    if (!currentProjectId) {
      toast({
        title: "오류",
        description: "프로젝트를 찾을 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const logoUrl = event.target.result as string;
        console.log("로고 URL 생성 완료, 프로젝트에 저장 중...");
        
        // 프로젝트에 로고 저장
        const project = projectStorage.getProject(currentProjectId);
        if (!project) {
          console.error("프로젝트를 찾을 수 없습니다:", currentProjectId);
          return;
        }

        project.logo = {
          url: logoUrl,
          uploadedAt: new Date().toISOString()
        };
        projectStorage.saveProject(project);
        console.log("프로젝트에 로고 저장 완료");

        if (fromDialog) {
          // 팝업에서 업로드한 경우: 채팅창에 메시지 추가하지 않고 바로 Studio로 이동
          console.log("다이얼로그에서 업로드, Studio로 이동");
          setShowLogoDialog(false);
          setShowUploadInDialog(false);
          
          toast({
            title: "로고가 업로드되었습니다",
            description: "Studio로 이동합니다.",
          });
          
          // 공통 함수로 Studio 이동
          setTimeout(() => {
            handleGoToStudio(currentProjectId);
          }, 300);
        } else {
          // 채팅 흐름에서 업로드한 경우: 채팅창에 표시
          console.log("채팅에서 업로드, complete 단계로 이동");
          setUploadedLogo(logoUrl); // 채팅창에 표시하기 위해 상태 업데이트
          setCurrentStep("complete");
          setHasLogo(false); // 로고 업로드 완료
          
          toast({
            title: "로고가 저장되었습니다",
            description: "프로젝트에 로고가 저장되었습니다.",
          });
        }
      } else {
        console.error("파일 읽기 결과가 없습니다.");
      }
    };
    
    reader.onerror = (error) => {
      console.error("파일 읽기 오류:", error);
      toast({
        title: "파일 읽기 오류",
        description: "파일을 읽는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    };
    
    try {
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("FileReader 오류:", error);
      toast({
        title: "파일 읽기 오류",
        description: "파일을 읽는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
    
    // 파일 입력 초기화 (같은 파일 다시 선택 가능하도록)
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleGenerateClick = () => {
    // 필수 필드 체크
    if (!collectedInfo.brand_name.trim() || !collectedInfo.industry.trim()) {
      toast({
        title: "필수 항목 미입력",
        description: "브랜드명과 업종은 필수 항목입니다.",
        variant: "destructive",
      });
      return;
    }

    if (!currentProjectId) {
      toast({
        title: "오류",
        description: "프로젝트를 찾을 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    const project = projectStorage.getProject(currentProjectId);
    if (!project) {
      toast({
        title: "오류",
        description: "프로젝트를 찾을 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    // 로고가 업로드된 경우 프로젝트에 저장 (이미 저장되어 있을 수 있음)
    if (uploadedLogo && !project.logo) {
      project.logo = {
        url: uploadedLogo,
        uploadedAt: new Date().toISOString()
      };
      projectStorage.saveProject(project);
    }

    // 공통 함수로 Studio 이동
    handleGoToStudio(currentProjectId);
  };

  const progress = calculateProgress();
  const canSkip = collectedInfo.brand_name.trim() !== "" && collectedInfo.industry.trim() !== "";
  const showLogoButtons = currentStep === "logoQuestion" && hasLogo === null;
  const canGenerate = collectedInfo.brand_name.trim() !== "" && 
                      collectedInfo.industry.trim() !== "" && 
                      (currentStep === "complete" || uploadedLogo !== null);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <StudioTopBar
        onBack={() => navigate("/projects")}
        onNavigate={(path) => navigate(path)}
        onLogout={handleLogout}
        userName={userProfile.name}
        userEmail={userProfile.email}
        tokensUsed={userProfile.tokensUsed}
        tokensTotal={userProfile.tokensTotal}
      />

      {/* Top Bar: Left empty, Center progress, Right skip button */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm flex-shrink-0">
        <div className="w-full px-12 py-4 flex items-center justify-between">
          {/* Left: Empty */}
          <div className="w-24"></div>
          
          {/* Center: Progress Bar */}
          <div className="flex-1 flex items-center gap-4 max-w-md mx-auto">
            <div className="flex-1">
              <Progress value={progress.percentage} className="h-2" />
            </div>
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              {progress.answered} / {progress.total} 항목 작성됨
            </div>
          </div>
          
          {/* Right: Skip Button */}
          <div className="w-24 flex justify-end">
            <Button
              onClick={handleSkipClick}
              disabled={!canSkip}
              variant={canSkip ? "default" : "ghost"}
              className={canSkip ? "bg-primary hover:bg-primary/90" : ""}
            >
              넘어가기
            </Button>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 container mx-auto px-4 py-4 flex flex-col max-w-4xl w-full min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 min-h-0">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <Card
                className={`max-w-[80%] p-4 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </Card>
            </div>
          ))}
          
          {showLogoButtons && !isSkippedFlow && (
            <div className="flex justify-start">
              <Card className="max-w-[80%] p-4 bg-muted">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleLogoQuestion(true, false)}
                    className="flex-1"
                  >
                    기존 로고 업로드하기
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleLogoQuestion(false, false)}
                    className="flex-1"
                  >
                    새 로고 만들기
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* 채팅 흐름에서 업로드한 로고만 표시 (팝업에서 업로드한 것은 표시하지 않음) */}
          {uploadedLogo && currentStep === "complete" && !isSkippedFlow && (
            <div className="flex justify-start">
              <Card className="max-w-[80%] p-4 bg-muted">
                <p className="mb-2">업로드된 로고:</p>
                <img 
                  src={uploadedLogo} 
                  alt="업로드된 로고" 
                  className="max-w-full max-h-48 rounded object-contain"
                />
              </Card>
            </div>
          )}

          {canGenerate && (
            <div className="mt-4 flex justify-center">
              <Button size="lg" onClick={handleGenerateClick} className="gap-2 bg-primary hover:bg-primary/90">
                로고 생성하기
              </Button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input - Studio style */}
        <div className="flex-shrink-0 relative mt-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleLogoUpload}
            accept="image/png,image/jpeg,image/jpg,image/svg+xml"
            className="hidden"
          />
          <Textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={
              currentStep === "logoQuestion" && hasLogo === true
                ? "로고 파일을 업로드해주세요..."
                : "메시지를 입력하세요..."
            }
            className="min-h-[80px] resize-none pr-12 pl-12 text-sm w-full"
            disabled={currentStep === "complete" || showLogoButtons}
          />
          {(currentStep === "logoQuestion" && hasLogo === true) || currentStep === "collecting" ? (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-2 left-2 h-8 w-8 p-0 bg-transparent border-0 hover:bg-transparent"
            >
              <Plus className="h-4 w-4 text-primary" />
            </Button>
          ) : null}
          <Button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || currentStep === "complete" || showLogoButtons}
            size="icon"
            variant="ghost"
            className="absolute bottom-2 right-2 h-8 w-8 hover:bg-transparent"
          >
            <Send className="h-4 w-4 text-primary" />
          </Button>
        </div>
      </div>

      {/* Skip Confirmation Dialog */}
      <AlertDialog open={showSkipDialog} onOpenChange={setShowSkipDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>입력하지 않은 항목이 있을 수 있습니다</AlertDialogTitle>
            <AlertDialogDescription>
              지금까지 입력한 내용만 저장하고 다음 단계로 넘어갈까요?
              이 단계에서는 더 이상 수정할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>아니요, 계속 작성할게요</AlertDialogCancel>
            <AlertDialogAction onClick={handleSkipConfirm} className="bg-primary hover:bg-primary/90">
              네, 넘어갈게요
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Logo Selection Dialog (for skipped flow) */}
      <Dialog open={showLogoDialog} onOpenChange={setShowLogoDialog}>
        <DialogContent>
          {!showUploadInDialog ? (
            <>
              <DialogHeader>
                <DialogTitle>로고를 어떻게 가져올까요?</DialogTitle>
                <DialogDescription>
                  기존 로고를 업로드하거나, Studio에서 새 로고를 만들어보세요.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleLogoQuestion(true, true)}
                  className="flex-1"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  기존 로고 업로드하기
                </Button>
                <Button
                  onClick={() => handleLogoQuestion(false, true)}
                  className="flex-1 bg-primary hover:bg-primary/90"
                >
                  새 로고 만들기
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>로고 파일 업로드</DialogTitle>
                <DialogDescription>
                  PNG, SVG 등 이미지 파일을 업로드해주세요.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <input
                  type="file"
                  ref={dialogFileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleLogoUpload(e, true);
                    }
                  }}
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                  className="hidden"
                />
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-4">
                    이미지 파일을 선택하거나 드래그하여 업로드하세요
                  </p>
                  <Button
                    onClick={() => {
                      if (dialogFileInputRef.current) {
                        dialogFileInputRef.current.click();
                      } else {
                        toast({
                          title: "오류",
                          description: "파일 입력을 찾을 수 없습니다.",
                          variant: "destructive",
                        });
                      }
                    }}
                    variant="outline"
                  >
                    파일 선택
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowUploadInDialog(false);
                  }}
                >
                  뒤로
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatPage;
