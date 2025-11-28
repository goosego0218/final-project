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
import { Send, Plus, Upload, Image, Video, X, Loader2  } from "lucide-react";
import { projectStorage, type Message } from "@/lib/projectStorage";
import { useToast } from "@/hooks/use-toast";
import StudioTopBar from "@/components/StudioTopBar";
import { sendBrandChat, createBrandProject, BrandInfo as ApiBrandInfo } from "@/lib/api";

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

// 프론트엔드에서 사용하는 통합 BrandInfo 타입 (백엔드와 로컬 모두 지원)
interface UnifiedBrandInfo {
  brand_name?: string;
  industry?: string;
  category?: string; // 백엔드 필드명
  mood?: string;
  tone_mood?: string; // 백엔드 필드명
  core_keywords?: string | string[];
  target_age?: string;
  target_gender?: string;
  avoid_trends?: string | string[];
  avoided_trends?: string; // 백엔드 필드명
  slogan?: string;
  preferred_colors?: string | string[];
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
  const [brandInfo, setBrandInfo] = useState<ApiBrandInfo | null>(null); // 백엔드에서 받은 brand_info
  const [brandSessionId, setBrandSessionId] = useState<string | null>(null); // brand_session_id 저장
  const [showCompleteBrandConfirmDialog, setShowCompleteBrandConfirmDialog] = useState(false); // 9개 필드 완성 시 브랜드 정보 확인 다이얼로그


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

  // 필수 항목이 모두 채워졌는지 확인 (건너뛰기용: brand_name과 category만)
  const checkRequiredFieldsComplete = (info: UnifiedBrandInfo): boolean => {
    // 필수 항목: brand_name, category만 확인
    const brandName = (info.brand_name || "").trim();
    const category = (info.industry || info.category || "").trim(); // 둘 다 체크
    return brandName !== "" && category !== "";
  };

