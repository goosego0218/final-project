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
import { Send, Plus, Upload, Image, Video, X } from "lucide-react";
import { projectStorage, type Message } from "@/lib/projectStorage";
import { useToast } from "@/hooks/use-toast";
import StudioTopBar from "@/components/StudioTopBar";
import { sendBrandChat } from "@/lib/api";

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
  const [skipDialogStep, setSkipDialogStep] = useState<"confirm" | "project" | "type">("confirm"); // 다이얼로그 내부 단계
  const [showGenerateTypeDialog, setShowGenerateTypeDialog] = useState(false); // 로고/숏폼 선택 다이얼로그
  const [showLogoDialog, setShowLogoDialog] = useState(false);
  const [showUploadInDialog, setShowUploadInDialog] = useState(false); // 팝업 내 업로드 UI 표시 여부
  const [isSkippedFlow, setIsSkippedFlow] = useState(false); // 넘어가기 버튼 경로인지 구분
  const [showProjectConfirm, setShowProjectConfirm] = useState(false); // 프로젝트 생성 확인 단계
  const [isDraftMode, setIsDraftMode] = useState(false); // draft 모드 여부
  const [draftProjectInfo, setDraftProjectInfo] = useState<{ name: string; description: string } | null>(null); // draft 프로젝트 정보
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogFileInputRef = useRef<HTMLInputElement>(null);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [fromStyleMode, setFromStyleMode] = useState(false);
  const [baseAssetType, setBaseAssetType] = useState<"logo" | "shortform" | null>(null);
  const [baseAssetId, setBaseAssetId] = useState<string | null>(null);
  const [dbProjectId, setDbProjectId] = useState<number | null>(null); // DB 프로젝트 ID
  const [isLoadingChat, setIsLoadingChat] = useState(false); // 챗 로딩 상태


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
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // localStorage 변경 감지하여 사용자 정보 업데이트
  useEffect(() => {
    // 초기 로그인 상태 확인
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
    // localStorage/sessionStorage에서 직접 확인
    const currentLoggedIn = localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true';
    if (!currentLoggedIn) {
      navigate("/");
      return;
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userProfile');
    toast({
      title: "로그아웃되었습니다",
      description: "다음에 또 만나요!",
      status: "success",
    });
    navigate("/");
  };

  // 필수 항목이 모두 채워졌는지 확인
  const checkRequiredFieldsComplete = (info: BrandInfo): boolean => {
    // 필수 항목: brand_name, industry
    // 선택 항목이지만 모든 질문을 다 답했는지 확인하기 위해 preferred_colors까지 확인
    // preferred_colors까지 답했다면 모든 질문을 다 답한 것으로 간주
    return info.brand_name.trim() !== "" && 
           info.industry.trim() !== "" &&
           info.preferred_colors.length > 0; // 마지막 질문까지 답했는지 확인
  };

  // 메시지 히스토리에서 브랜드 정보 추출
  const extractInfoFromMessages = (messages: Message[]): BrandInfo => {
    const info: BrandInfo = {
      brand_name: "",
      industry: "",
      mood: "",
      core_keywords: [],
      target_age: "",
      target_gender: "",
      avoid_trends: [],
      slogan: "",
      preferred_colors: [],
    };
    
    // 각 user 메시지에 대해 바로 앞의 assistant 메시지를 찾아서 매칭
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      
      if (message.role === "user") {
        // 이전 assistant 메시지 찾기
        let questionType: string | null = null;
        for (let j = i - 1; j >= 0; j--) {
          if (messages[j].role === "assistant") {
            const assistantContent = messages[j].content;
            // 질문 타입 파악
            if (assistantContent.includes("브랜드명")) {
              questionType = "brand_name";
            } else if (assistantContent.includes("업종") || assistantContent.includes("카테고리")) {
              questionType = "industry";
            } else if (assistantContent.includes("분위기") || assistantContent.includes("무드")) {
              questionType = "mood";
            } else if (assistantContent.includes("핵심 키워드")) {
              questionType = "core_keywords";
            } else if (assistantContent.includes("연령대")) {
              questionType = "target_age";
            } else if (assistantContent.includes("성별")) {
              questionType = "target_gender";
            } else if (assistantContent.includes("피하고 싶은 트렌드")) {
              questionType = "avoid_trends";
            } else if (assistantContent.includes("슬로건") || assistantContent.includes("캐치프레이즈")) {
              questionType = "slogan";
            } else if (assistantContent.includes("선호하는 색상")) {
              questionType = "preferred_colors";
            }
            break; // 가장 가까운 assistant 메시지를 찾았으므로 중단
          }
        }
        
        if (questionType) {
          const answer = message.content.trim();
          
          if (questionType === "brand_name") {
            info.brand_name = answer;
          } else if (questionType === "industry") {
            info.industry = answer;
          } else if (questionType === "mood") {
            if (!answer.toLowerCase().includes("없음") && !answer.toLowerCase().includes("건너뛰기")) {
              info.mood = answer;
            }
          } else if (questionType === "core_keywords") {
            if (!answer.toLowerCase().includes("없음") && !answer.toLowerCase().includes("건너뛰기")) {
              info.core_keywords = answer.split(',').map(k => k.trim()).filter(k => k);
            }
          } else if (questionType === "target_age") {
            if (!answer.toLowerCase().includes("없음") && !answer.toLowerCase().includes("건너뛰기")) {
              info.target_age = answer;
            }
          } else if (questionType === "target_gender") {
            if (!answer.toLowerCase().includes("없음") && !answer.toLowerCase().includes("건너뛰기")) {
              info.target_gender = answer;
            }
          } else if (questionType === "avoid_trends") {
            if (!answer.toLowerCase().includes("없음") && !answer.toLowerCase().includes("건너뛰기")) {
              info.avoid_trends = answer.split(',').map(t => t.trim()).filter(t => t);
            }
          } else if (questionType === "slogan") {
            if (!answer.toLowerCase().includes("없음") && !answer.toLowerCase().includes("건너뛰기")) {
              info.slogan = answer;
            }
          } else if (questionType === "preferred_colors") {
            if (!answer.toLowerCase().includes("없음") && !answer.toLowerCase().includes("건너뛰기")) {
              info.preferred_colors = answer.split(',').map(c => c.trim()).filter(c => c);
            }
          }
        }
      }
    }
    
    return info;
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
  const handleGoToStudio = (projectId: string, type?: "logo" | "short", fromStyle?: boolean) => {
    if (!projectId) {
      toast({
        title: "오류",
        description: "프로젝트를 찾을 수 없습니다.",
        status: "error",
      });
      return;
    }

    const project = projectStorage.getProject(projectId);
    if (!project) {
      toast({
        title: "오류",
        description: "프로젝트를 찾을 수 없습니다.",
        status: "error",
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
    const typeParam = type ? `&type=${type}` : "";
    const fromStyleParam = fromStyle && baseAssetType && baseAssetId 
      ? `&from_style=true&baseAssetType=${baseAssetType}&baseAssetId=${baseAssetId}` 
      : "";
    toast({
      title: "스튜디오로 이동합니다",
      description: project.logo ? "업로드한 로고를 사용합니다." : "Studio에서 로고와 숏폼을 생성할 수 있습니다.",
      status: "success",
    });
    
    navigate(`/studio?project=${projectId}${typeParam}${fromStyleParam}`);
  };

  useEffect(() => {
    const isDraft = searchParams.get('draft') === 'true';
    const dbProjectIdParam = searchParams.get('db_project'); // DB 프로젝트 ID
    const projectId = searchParams.get('project') || projectStorage.getCurrentProjectId();
    const skipLogoUpload = searchParams.get('skipLogoUpload') === 'true';
    const fromStyle = searchParams.get('from_style') === 'true';
    const assetType = searchParams.get('baseAssetType') as "logo" | "shortform" | null;
    const assetId = searchParams.get('baseAssetId');
    
    // DB 프로젝트 ID가 있는 경우 (DB에서 가져온 프로젝트)
    if (dbProjectIdParam) {
      const dbId = parseInt(dbProjectIdParam);
      setDbProjectId(dbId);
      
      // 환영 메시지 추가
      if (messages.length === 0) {
        const welcomeMessage: Message = {
          role: "assistant",
          content: "안녕하세요! 브랜드 정보를 수집하기 위해 몇 가지 질문을 드리겠습니다.\n\n먼저 브랜드명을 알려주세요."
        };
        setMessages([welcomeMessage]);
        setCurrentQuestion("brand_name");
        setCurrentStep("collecting");
      }
      return;
    }
    
    // from_style 모드 설정
    if (fromStyle) {
      setFromStyleMode(true);
      setBaseAssetType(assetType || null);
      setBaseAssetId(assetId || null);
    }
    
    // draft 모드 처리
    if (isDraft) {
      setIsDraftMode(true);
      setIsSkippedFlow(skipLogoUpload);
      
      // draft 프로젝트 정보 불러오기
      const draftData = localStorage.getItem('makery_draft_project');
      if (draftData) {
        try {
          const draft = JSON.parse(draftData);
          setDraftProjectInfo({ name: draft.name, description: draft.description || "" });
        } catch (e) {
          console.error("Draft 프로젝트 정보 파싱 실패:", e);
        }
      }
      
      // 환영 메시지 추가
      if (messages.length === 0) {
        const welcomeMessage: Message = {
          role: "assistant",
          content: "안녕하세요! 브랜드 정보를 수집하기 위해 몇 가지 질문을 드리겠습니다.\n\n먼저 브랜드명을 알려주세요."
        };
        setMessages([welcomeMessage]);
        setCurrentQuestion("brand_name");
        setCurrentStep("collecting");
      }
      return;
    }
    
    // 기존 프로젝트가 있는 경우
    if (!projectId) {
      navigate("/projects");
      return;
    }
    setCurrentProjectId(projectId);
    setIsDraftMode(false);
    
    const project = projectStorage.getProject(projectId);
    
    // skipLogoUpload 플래그 설정
    if (skipLogoUpload) {
      setIsSkippedFlow(true);
    }
    
    if (project) {
      // system 메시지만 제외하고 나머지 메시지는 모두 표시
      const chatMessages = project.messages.filter(m => m.role !== "system");
      setMessages(chatMessages);
      
      // 이미 수집된 정보 복원 (systemMessage 우선, 없으면 메시지에서 추출)
      let restoredInfo: BrandInfo | null = null;
      const systemMessage = project.messages.find(m => m.role === "system");
      
      if (systemMessage) {
        try {
          restoredInfo = JSON.parse(systemMessage.content);
        } catch (e) {
          // 파싱 실패 시 무시
        }
      }
      
      // systemMessage가 없거나 불완전한 경우 메시지에서 추출
      const allMessages = project.messages.filter(m => m.role !== "system");
      const extractedInfo = extractInfoFromMessages(allMessages);
      
      if (!restoredInfo) {
        restoredInfo = extractedInfo;
      } else {
        // systemMessage가 있으면 병합
        restoredInfo = {
          brand_name: restoredInfo.brand_name || extractedInfo.brand_name,
          industry: restoredInfo.industry || extractedInfo.industry,
          mood: restoredInfo.mood || extractedInfo.mood,
          core_keywords: restoredInfo.core_keywords?.length > 0 ? restoredInfo.core_keywords : extractedInfo.core_keywords,
          target_age: restoredInfo.target_age || extractedInfo.target_age,
          target_gender: restoredInfo.target_gender || extractedInfo.target_gender,
          avoid_trends: restoredInfo.avoid_trends?.length > 0 ? restoredInfo.avoid_trends : extractedInfo.avoid_trends,
          slogan: restoredInfo.slogan || extractedInfo.slogan,
          preferred_colors: restoredInfo.preferred_colors?.length > 0 ? restoredInfo.preferred_colors : extractedInfo.preferred_colors,
        };
      }
      
      const finalRestoredInfo = restoredInfo || extractedInfo;
      
      if (finalRestoredInfo) {
        setCollectedInfo(finalRestoredInfo);
        
        const allRequiredComplete = checkRequiredFieldsComplete(finalRestoredInfo);
        
        if (allRequiredComplete) {
          setCurrentStep("complete");
        } else {
          const lastAssistantMessage = chatMessages.filter(m => m.role === "assistant").pop();
          
          if (lastAssistantMessage) {
            if (lastAssistantMessage.content.includes("브랜드명")) {
              setCurrentQuestion("brand_name");
            } else if (lastAssistantMessage.content.includes("업종") || lastAssistantMessage.content.includes("카테고리")) {
              setCurrentQuestion("industry");
            } else if (lastAssistantMessage.content.includes("분위기") || lastAssistantMessage.content.includes("무드")) {
              setCurrentQuestion("mood");
            } else if (lastAssistantMessage.content.includes("핵심 키워드")) {
              setCurrentQuestion("core_keywords");
            } else if (lastAssistantMessage.content.includes("연령대")) {
              setCurrentQuestion("target_age");
            } else if (lastAssistantMessage.content.includes("성별")) {
              setCurrentQuestion("target_gender");
            } else if (lastAssistantMessage.content.includes("피하고 싶은 트렌드")) {
              setCurrentQuestion("avoid_trends");
            } else if (lastAssistantMessage.content.includes("슬로건") || lastAssistantMessage.content.includes("캐치프레이즈")) {
              setCurrentQuestion("slogan");
            } else if (lastAssistantMessage.content.includes("선호하는 색상")) {
              setCurrentQuestion("preferred_colors");
            } else if (lastAssistantMessage.content.includes("로고")) {
              setCurrentStep("logoQuestion");
              setCurrentQuestion(null);
            } else {
              if (!finalRestoredInfo.brand_name) {
                setCurrentQuestion("brand_name");
              } else if (!finalRestoredInfo.industry) {
                setCurrentQuestion("industry");
              } else if (!finalRestoredInfo.mood && !finalRestoredInfo.core_keywords.length) {
                setCurrentQuestion("mood");
              } else if (!finalRestoredInfo.core_keywords.length && !finalRestoredInfo.target_age) {
                setCurrentQuestion("core_keywords");
              } else if (!finalRestoredInfo.target_age && !finalRestoredInfo.target_gender) {
                setCurrentQuestion("target_age");
              } else if (!finalRestoredInfo.target_gender && !finalRestoredInfo.avoid_trends.length) {
                setCurrentQuestion("target_gender");
              } else if (!finalRestoredInfo.avoid_trends.length && !finalRestoredInfo.slogan) {
                setCurrentQuestion("avoid_trends");
              } else if (!finalRestoredInfo.slogan && !finalRestoredInfo.preferred_colors.length) {
                setCurrentQuestion("slogan");
              } else if (!finalRestoredInfo.preferred_colors.length) {
                setCurrentQuestion("preferred_colors");
              }
            }
          } else {
            if (!finalRestoredInfo.brand_name) {
              setCurrentQuestion("brand_name");
            } else if (!finalRestoredInfo.industry) {
              setCurrentQuestion("industry");
            }
          }
          
          setCurrentStep("collecting");
        }
      }
      
      if (project.logo) {
        setUploadedLogo(project.logo.url);
        setHasLogo(true);
        setCurrentStep("complete");
      }
    }
  }, [navigate, searchParams, messages.length]);

  // 첫 진입 시 환영 메시지 추가 (이미 저장된 환영 메시지가 없을 때만)
  useEffect(() => {
    // draft 모드인 경우는 이미 위에서 처리됨
    if (isDraftMode) return;
    
    if (currentProjectId && messages.length === 0 && currentStep === "collecting") {
      const project = projectStorage.getProject(currentProjectId);
      if (project) {
        // 이미 환영 메시지가 저장되어 있는지 확인
        const hasWelcomeMessage = project.messages.some(m => 
          m.role === "assistant" && 
          m.content === "안녕하세요! 브랜드 정보를 수집하기 위해 몇 가지 질문을 드리겠습니다.\n\n먼저 브랜드명을 알려주세요."
        );
        
        if (!hasWelcomeMessage) {
          const welcomeMessage: Message = {
            role: "assistant",
            content: "안녕하세요! 브랜드 정보를 수집하기 위해 몇 가지 질문을 드리겠습니다.\n\n먼저 브랜드명을 알려주세요."
          };
          setMessages([welcomeMessage]);
          setCurrentQuestion("brand_name");
          projectStorage.addMessage(currentProjectId, welcomeMessage);
        }
      }
    }
  }, [currentProjectId, messages.length, currentStep, isDraftMode]);

  // 메시지 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 로고 생성하기 버튼이 나타날 때 스크롤
  useEffect(() => {
    const shouldScroll = collectedInfo.brand_name?.trim() !== "" && 
                         collectedInfo.industry?.trim() !== "" && 
                         (currentStep === "complete" || uploadedLogo !== null);
    
    if (shouldScroll) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [collectedInfo.brand_name, collectedInfo.industry, currentStep, uploadedLogo]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    
    // DB 프로젝트 모드가 아니고, draft 모드도 아닌 경우 currentProjectId 필요
    if (!dbProjectId && !isDraftMode && !currentProjectId) return;
    if (currentStep !== "collecting") return;
  
    const userMessage: Message = {
      role: "user",
      content: inputMessage
    };
  
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    
    // draft 모드가 아닌 경우에만 projectStorage에 저장
    if (!isDraftMode && currentProjectId) {
      projectStorage.addMessage(currentProjectId, userMessage);
    }
  
    // 🆕 DB 프로젝트 모드인 경우 백엔드 API 호출
    if (dbProjectId) {
      setIsLoadingChat(true);
      try {
        const response = await sendBrandChat({
          message: inputMessage,
          brand_session_id: dbProjectId.toString(),
        });
  
        // 백엔드 응답을 assistant 메시지로 추가
        const assistantMessage: Message = {
          role: "assistant",
          content: response.reply
        };
  
        setTimeout(() => {
          setMessages(prev => [...prev, assistantMessage]);
          
          // 브랜드 정보를 파싱하여 collectedInfo 업데이트
          // (백엔드가 structured output을 주면 여기서 파싱)
          // 현재는 단순히 메시지만 추가
          
        }, 500);
  
      } catch (error) {
        console.error('브랜드 챗 API 오류:', error);
        toast({
          title: "오류",
          description: error instanceof Error ? error.message : "메시지 전송에 실패했습니다.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingChat(false);
      }
      
      setInputMessage("");
      return;
    }
  
    // 🔽 기존 로컬 로직 (draft 모드나 기존 프로젝트용)
    let assistantResponse = "";
    let nextQuestion: string | null = null;
  
    const question = currentQuestion || "brand_name";
  
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
      assistantResponse = "브랜드 정보 입력이 완료되었습니다. 프로젝트를 생성하시겠습니까?";
      nextQuestion = null;
    }
  
    const assistantMessage: Message = {
      role: "assistant",
      content: assistantResponse
    };
  
    setTimeout(() => {
      setMessages([...newMessages, assistantMessage]);
      
      if (!isDraftMode && currentProjectId) {
        projectStorage.addMessage(currentProjectId, assistantMessage);
      }
      
      setCurrentQuestion(nextQuestion);
      
      if (nextQuestion === null && question === "preferred_colors") {
        if (!isDraftMode && currentProjectId) {
          const infoMessage: Message = {
            role: "system",
            content: JSON.stringify(collectedInfo)
          };
          projectStorage.addMessage(currentProjectId, infoMessage);
        }
        
        setCurrentStep("complete");
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
        status: "warning",
      });
      return;
    }
    setSkipDialogStep("confirm"); // 다이얼로그 열 때 초기 상태로 리셋
    setShowSkipDialog(true);
  };

  const handleSkipConfirm = () => {
    // 건너뛰기 팝업 흐름에서는 대화창 상태를 변경하지 않음
    // 오직 팝업 내부 단계만 변경
    setSkipDialogStep("project");
  };
  
  const handleProjectConfirmInDialog = () => {
    // draft 모드인 경우 실제 프로젝트 생성
    if (isDraftMode) {
      // 필수 항목 체크
      if (!collectedInfo.brand_name.trim() || !collectedInfo.industry.trim()) {
        toast({
          title: "필수 항목 미입력",
          description: "브랜드명과 업종은 필수 항목입니다.",
          variant: "destructive",
        });
        return;
      }
      
      // draft 프로젝트 정보로 실제 프로젝트 생성
      const projectName = draftProjectInfo?.name || "새 프로젝트";
      const projectDescription = draftProjectInfo?.description || "";
      const project = projectStorage.createProject(projectName, projectDescription);
      
      // 수집된 정보를 system 메시지로 저장
      const infoMessage: Message = {
        role: "system",
        content: JSON.stringify(collectedInfo)
      };
      projectStorage.addMessage(project.id, infoMessage);
      
      // 기존 메시지들을 프로젝트에 저장
      messages.forEach(msg => {
        if (msg.role !== "system") {
          projectStorage.addMessage(project.id, msg);
        }
      });
      
      // draft 정보 삭제
      localStorage.removeItem('makery_draft_project');
      
      // 프로젝트 ID 설정
      setCurrentProjectId(project.id);
      setIsDraftMode(false);
    } else if (!currentProjectId) {
      // draft 모드가 아니고 currentProjectId도 없으면 에러
      toast({
        title: "오류",
        description: "프로젝트를 찾을 수 없습니다.",
        status: "error",
      });
      return;
    }
    
    // 다이얼로그 내부 단계를 "type"으로 변경 (로고/숏폼 선택 단계)
    setSkipDialogStep("type");
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
        status: "warning",
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
        status: "error",
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
            status: "success",
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
            status: "success",
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
        status: "error",
      });
    };
    
    try {
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("FileReader 오류:", error);
      toast({
        title: "파일 읽기 오류",
        description: "파일을 읽는 중 오류가 발생했습니다.",
        status: "error",
      });
    }
    
    // 파일 입력 초기화 (같은 파일 다시 선택 가능하도록)
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleGenerateClick = (type: "logo" | "short") => {
    // 필수 필드 체크
    if (!collectedInfo.brand_name.trim() || !collectedInfo.industry.trim()) {
      toast({
        title: "필수 항목 미입력",
        description: "브랜드명과 업종은 필수 항목입니다.",
        status: "warning",
      });
      return;
    }

    if (!currentProjectId) {
      toast({
        title: "오류",
        description: "프로젝트를 찾을 수 없습니다.",
        status: "error",
      });
      return;
    }

    const project = projectStorage.getProject(currentProjectId);
    if (!project) {
      toast({
        title: "오류",
        description: "프로젝트를 찾을 수 없습니다.",
        status: "error",
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

    // 공통 함수로 Studio 이동 (type 지정, from_style 정보 전달)
    handleGoToStudio(currentProjectId, type, fromStyleMode);
  };

  // collectedInfo가 변경될 때마다 필수 항목 완료 여부 확인 및 상태 업데이트
  useEffect(() => {
    if (!currentProjectId) return;
    
    const allRequiredComplete = checkRequiredFieldsComplete(collectedInfo);
    
    // 모든 필수 항목이 채워졌으면 complete 단계로 전환
    if (allRequiredComplete && currentStep === "collecting") {
      setCurrentStep("complete");
    }
  }, [collectedInfo, currentProjectId, currentStep, searchParams]);

  const progress = calculateProgress();
  const canSkip = collectedInfo.brand_name?.trim() !== "" && collectedInfo.industry?.trim() !== "";
  const showLogoButtons = currentStep === "logoQuestion" && hasLogo === null;
  const canGenerate = canSkip && currentStep === "complete" && showProjectConfirm;
  const showProjectConfirmButton = canSkip && currentStep === "complete" && !showProjectConfirm;
  
  // 디버깅: canSkip 계산 확인
  console.log("canSkip 계산:", {
    brand_name: collectedInfo.brand_name,
    industry: collectedInfo.industry,
    canSkip: canSkip
  });

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
        userAvatar={userProfile.avatar}
        instagramConnected={userProfile.instagram}
        youtubeConnected={userProfile.youtube}
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
              건너뛰기
            </Button>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 container mx-auto px-4 py-4 flex flex-col max-w-4xl w-full min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 min-h-0 scrollbar-hide">
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
              <div
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
            </div>
          ))}
          
          {showProjectConfirmButton && (
            <div className="mt-4 flex justify-center">
              <Button 
                size="lg" 
                onClick={() => {
                  // draft 모드인 경우 실제 프로젝트 생성
                  if (isDraftMode) {
                    // 필수 항목 체크
                    if (!collectedInfo.brand_name.trim() || !collectedInfo.industry.trim()) {
                      toast({
                        title: "필수 항목 미입력",
                        description: "브랜드명과 업종은 필수 항목입니다.",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    // draft 프로젝트 정보로 실제 프로젝트 생성
                    const projectName = draftProjectInfo?.name || "새 프로젝트";
                    const projectDescription = draftProjectInfo?.description || "";
                    const project = projectStorage.createProject(projectName, projectDescription);
                    
                    // 수집된 정보를 system 메시지로 저장
                    const infoMessage: Message = {
                      role: "system",
                      content: JSON.stringify(collectedInfo)
                    };
                    projectStorage.addMessage(project.id, infoMessage);
                    
                    // 기존 메시지들을 프로젝트에 저장
                    messages.forEach(msg => {
                      if (msg.role !== "system") {
                        projectStorage.addMessage(project.id, msg);
                      }
                    });
                    
                    // draft 정보 삭제
                    localStorage.removeItem('makery_draft_project');
                    
                    // 프로젝트 ID 설정
                    setCurrentProjectId(project.id);
                    setIsDraftMode(false);
                    
                    // 질문을 메시지로 추가
                    const confirmQuestion: Message = {
                      role: "assistant",
                      content: "어떤 작업을 하시겠습니까?"
                    };
                    setMessages(prev => [...prev, confirmQuestion]);
                    projectStorage.addMessage(project.id, confirmQuestion);
                    
                    // 바로 showProjectConfirm을 true로 설정하여 로고/숏폼 생성 버튼 표시
                    setShowProjectConfirm(true);
                    
                    // ChatPage에 머물러서 로고/숏폼 생성 버튼을 보여줌 (대시보드로 이동하지 않음)
                    return;
                  }
                  
                  // 기존 프로젝트가 있는 경우
                  if (!currentProjectId) return;
                  // 질문을 메시지로 추가
                  const confirmQuestion: Message = {
                    role: "assistant",
                    content: "어떤 작업을 하시겠습니까까?"
                  };
                  setMessages(prev => [...prev, confirmQuestion]);
                  projectStorage.addMessage(currentProjectId, confirmQuestion);
                  // 바로 showProjectConfirm을 true로 설정하여 로고/숏폼 생성 버튼 표시
                  setShowProjectConfirm(true);
                }} 
                className="gap-2 bg-primary hover:bg-primary/90"
              >
                생성하기
              </Button>
            </div>
          )}
          
          {canGenerate && (
            <div className="mt-4 flex justify-center gap-3">
              <Button size="lg" onClick={() => handleGenerateClick("logo")} className="gap-2 text-white" style={{ backgroundColor: '#7C22C8' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#6B1DB5'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#7C22C8'}>
                <Image className="h-4 w-4" />
                로고 생성하기
              </Button>
              <Button size="lg" onClick={() => handleGenerateClick("short")} className="gap-2 bg-primary hover:bg-primary/90">
                <Video className="h-4 w-4" />
                숏폼 생성하기
              </Button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input - Studio style */}
        <div className="flex-shrink-0 relative mt-4 mb-4">
          <Textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="메시지를 입력하세요..."
            className="min-h-[40px] max-h-[40px] resize-none pr-12 pl-4 py-2 text-sm w-full"
            disabled={currentStep === "complete" || showLogoButtons || isLoadingChat}
            rows={1}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || currentStep === "complete" || showLogoButtons}
            size="icon"
            variant="ghost"
            className="absolute bottom-1 right-1 h-8 w-8 hover:bg-transparent"
          >
            <Send className="h-4 w-4 text-primary" />
          </Button>
        </div>
      </div>

      {/* Skip Confirmation Dialog */}
      <AlertDialog open={showSkipDialog} onOpenChange={(open) => {
        // 오버레이 클릭 시 모달만 닫기
        if (!open) {
          setShowSkipDialog(false);
          setSkipDialogStep("confirm"); // 다이얼로그 닫을 때 초기 상태로 리셋
        }
      }}>
        <AlertDialogContent
          onOverlayClick={() => {
            setShowSkipDialog(false);
            setSkipDialogStep("confirm");
          }}
        >
          {/* X 버튼 */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 h-6 w-6 rounded-sm opacity-70 ring-offset-background transition-opacity hover:bg-transparent hover:opacity-100 hover:text-foreground focus:outline-none focus:ring-0 z-10"
            onClick={() => {
              setShowSkipDialog(false);
              setSkipDialogStep("confirm");
            }}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
          {skipDialogStep === "confirm" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>입력하지 않은 항목이 있을 수 있습니다</AlertDialogTitle>
                <AlertDialogDescription>
                  지금까지 입력한 내용만 저장하고 다음 단계로 넘어갈까요?
                  이 단계에서는 더 이상 수정할 수 없습니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>아니요, 계속 작성할게요</AlertDialogCancel>
                <Button 
                  onClick={(e) => {
                    e.preventDefault();
                    handleSkipConfirm();
                  }}
                  className="bg-primary hover:bg-primary/90"
                >
                  네, 넘어갈게요
                </Button>
              </AlertDialogFooter>
            </>
          )}
          
          {skipDialogStep === "project" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>지금까지 입력한 내용으로 새 프로젝트를 생성하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                  아직 입력하지 않은 항목이 있어도, 지금까지 작성한 정보만으로 프로젝트를 저장하고 다음 단계로 넘어갑니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSkipDialog(false);
                    setSkipDialogStep("confirm");
                  }}
                  className="hover:bg-transparent hover:border-border hover:text-foreground"
                >
                  취소
                </Button>
                <Button 
                  onClick={(e) => {
                    e.preventDefault();
                    handleProjectConfirmInDialog();
                  }}
                  className="bg-primary hover:bg-primary/90"
                >
                  생성하기
                </Button>
              </AlertDialogFooter>
            </>
          )}
          
          {skipDialogStep === "type" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>어떤 작업을 하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                  방금 생성한 프로젝트에서 바로 시작할 작업을 선택해 주세요.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  onClick={() => {
                    if (!currentProjectId) {
                      toast({
                        title: "오류",
                        description: "프로젝트를 찾을 수 없습니다.",
                        variant: "destructive",
                      });
                      return;
                    }
                    setShowSkipDialog(false);
                    setSkipDialogStep("confirm");
                    handleGoToStudio(currentProjectId, "logo");
                  }}
                  className="flex-1 border border-neutral-300 dark:border-neutral-700 text-white group transition-all"
                  style={{ backgroundColor: '#7C22C8' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#6B1DB5'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#7C22C8'; }}
                >
                  <Image className="h-4 w-4 mr-2 stroke-white transition-all" />
                  로고 생성하기
                </Button>
                <Button
                  onClick={() => {
                    if (!currentProjectId) {
                      toast({
                        title: "오류",
                        description: "프로젝트를 찾을 수 없습니다.",
                        variant: "destructive",
                      });
                      return;
                    }
                    setShowSkipDialog(false);
                    setSkipDialogStep("confirm");
                    handleGoToStudio(currentProjectId, "short");
                  }}
                  className="flex-1 border border-neutral-300 dark:border-neutral-700 text-white group transition-all"
                  style={{ backgroundColor: '#FF8A3D' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E8792E'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FF8A3D'; }}
                >
                  <Video className="h-4 w-4 mr-2 stroke-white transition-all" />
                  숏폼 생성하기
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* Generate Type Selection Dialog */}
      <AlertDialog open={showGenerateTypeDialog} onOpenChange={setShowGenerateTypeDialog}>
        <AlertDialogContent
          onOverlayClick={() => setShowGenerateTypeDialog(false)}
        >
          {/* X 버튼 */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 h-6 w-6 rounded-sm opacity-70 ring-offset-background transition-opacity hover:bg-transparent hover:opacity-100 hover:text-foreground focus:outline-none focus:ring-0 z-10"
            onClick={() => setShowGenerateTypeDialog(false)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
          <AlertDialogHeader>
            <AlertDialogTitle>생성할 항목을 선택해주세요</AlertDialogTitle>
            <AlertDialogDescription>
              로고 또는 숏폼 중 원하는 항목을 선택해주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              onClick={() => {
                setShowGenerateTypeDialog(false);
                if (currentProjectId) {
                  handleGoToStudio(currentProjectId, "logo");
                }
              }}
              className="flex-1 text-white gap-2"
              style={{ backgroundColor: '#7C22C8' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#6B1DB5'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#7C22C8'}
            >
              <Image className="h-4 w-4" />
              로고 생성하기
            </Button>
            <Button
              onClick={() => {
                setShowGenerateTypeDialog(false);
                if (currentProjectId) {
                  handleGoToStudio(currentProjectId, "short");
                }
              }}
              className="flex-1 bg-primary hover:bg-primary/90 gap-2"
            >
              <Video className="h-4 w-4" />
              숏폼 생성하기
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default ChatPage;