  // 모든 필드가 채워졌는지 확인 (9개 필드 모두)
  const checkAllFieldsComplete = (info: UnifiedBrandInfo): boolean => {
    // core_keywords, avoided_trends, preferred_colors는 문자열 또는 배열일 수 있음
    const coreKeywords = Array.isArray(info.core_keywords) 
      ? info.core_keywords.join(', ') 
      : (info.core_keywords || "");
    const avoidedTrends = Array.isArray(info.avoid_trends)
      ? info.avoid_trends.join(', ')
      : (info.avoid_trends || info.avoided_trends || ""); // 둘 다 체크
    const preferredColors = Array.isArray(info.preferred_colors)
      ? info.preferred_colors.join(', ')
      : (info.preferred_colors || "");
    
    const fields = [
      info.brand_name,
      info.industry || info.category, // 둘 다 체크
      info.mood || info.tone_mood, // 둘 다 체크
      coreKeywords,
      info.target_age,
      info.target_gender,
      avoidedTrends,
      info.slogan,
      preferredColors,
    ];
    
    // 각 필드가 채워져 있는지 확인 (빈 문자열이 아니고 null/undefined가 아님)
    return fields.every((f) => {
      if (f === null || f === undefined) return false;
      const str = String(f).trim();
      return str !== '';
    });
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

  // 프로그레스 계산 (백엔드 brand_info 기반)
  const calculateProgress = () => {
    // 백엔드에서 받은 brand_info가 있으면 그것을 사용, 없으면 collectedInfo 사용
    // 백엔드는 category, tone_mood, avoided_trends를 사용하므로 매핑 필요
    let info: {
      brand_name?: string;
      industry?: string;
      category?: string;
      mood?: string;
      tone_mood?: string;
      core_keywords?: string;
      target_age?: string;
      target_gender?: string;
      avoid_trends?: string;
      avoided_trends?: string;
      slogan?: string;
      preferred_colors?: string;
    };
    
    if (brandInfo) {
      // 백엔드 brandInfo 사용 (필드명 매핑)
      info = {
        brand_name: brandInfo.brand_name,
        industry: brandInfo.category, // 백엔드는 category, 프론트는 industry로 사용
        mood: brandInfo.tone_mood, // 백엔드는 tone_mood, 프론트는 mood로 사용
        core_keywords: brandInfo.core_keywords,
        target_age: brandInfo.target_age,
        target_gender: brandInfo.target_gender,
        avoid_trends: brandInfo.avoided_trends, // 백엔드는 avoided_trends, 프론트는 avoid_trends로 사용
        slogan: brandInfo.slogan,
        preferred_colors: brandInfo.preferred_colors,
      };
    } else {
      // collectedInfo 사용
      info = {
        brand_name: collectedInfo.brand_name,
        industry: collectedInfo.industry,
        mood: collectedInfo.mood,
        core_keywords: collectedInfo.core_keywords.join(', '),
        target_age: collectedInfo.target_age,
        target_gender: collectedInfo.target_gender,
        avoid_trends: collectedInfo.avoid_trends.join(', '),
        slogan: collectedInfo.slogan,
        preferred_colors: collectedInfo.preferred_colors.join(', '),
      };
    }

    // 총 9개 필드 체크 (프론트엔드 필드명 기준)
    const fields = [
      info.brand_name,
      info.industry || info.category, // 둘 다 체크
      info.mood || info.tone_mood, // 둘 다 체크
      info.core_keywords,
      info.target_age,
      info.target_gender,
      info.avoid_trends || info.avoided_trends, // 둘 다 체크
      info.slogan,
      info.preferred_colors,
    ];
    
    // 각 필드가 채워져 있는지 확인 (빈 문자열이 아니고 null/undefined가 아님)
    const answeredCount = fields.filter((f) => {
      if (f === null || f === undefined) return false;
      const str = String(f).trim();
      return str !== '';
    }).length;
    
    return {
      answered: answeredCount,
      total: 9,
      percentage: (answeredCount / 9) * 100,
    };
  };

  // 공통 Studio 이동 함수
  const handleGoToStudio = (projectId: string | number, type?: "logo" | "short", fromStyle?: boolean) => {
    // DB 프로젝트 ID를 우선 사용, 없으면 로컬 프로젝트 ID 사용
    const finalProjectId = dbProjectId || projectId;
    
    if (!finalProjectId) {
      toast({
        title: "오류",
        description: "프로젝트를 찾을 수 없습니다.",
        status: "error",
      });
      return;
    }

    // type이 지정된 경우: 별도 페이지로 이동 (/chat/logo 또는 /chat/shorts)
    if (type) {
      const projectIdStr = String(finalProjectId);
      if (type === "logo") {
        navigate(`/chat/logo?project=${projectIdStr}`);
      } else if (type === "short") {
        navigate(`/chat/shorts?project=${projectIdStr}`);
      }
      return;
    }

    // type이 없는 경우: 기존 로직 (로컬 프로젝트만 지원)
    const projectIdStr = String(projectId);
    const project = projectStorage.getProject(projectIdStr);
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
    projectStorage.addMessage(projectIdStr, infoMessage);

    // Studio로 이동 (type 파라미터 제거)
    const fromStyleParam = fromStyle && baseAssetType && baseAssetId 
      ? `&from_style=true&baseAssetType=${baseAssetType}&baseAssetId=${baseAssetId}` 
      : "";
    toast({
      title: "스튜디오로 이동합니다",
      description: project.logo ? "업로드한 로고를 사용합니다." : "Studio에서 로고와 숏폼을 생성할 수 있습니다.",
      status: "success",
    });
    
    navigate(`/studio?project=${projectIdStr}${fromStyleParam}`);
  };

  useEffect(() => {
    // draft=true 제거, localStorage만 확인
    const dbProjectIdParam = searchParams.get('db_project'); // DB 프로젝트 ID
    
    // 이미 dbProjectId가 설정되어 있으면 (프로젝트 생성 후) navigate하지 않음
    if (dbProjectId) {
      return;
    }
    
    // DB 프로젝트 ID가 있는 경우 (DB에서 가져온 프로젝트)
    if (dbProjectIdParam) {
      const dbId = parseInt(dbProjectIdParam);
      setDbProjectId(dbId);
      // DB 프로젝트 ID를 brand_session_id로도 사용
      setBrandSessionId(dbId.toString());
      
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
    
    // localStorage에 draft 프로젝트 정보가 있는지 확인
    const draftData = localStorage.getItem('makery_draft_project');
    if (draftData) {
      setIsDraftMode(true);
      
      // draft 프로젝트 정보 불러오기
      try {
        const draft = JSON.parse(draftData);
        setDraftProjectInfo({ name: draft.name, description: draft.description || "" });
      } catch (e) {
        console.error("Draft 프로젝트 정보 파싱 실패:", e);
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
    
    // draft도 없고 DB 프로젝트도 아닌 경우 프로젝트 목록으로 이동
    // 단, 메시지가 이미 있는 경우(대화 중인 경우)는 이동하지 않음
    if (messages.length === 0) {
      navigate("/projects");
    }
  }, [navigate, searchParams, messages.length, dbProjectId]);


  // 메시지 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 로딩 상태 변경 시 스크롤 (답변 생성 중 표시를 위해)
  useEffect(() => {
    if (isLoadingChat) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [isLoadingChat]);

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
    
    // draft 모드 또는 DB 프로젝트 모드가 아닌 경우 리턴
    if (!dbProjectId && !isDraftMode) {
      toast({
        title: "오류",
        description: "프로젝트 정보가 없습니다.",
        variant: "destructive",
      });
      return;
    }
    if (currentStep !== "collecting") return;
  
    const userMessage: Message = {
      role: "user",
      content: inputMessage
    };
  
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
  
    // 🆕 항상 백엔드 API 호출
    setIsLoadingChat(true);
    try {
      const response = await sendBrandChat({
        message: inputMessage,
        brand_session_id: brandSessionId || undefined, // 저장된 brand_session_id 사용
        grp_nm: isDraftMode ? draftProjectInfo?.name : undefined,
        grp_desc: isDraftMode ? draftProjectInfo?.description : undefined,
      });

      // 백엔드 응답을 assistant 메시지로 추가
      const assistantMessage: Message = {
        role: "assistant",
        content: response.reply
      };

      // brand_session_id 저장 (응답에서 받은 값)
      if (response.brand_session_id) {
        setBrandSessionId(response.brand_session_id);
      }

      // brand_info 업데이트
      if (response.brand_info) {
        setBrandInfo(response.brand_info);
      }

      setTimeout(() => {
        setMessages(prev => [...prev, assistantMessage]);
        
        // project_id가 반환되면 저장 (draft 모드에서 프로젝트 생성된 경우)
        if (response.project_id && isDraftMode) {
          setDbProjectId(response.project_id);
          setIsDraftMode(false); // draft 모드 종료
          
          // draft 정보 삭제
          localStorage.removeItem('makery_draft_project');
          
          // project_id를 brand_session_id로도 사용
          if (response.brand_session_id) {
            setBrandSessionId(response.brand_session_id);
          } else {
            setBrandSessionId(response.project_id.toString());
          }
          
          // 프로젝트 생성 완료 메시지
          toast({
            title: "프로젝트 생성 완료",
            description: "브랜드 정보 수집을 계속합니다.",
            status: "success",
          });
        }
        
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
  };

  const handleSkipClick = async () => {
    // 필수 필드 체크는 이미 canSkip으로 계산되어 있으므로 사용
    if (!canSkip) {
      toast({
        title: "필수 항목 미입력",
        description: "브랜드명과 업종은 필수 항목입니다.",
        status: "warning",
      });
      return;
    }
    
    // 브랜드 정보 확인 다이얼로그 표시 (9개 모두 채워졌든 아니든 동일한 다이얼로그 사용)
    if (currentStep === "collecting" && !showProjectConfirm) {
      setShowCompleteBrandConfirmDialog(true);
      return;
    }
    
    // 기존 로직 유지 (혹시 모를 경우를 위해)
    setSkipDialogStep("confirm");
    setShowSkipDialog(true);
  };

  // 브랜드 정보 확인 다이얼로그에서 "예" 버튼 클릭 시 프로젝트 생성
  const handleCompleteBrandConfirm = async () => {
    setShowCompleteBrandConfirmDialog(false);
    
    // 9개 필드가 모두 채워졌을 때: 프로젝트 생성
    if (allFieldsComplete) {
      if (!brandSessionId) {
        toast({
          title: "오류",
          description: "세션 정보가 없습니다.",
          variant: "destructive",
        });
        return;
      }

      setIsLoadingChat(true);
      try {
        // 프로젝트 생성 API 호출
        const response = await createBrandProject({
          brand_session_id: brandSessionId,
          grp_nm: draftProjectInfo?.name || currentBrandInfo.brand_name || undefined,
          grp_desc: draftProjectInfo?.description || undefined,
        });

        // 프로젝트 생성이 성공적으로 완료된 경우에만 진행
        if (response && response.project_id) {
          // 프로젝트 ID 저장
          setDbProjectId(response.project_id);
          
          // draft 정보 삭제
          localStorage.removeItem('makery_draft_project');
          setIsDraftMode(false);
          
          // 로딩 상태 먼저 해제 (메시지 추가 전에)
          setIsLoadingChat(false);
          
          // 브랜드명 가져오기
          const brandName = currentBrandInfo.brand_name || "브랜드";
          
          // 프로젝트 생성 완료 메시지 추가
          const confirmQuestion: Message = {
            role: "assistant",
            content: `프로젝트가 성공적으로 생성되었습니다.\n\n${brandName}의 로고와 숏폼 중 무엇부터 만들어볼까요?`
          };
          setMessages(prev => [...prev, confirmQuestion]);
          
          // 바로 showProjectConfirm을 true로 설정하여 로고/숏폼 생성 버튼 표시
          setShowProjectConfirm(true);
          setCurrentStep("complete"); 
          
          toast({
            title: "프로젝트 생성 완료",
            description: "프로젝트가 생성되었습니다.",
            status: "success",
          });
        } else {
          // 응답이 정상적이지 않은 경우
          setIsLoadingChat(false);
          toast({
            title: "프로젝트 생성 실패",
            description: "프로젝트 생성 응답이 올바르지 않습니다.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('프로젝트 생성 오류:', error);
        setIsLoadingChat(false);
        toast({
          title: "프로젝트 생성 실패",
          description: error instanceof Error ? error.message : "프로젝트 생성에 실패했습니다.",
          variant: "destructive",
        });
      }
    } else {
      // 9개 미만일 때: 기존 건너뛰기 로직 사용
      handleProjectConfirmInDialog();
    }
  };

  const handleSkipConfirm = () => {
    // 건너뛰기 팝업 흐름에서는 대화창 상태를 변경하지 않음
    // 오직 팝업 내부 단계만 변경
    setSkipDialogStep("project");
  };
  
  const handleProjectConfirmInDialog = async () => {
    // 필수 항목 체크 - brandInfo (백엔드 정보) 우선 사용, 없으면 collectedInfo 사용
    // brandInfo는 category 사용, collectedInfo는 industry 사용
    const brandNameValue = (brandInfo?.brand_name || collectedInfo.brand_name || "").trim();
    const categoryValue = (brandInfo?.category || collectedInfo.industry || "").trim();
    
    if (!brandNameValue || !categoryValue) {
      toast({
        title: "필수 항목 미입력",
        description: "브랜드명과 업종은 필수 항목입니다.",
        variant: "destructive",
      });
      return;
    }
    
    // brandSessionId가 없으면 에러
    if (!brandSessionId) {
      toast({
        title: "오류",
        description: "세션 정보가 없습니다.",
        variant: "destructive",
      });
      return;
    }
    
    // DB에 프로젝트 생성 (9개 다 채운 경우와 동일한 로직)
    setIsLoadingChat(true);
    try {
      // 프로젝트 생성 API 호출
      const response = await createBrandProject({
        brand_session_id: brandSessionId,
        grp_nm: draftProjectInfo?.name || brandNameValue || undefined,
        grp_desc: draftProjectInfo?.description || undefined,
      });
      
      // 프로젝트 생성이 성공적으로 완료된 경우에만 진행
      if (response && response.project_id) {
        // 프로젝트 ID 저장
        setDbProjectId(response.project_id);
        
        // draft 정보 삭제
        localStorage.removeItem('makery_draft_project');
        setIsDraftMode(false);
        
        // 로딩 상태 먼저 해제 (메시지 추가 전에)
        setIsLoadingChat(false);
        
        // 브랜드명 가져오기
        const brandName = brandNameValue || "브랜드";
        
        // 프로젝트 생성 완료 메시지 추가
        const confirmQuestion: Message = {
          role: "assistant",
          content: `프로젝트가 성공적으로 생성되었습니다.\n\n${brandName}의 로고와 숏폼 중 무엇부터 만들어볼까요?`
        };
        setMessages(prev => [...prev, confirmQuestion]);
        
        // 바로 showProjectConfirm을 true로 설정하여 로고/숏폼 생성 버튼 표시
        setShowProjectConfirm(true);
        setCurrentStep("complete");
        
        // 건너뛰기 다이얼로그 닫기
        setShowSkipDialog(false);
        setSkipDialogStep("confirm");
        
        toast({
          title: "프로젝트 생성 완료",
          description: "프로젝트가 생성되었습니다.",
          status: "success",
        });
      } else {
        // 응답이 정상적이지 않은 경우
        setIsLoadingChat(false);
        toast({
          title: "프로젝트 생성 실패",
          description: "프로젝트 생성 응답이 올바르지 않습니다.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('프로젝트 생성 오류:', error);
      setIsLoadingChat(false);
      toast({
        title: "프로젝트 생성 실패",
        description: error instanceof Error ? error.message : "프로젝트 생성에 실패했습니다.",
        variant: "destructive",
      });
    }
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
    // DB 프로젝트 모드인 경우
    if (dbProjectId) {
      // DB 프로젝트 ID를 사용하여 별도 페이지로 이동
      if (type === "logo") {
        navigate(`/chat/logo?project=${dbProjectId}`);
      } else if (type === "short") {
        navigate(`/chat/shorts?project=${dbProjectId}`);
      }
      return;
    }

    // 로컬 projectStorage 모드인 경우
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


  const progress = calculateProgress();
  
  // brandInfo를 우선 사용, 없으면 collectedInfo 사용
  // 백엔드는 category, tone_mood, avoided_trends를 사용하므로 프론트엔드 필드명으로 매핑
  const currentBrandInfo: UnifiedBrandInfo = brandInfo ? {
    brand_name: brandInfo.brand_name,
    industry: brandInfo.category, // 백엔드는 category, 프론트는 industry로 사용
    category: brandInfo.category, // 백엔드 필드명도 유지
    mood: brandInfo.tone_mood, // 백엔드는 tone_mood, 프론트는 mood로 사용
    tone_mood: brandInfo.tone_mood, // 백엔드 필드명도 유지
    core_keywords: brandInfo.core_keywords,
    target_age: brandInfo.target_age,
    target_gender: brandInfo.target_gender,
    avoid_trends: brandInfo.avoided_trends, // 백엔드는 avoided_trends, 프론트는 avoid_trends로 사용
    avoided_trends: brandInfo.avoided_trends, // 백엔드 필드명도 유지
    slogan: brandInfo.slogan,
    preferred_colors: brandInfo.preferred_colors,
  } : {
    brand_name: collectedInfo.brand_name,
    industry: collectedInfo.industry,
    mood: collectedInfo.mood,
    core_keywords: collectedInfo.core_keywords.join(', '),
    target_age: collectedInfo.target_age,
    target_gender: collectedInfo.target_gender,
    avoid_trends: collectedInfo.avoid_trends.join(', '),
    slogan: collectedInfo.slogan,
    preferred_colors: collectedInfo.preferred_colors.join(', '),
  };
  
  // brand_name과 category만 있으면 건너뛰기 가능
  const canSkip = checkRequiredFieldsComplete(currentBrandInfo);
  // 9개 필드가 모두 채워졌는지 확인
  const allFieldsComplete = checkAllFieldsComplete(currentBrandInfo);
  
  const showLogoButtons = currentStep === "logoQuestion" && hasLogo === null;
  const canGenerate = canSkip && currentStep === "complete" && showProjectConfirm;
  
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
          
          {/* Right: Skip/생성하기 Button */}
          {/* 프로젝트가 생성된 후(showProjectConfirm이 true)에는 버튼 숨김 */}
          {!showProjectConfirm && (
            <div className="w-24 flex justify-end">
              <Button
                onClick={handleSkipClick}
                disabled={!canSkip || isLoadingChat}
                variant={canSkip ? "default" : "ghost"}
                className={canSkip ? "bg-primary hover:bg-primary/90" : ""}
              >
                {/* 프로젝트 생성 중일 때만 스피너 표시 (9개 필드가 모두 채워진 상태에서 생성하기 버튼 클릭 시) */}
                {isLoadingChat && allFieldsComplete && currentStep === "collecting" && !showProjectConfirm ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    생성 중...
                  </>
                ) : allFieldsComplete && currentStep === "collecting" && !showProjectConfirm ? (
                  "생성하기"
                ) : (
                  "건너뛰기"
                )}
              </Button>
            </div>
          )}
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
          
          {/* 로딩 인디케이터 */}
          {isLoadingChat && (
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
                    <p className="text-muted-foreground">답변을 생성하고 있습니다...</p>
                  </div>
                </Card>
              </div>
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
            disabled={!inputMessage.trim() || currentStep === "complete" || showLogoButtons || isLoadingChat}
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
                    const projectId = dbProjectId || currentProjectId;
                    if (!projectId) {
                      toast({
                        title: "오류",
                        description: "프로젝트를 찾을 수 없습니다.",
                        variant: "destructive",
                      });
                      return;
                    }
                    setShowSkipDialog(false);
                    setSkipDialogStep("confirm");
                    handleGoToStudio(projectId, "logo");
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
                    const projectId = dbProjectId || currentProjectId;
                    if (!projectId) {
                      toast({
                        title: "오류",
                        description: "프로젝트를 찾을 수 없습니다.",
                        variant: "destructive",
                      });
                      return;
                    }
                    setShowSkipDialog(false);
                    setSkipDialogStep("confirm");
                    handleGoToStudio(projectId, "short");
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

      {/* 브랜드 정보 완성 확인 다이얼로그 (9개 필드 모두 채워졌을 때) */}
      <AlertDialog open={showCompleteBrandConfirmDialog} onOpenChange={setShowCompleteBrandConfirmDialog}>
        <AlertDialogContent className="max-w-3xl">
          <AlertDialogHeader className="pb-3">
            <AlertDialogTitle className="text-2xl font-bold">브랜드 정보 확인</AlertDialogTitle>
            <AlertDialogDescription className="text-base pt-1">
              입력하신 브랜드 정보를 확인해주세요. 이대로 프로젝트를 생성하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              {/* 브랜드명 */}
              <div className="bg-muted/50 rounded-lg p-3 border border-border">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">브랜드명</label>
                <p className="text-sm font-semibold text-foreground">{currentBrandInfo.brand_name || "-"}</p>
              </div>
              
              {/* 업종 */}
              <div className="bg-muted/50 rounded-lg p-3 border border-border">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">업종</label>
                <p className="text-sm font-semibold text-foreground">{currentBrandInfo.industry || currentBrandInfo.category || "-"}</p>
              </div>
              
              {/* 톤앤무드 */}
              <div className="bg-muted/50 rounded-lg p-3 border border-border">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">톤앤무드</label>
                <p className="text-sm font-semibold text-foreground">{currentBrandInfo.mood || currentBrandInfo.tone_mood || "-"}</p>
              </div>
              
              {/* 타겟 연령 */}
              <div className="bg-muted/50 rounded-lg p-3 border border-border">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">타겟 연령</label>
                <p className="text-sm font-semibold text-foreground">{currentBrandInfo.target_age || "-"}</p>
              </div>
              
              {/* 타겟 성별 */}
              <div className="bg-muted/50 rounded-lg p-3 border border-border">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">타겟 성별</label>
                <p className="text-sm font-semibold text-foreground">{currentBrandInfo.target_gender || "-"}</p>
              </div>
              
              {/* 슬로건 */}
              <div className="bg-muted/50 rounded-lg p-3 border border-border">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">슬로건</label>
                <p className="text-sm font-semibold text-foreground">{currentBrandInfo.slogan || "-"}</p>
              </div>
              
              {/* 핵심 키워드 */}
              <div className="col-span-2 bg-muted/50 rounded-lg p-3 border border-border">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">핵심 키워드</label>
                <p className="text-sm font-semibold text-foreground">
                  {typeof currentBrandInfo.core_keywords === 'string' 
                    ? currentBrandInfo.core_keywords 
                    : Array.isArray(currentBrandInfo.core_keywords)
                    ? currentBrandInfo.core_keywords.join(', ')
                    : "-"}
                </p>
              </div>
              
              {/* 피하고 싶은 트렌드 */}
              <div className="col-span-2 bg-muted/50 rounded-lg p-3 border border-border">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">피하고 싶은 트렌드</label>
                <p className="text-sm font-semibold text-foreground">
                  {(() => {
                    const avoidTrends = currentBrandInfo.avoid_trends || currentBrandInfo.avoided_trends;
                    if (typeof avoidTrends === 'string') {
                      return avoidTrends;
                    } else if (Array.isArray(avoidTrends)) {
                      return avoidTrends.join(', ');
                    }
                    return "-";
                  })()}
                </p>
              </div>
              
              {/* 선호 색상 */}
              <div className="col-span-2 bg-muted/50 rounded-lg p-3 border border-border">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">선호 색상</label>
                <p className="text-sm font-semibold text-foreground">
                  {typeof currentBrandInfo.preferred_colors === 'string' 
                    ? currentBrandInfo.preferred_colors 
                    : Array.isArray(currentBrandInfo.preferred_colors)
                    ? currentBrandInfo.preferred_colors.join(', ')
                    : "-"}
                </p>
              </div>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowCompleteBrandConfirmDialog(false)}>
              아니오
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCompleteBrandConfirm}
              disabled={isLoadingChat}
            >
              {isLoadingChat ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  생성 중...
                </>
              ) : (
                "예, 생성하기"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
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
                const projectId = dbProjectId || currentProjectId;
                if (projectId) {
                  handleGoToStudio(projectId, "logo");
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
                const projectId = dbProjectId || currentProjectId;
                if (projectId) {
                  handleGoToStudio(projectId, "short");
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
