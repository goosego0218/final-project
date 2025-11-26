import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Send, Zap, ChevronLeft, ChevronRight, Download, RefreshCw, Star, Plus, Upload, X, FolderOpen, Instagram, Youtube, Trash2, Info, Check, Image, Video, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { projectStorage, type Message, type Project, type SavedItem } from "@/lib/projectStorage";
import StudioTopBar from "@/components/StudioTopBar";
import { getShortsIntro, getLogoIntro } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SelectedResult {
  type: "logo" | "short";
  url: string;
  index: number;
}

const StudioPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [logoMessages, setLogoMessages] = useState<Message[]>([]); // 로고 탭 메시지
  const [shortMessages, setShortMessages] = useState<Message[]>([]); // 숏폼 탭 메시지
  const [inputValue, setInputValue] = useState("");
  const [hasResultPanel, setHasResultPanel] = useState(false);
  const [hasStartedChat, setHasStartedChat] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SelectedResult | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUploadUrl, setPendingUploadUrl] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<SavedItem | null>(null);
  const [selectedLogoForShort, setSelectedLogoForShort] = useState<SavedItem | null>(null);
  const [shortFormQuestionStep, setShortFormQuestionStep] = useState<"select" | "logoList" | "content" | "satisfaction" | null>(null); // 숏폼 질문 단계
  const [uploadQuestionStep, setUploadQuestionStep] = useState<string | null>(null); // 업로드 질문 단계 (URL을 키로 사용)
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set()); // 선택된 플랫폼들
  const [shortFormIntent, setShortFormIntent] = useState<string>(""); // 사용자가 입력한 숏폼 내용
  const [isGeneratingShortForm, setIsGeneratingShortForm] = useState(false); // 숏폼 생성 중인지
  const [lastGeneratedShortFormUrl, setLastGeneratedShortFormUrl] = useState<string | null>(null); // 마지막 생성된 숏폼 URL
  
  // 저장된 로고/숏폼 추적
  const [savedLogos, setSavedLogos] = useState<SavedItem[]>([]);
  const [savedShorts, setSavedShorts] = useState<SavedItem[]>([]);
  const [activeStorageTab, setActiveStorageTab] = useState<"logos" | "shorts" | null>(null);
  
  // 로고 생성 시 브랜드 정보 및 디자인 방향
  const [brandInfo, setBrandInfo] = useState<{ brand_name: string; industry: string } | null>(null);
  const [selectedLogoType, setSelectedLogoType] = useState<"text" | "text-icon" | "emblem" | null>(null);
  const [logoTypeSelected, setLogoTypeSelected] = useState(false);
  
  // 로고 추천 단계 관리
  const [recommendationStep, setRecommendationStep] = useState<"none" | "first" | "second">("none");
  const [firstRecommendations, setFirstRecommendations] = useState<string[]>([]);
  const [secondRecommendations, setSecondRecommendations] = useState<string[]>([]);
  const [selectedFirstLogo, setSelectedFirstLogo] = useState<string | null>(null);
  const [selectedSecondLogo, setSelectedSecondLogo] = useState<string | null>(null); // 최종 참고 로고
  const [previewLogoImage, setPreviewLogoImage] = useState<string | null>(null); // 왼쪽 큰 미리보기용
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null); // 선택된 스타일
  const [isWaitingFinalLogoDetail, setIsWaitingFinalLogoDetail] = useState(false); // 최종 로고 생성용 추가 설명 대기 중
  const [finalLogoExtraDescription, setFinalLogoExtraDescription] = useState<string>(""); // 최종 로고 생성용 추가 설명
  const [fromStyleMode, setFromStyleMode] = useState(false);
  const [baseAssetType, setBaseAssetType] = useState<"logo" | "shortform" | null>(null);
  const [baseAssetId, setBaseAssetId] = useState<string | null>(null);
  const [isChatLoaded, setIsChatLoaded] = useState(false); // 프로젝트 대화 로딩 완료 여부
  const [isLoadingShortsIntro, setIsLoadingShortsIntro] = useState(false); // 숏폼 intro API 로딩 상태
  const [isLoadingLogoIntro, setIsLoadingLogoIntro] = useState(false); // 로고 intro API 로딩 상태

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
  const [isLoggedInState, setIsLoggedInState] = useState(false);

  // localStorage 변경 감지하여 사용자 정보 업데이트
  useEffect(() => {
    // 초기 로그인 상태 확인
    setIsLoggedInState(localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true');
    
    const handleStorageChange = () => {
      setUserProfile(getUserProfile());
      setIsLoggedInState(localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true');
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

  // 타입 파라미터 읽기 (로고 생성용인지 숏폼 생성용인지)
  const studioType = searchParams.get('type') as "logo" | "short" | null;
  const fromStyle = searchParams.get('from_style') === 'true';
  const assetType = searchParams.get('baseAssetType') as "logo" | "shortform" | null;
  const assetId = searchParams.get('baseAssetId');

  // 초기 로그인 상태 확인
  useEffect(() => {
    setIsLoggedIn(localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true');
  }, []);

  // from_style 모드 설정
  useEffect(() => {
    if (fromStyle) {
      setFromStyleMode(true);
      setBaseAssetType(assetType || null);
      setBaseAssetId(assetId || null);
    }
  }, [fromStyle, assetType, assetId]);

  // studioType 변경 시 해당 탭의 메시지 복원
  useEffect(() => {
    if (studioType === "logo") {
      if (logoMessages.length > 0) {
        setMessages(logoMessages);
      } else {
        setMessages([]);
      }
    } else if (studioType === "short") {
      if (shortMessages.length > 0) {
        setMessages(shortMessages);
      } else {
        setMessages([]);
      }
    }
  }, [studioType]); // logoMessages, shortMessages는 dependency에서 제거하여 무한 루프 방지

  // 프로젝트 로드
  useEffect(() => {
    const currentLoggedIn = localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true';
    setIsLoggedIn(currentLoggedIn);
    if (!currentLoggedIn) {
      navigate("/");
      return;
    }

    const projectId = searchParams.get('project');
    if (projectId) {
      const project = projectStorage.getProject(projectId);
      
      // DB 프로젝트 ID인지 확인 (숫자로만 이루어진 경우)
      const isDbProjectId = /^\d+$/.test(projectId);
      
      // DB 프로젝트 ID이고 숏폼 타입인 경우: projectStorage에 없어도 intro API 호출
      if (isDbProjectId && studioType === "short" && !project) {
        const dbProjectIdNum = parseInt(projectId);
        setCurrentProjectId(projectId);
        
        // 로딩 상태 시작 및 채팅 시작 표시
        setIsLoadingShortsIntro(true);
        setHasStartedChat(true);
        
        getShortsIntro({ project_id: dbProjectIdNum })
          .then((response) => {
            const introMessage: Message = {
              role: "assistant",
              content: response.reply,
              studioType: "short"
            };
            setMessages([introMessage]);
            setShortFormQuestionStep(null);
          })
          .catch((error) => {
            console.error('숏폼 intro API 호출 실패:', error);
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
            setMessages([fallbackMessage]);
            setShortFormQuestionStep(null);
          })
          .finally(() => {
            setIsLoadingShortsIntro(false);
          });
        return; // DB 프로젝트 처리 후 종료
      }
      
      // DB 프로젝트 ID이고 로고 타입인 경우: projectStorage에 없어도 intro API 호출
      if (isDbProjectId && studioType === "logo" && !project) {
        const dbProjectIdNum = parseInt(projectId);
        setCurrentProjectId(projectId);
        
        // 로딩 상태 시작 및 채팅 시작 표시
        setIsLoadingLogoIntro(true);
        setHasStartedChat(true);
        
        getLogoIntro({ project_id: dbProjectIdNum })
          .then((response) => {
            const introMessage: Message = {
              role: "assistant",
              content: response.reply,
              studioType: "logo"
            };
            setMessages([introMessage]);
            setLogoMessages([introMessage]); // 로고 탭 메시지 저장
          })
          .catch((error) => {
            console.error('로고 intro API 호출 실패:', error);
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
            setMessages([fallbackMessage]);
            setLogoMessages([fallbackMessage]); // 로고 탭 메시지 저장
          })
          .finally(() => {
            setIsLoadingLogoIntro(false);
          });
        return; // DB 프로젝트 처리 후 종료
      }
      
      if (project) {
        setCurrentProjectId(projectId);
        // type=logo일 때 로고 관련 대화가 있는지 확인
        if (studioType === "logo") {
          // system 메시지에서 브랜드 정보 추출
          const systemMessage = project.messages.find(m => m.role === "system");
          if (systemMessage) {
            try {
              const info = JSON.parse(systemMessage.content);
              setBrandInfo({
                brand_name: info.brand_name || "",
                industry: info.industry || ""
              });
            } catch (e) {
              // 파싱 실패 시 무시
            }
          }
          
          // 로고 스튜디오 메시지만 필터링
          // studioType이 "logo"인 메시지 또는 studioType이 없지만 로고 타입 선택 메시지가 있는 경우 (기존 호환성)
          const allChatMessages = project.messages.filter(m => m.role !== "system");
          const hasLogoTypeMessage = allChatMessages.some(m => 
            m.role === "user" && (m.content.includes("글씨") || m.content.includes("글씨/아이콘") || m.content.includes("엠블럼") || m.content.includes("글씨만 있는 로고") || m.content.includes("글씨랑 아이콘 있는 로고") || m.content.includes("엠블럼만 있는 로고"))
          );
          const hasShortFormMessage = allChatMessages.some(m =>
            m.role === "assistant" && m.content === "어떤 식으로 숏폼을 생성하시겠습니까?"
          );
          
          // 로고 스튜디오 메시지만 필터링
          const chatMessages = allChatMessages.filter(m => {
            if (m.studioType === "logo") return true;
            if (m.studioType === "short") return false;
            // studioType이 없는 경우: 로고 타입 선택 메시지가 있으면 로고 메시지로 간주
            if (hasLogoTypeMessage && !hasShortFormMessage) return true;
            // 둘 다 있으면 studioType이 없는 메시지는 제외 (명확하지 않으므로)
            if (hasLogoTypeMessage && hasShortFormMessage) return false;
            // 둘 다 없으면 기존 동작 유지 (로고로 간주)
            return true;
          });
          
          const logoTypeUserMessageIndex = chatMessages.findIndex(m => 
            m.role === "user" && (m.content.includes("글씨") || m.content.includes("글씨/아이콘") || m.content.includes("엠블럼") || m.content.includes("글씨만 있는 로고") || m.content.includes("글씨랑 아이콘 있는 로고") || m.content.includes("엠블럼만 있는 로고"))
          );
          
          // from_style 모드가 아닐 때는 기존 로직대로 메시지 설정
          // from_style 모드일 때는 기존 대화만 표시하고, 나중에 별도 useEffect에서 메시지 추가
          if (logoTypeUserMessageIndex !== -1 && !fromStyle) {
            // from_style 모드가 아닐 때는 기존 로직 유지
            // 로고 타입 선택 이후의 메시지만 표시 (ChatPage 대화 제외)
            const logoMessages = chatMessages.slice(logoTypeUserMessageIndex);
            setMessages(logoMessages);
            setLogoMessages(logoMessages); // 로고 탭 메시지 저장
            setHasStartedChat(true);
            setLogoTypeSelected(true);
            
            // 선택된 로고 타입 복원
            const logoTypeUserMessage = chatMessages[logoTypeUserMessageIndex];
            if (logoTypeUserMessage) {
              if (logoTypeUserMessage.content.includes("글씨/아이콘") || logoTypeUserMessage.content.includes("글씨랑 아이콘 있는 로고")) {
                setSelectedLogoType("text-icon");
              } else if (logoTypeUserMessage.content.includes("글씨만 있는 로고") || (logoTypeUserMessage.content.includes("글씨") && !logoTypeUserMessage.content.includes("글씨/아이콘"))) {
                setSelectedLogoType("text");
              } else if (logoTypeUserMessage.content.includes("엠블럼만 있는 로고") || (logoTypeUserMessage.content.includes("엠블럼") && !logoTypeUserMessage.content.includes("엠블럼만 있는 로고"))) {
                setSelectedLogoType("emblem");
              }
            }
            
            // 결과 패널 복원 (이미지가 있는 assistant 메시지 확인)
            const lastImageMessage = logoMessages
              .filter(m => m.role === "assistant" && m.images && m.images.length > 0)
              .pop();
            if (lastImageMessage && lastImageMessage.images && lastImageMessage.images.length > 0) {
              // 최종 생성된 로고가 있는 경우
              setHasResultPanel(true);
              setSelectedResult({
                type: "logo",
                url: lastImageMessage.images[0],
                index: 0
              });
              setRecommendationStep("none"); // 최종 생성 완료
            } else {
              // 로고 타입은 선택했지만 아직 생성되지 않은 경우
              // 메시지 히스토리를 확인하여 어느 단계인지 판단
              const hasStyleSelectionMessage = logoMessages.some(m => 
                m.role === "assistant" && m.content.includes("원하시는 스타일을 선택해주세요")
              );
              const hasSecondRecommendationMessage = logoMessages.some(m =>
                m.role === "assistant" && m.content.includes("선택하신 스타일을 기반으로")
              );
              
              if (hasSecondRecommendationMessage) {
                // 2차 추천 단계로 복원 - 메시지에서 이미지 가져오기
                const secondRecommendationMessage = logoMessages.find(m =>
                  m.role === "assistant" && m.content.includes("선택하신 스타일을 기반으로") && m.images && m.images.length > 0
                );
                if (secondRecommendationMessage && secondRecommendationMessage.images) {
                  setSecondRecommendations(secondRecommendationMessage.images);
                  setRecommendationStep("second");
                  setSelectedSecondLogo(null);
                  
                  // 스타일 선택 메시지 찾아서 firstRecommendations 복원
                  const styleSelectionMessage = logoMessages.find(m =>
                    m.role === "assistant" && m.content.includes("원하시는 스타일을 선택해주세요") && m.images && m.images.length > 0
                  );
                  
                  if (styleSelectionMessage && styleSelectionMessage.images && styleSelectionMessage.images.length > 0) {
                    setFirstRecommendations(styleSelectionMessage.images);
                    // 첫 번째 이미지를 선택된 로고로 설정 (정확한 매칭은 어려우므로 첫 번째로 가정)
                    setSelectedFirstLogo(styleSelectionMessage.images[0]);
                    
                    // 선택된 스타일 복원: 첫 번째 이미지 인덱스 0에 해당하는 스타일
                    if (selectedLogoType) {
                      const styleLabels = getStyleLabelsByType(selectedLogoType);
                      if (styleLabels.length > 0) {
                        setSelectedStyle(styleLabels[0]);
                      }
                    }
                  }
                  
                  if (secondRecommendationMessage.images.length > 0) {
                    setPreviewLogoImage(secondRecommendationMessage.images[0]);
                    setSelectedResult({
                      type: "logo",
                      url: secondRecommendationMessage.images[0],
                      index: 0
                    });
                    setHasResultPanel(true);
                  }
                } else {
                  // 메시지에 이미지가 없으면 새로 생성
                  const allImages = getLogoImagesByType(selectedLogoType || "text");
                  const recommendedLogos = getRandomLogos(allImages, 4);
                  setSecondRecommendations(recommendedLogos);
                  setRecommendationStep("second");
                  setSelectedSecondLogo(null);
                  
                  if (recommendedLogos.length > 0) {
                    setPreviewLogoImage(recommendedLogos[0]);
                    setSelectedResult({
                      type: "logo",
                      url: recommendedLogos[0],
                      index: 0
                    });
                    setHasResultPanel(true);
                  }
                }
              } else if (hasStyleSelectionMessage) {
                // 스타일 선택 단계로 복원 - 메시지에서 이미지 가져오기
                const styleSelectionMessage = logoMessages.find(m =>
                  m.role === "assistant" && m.content.includes("원하시는 스타일을 선택해주세요") && m.images && m.images.length > 0
                );
                if (styleSelectionMessage && styleSelectionMessage.images) {
                  setFirstRecommendations(styleSelectionMessage.images);
                  setRecommendationStep("first");
                  setSelectedFirstLogo(null);
                  setSelectedStyle(null);
                  
                  if (styleSelectionMessage.images.length > 0) {
                    setPreviewLogoImage(styleSelectionMessage.images[0]);
                    setSelectedResult({
                      type: "logo",
                      url: styleSelectionMessage.images[0],
                      index: 0
                    });
                    setHasResultPanel(true);
                  }
                } else {
                  // 메시지에 이미지가 없으면 새로 생성
                  const allImages = getLogoImagesByType(selectedLogoType || "text");
                  const recommendedLogos = getRandomLogos(allImages, 4);
                  setFirstRecommendations(recommendedLogos);
                  setRecommendationStep("first");
                  setSelectedFirstLogo(null);
                  setSelectedStyle(null);
                  
                  if (recommendedLogos.length > 0) {
                    setPreviewLogoImage(recommendedLogos[0]);
                    setSelectedResult({
                      type: "logo",
                      url: recommendedLogos[0],
                      index: 0
                    });
                    setHasResultPanel(true);
                  }
                }
              } else {
                // 첫 번째 추천 단계로 복원
                const allImages = getLogoImagesByType(selectedLogoType || "text");
                const recommendedLogos = getRandomLogos(allImages, 4);
                setFirstRecommendations(recommendedLogos);
                setRecommendationStep("first");
                setSelectedFirstLogo(null);
                setSelectedStyle(null);
                
                if (recommendedLogos.length > 0) {
                  setPreviewLogoImage(recommendedLogos[0]);
                  setSelectedResult({
                    type: "logo",
                    url: recommendedLogos[0],
                    index: 0
                  });
                  setHasResultPanel(true);
                }
              }
            }
          } else if (!fromStyle) {
            // 로고 타입 선택 메시지가 없고 from_style 모드가 아닐 때
            // DB 프로젝트 ID인지 확인 (숫자로만 이루어진 경우)
            const isDbProjectId = /^\d+$/.test(projectId);
            
            if (isDbProjectId) {
              // DB 프로젝트 ID인 경우: intro API 호출하여 브랜드 요약 정보 가져오기
              const dbProjectIdNum = parseInt(projectId);
              
              // 로딩 상태 시작 및 채팅 시작 표시
              setIsLoadingLogoIntro(true);
              setHasStartedChat(true);
              
              getLogoIntro({ project_id: dbProjectIdNum })
                .then((response) => {
                  const introMessage: Message = {
                    role: "assistant",
                    content: response.reply,
                    studioType: "logo"
                  };
                  setMessages([introMessage]);
                  setLogoMessages([introMessage]); // 로고 탭 메시지 저장
                  // projectStorage에는 저장하지 않음 (DB 프로젝트이므로)
                })
                .catch((error) => {
                  console.error('로고 intro API 호출 실패:', error);
                  toast({
                    title: "브랜드 정보 로드 실패",
                    description: "브랜드 요약 정보를 가져오는데 실패했습니다.",
                    variant: "destructive",
                  });
                  // 실패 시 기본 메시지 표시
                  const fallbackMessage: Message = {
                    role: "assistant",
                    content: `${userProfile.name}님, 로고를 만들어볼까요?`,
                    studioType: "logo"
                  };
                  setMessages([fallbackMessage]);
                  setLogoMessages([fallbackMessage]); // 로고 탭 메시지 저장
                })
                .finally(() => {
                  setIsLoadingLogoIntro(false);
                });
            } else {
              // 로컬 프로젝트인 경우: 기존 로직 사용
              // 초기 안내 메시지를 assistant 메시지로 추가
              const initialMessage: Message = {
                role: "assistant",
                content: brandInfo ? `${brandInfo.brand_name} ${brandInfo.industry}을 위한 세 가지 로고 디자인 방향을 제안해 드리겠습니다.` : "세 가지 로고 디자인 방향을 제안해 드리겠습니다.",
                images: [
                  getLogoImagesByType("text")[0] || "",
                  getLogoImagesByType("text-icon")[0] || "",
                  getLogoImagesByType("emblem")[0] || ""
                ].filter(Boolean), // 빈 문자열 제거
                studioType: "logo"
              };
              setMessages([initialMessage]);
              setLogoMessages([initialMessage]); // 로고 탭 메시지 저장
              setHasStartedChat(true);
              setLogoTypeSelected(false);
            }
          }
          
          // from_style 모드일 때는 기존 대화 전체를 표시
          if (fromStyle && studioType === "logo") {
            setMessages(chatMessages);
            setLogoMessages(chatMessages); // 로고 탭 메시지 저장
            setHasStartedChat(true);
            setLogoTypeSelected(false); // from_style 모드일 때는 항상 선택지를 보여줌
          }
          
          // 프로젝트 대화 로딩 완료 표시
          setIsChatLoaded(true);
        } else if (studioType === "short") {
          // 숏폼 스튜디오: 숏폼 스튜디오 메시지만 필터링
          const allChatMessages = project.messages.filter(m => m.role !== "system");
          const hasLogoTypeMessage = allChatMessages.some(m => 
            m.role === "user" && (m.content.includes("글씨") || m.content.includes("글씨/아이콘") || m.content.includes("엠블럼") || m.content.includes("글씨만 있는 로고") || m.content.includes("글씨랑 아이콘 있는 로고") || m.content.includes("엠블럼만 있는 로고"))
          );
          const hasShortFormMessage = allChatMessages.some(m =>
            m.role === "assistant" && (m.content.includes("이제 숏폼을 만들어 드리겠습니다") || m.content.includes("어떤 식으로 숏폼을 생성하시겠습니까?"))
          );
          
          // 숏폼 스튜디오 메시지만 필터링
          const chatMessages = allChatMessages.filter(m => {
            if (m.studioType === "short") return true;
            if (m.studioType === "logo") return false;
            // studioType이 없는 경우: 숏폼 질문 메시지가 있으면 숏폼 메시지로 간주
            if (hasShortFormMessage && !hasLogoTypeMessage) return true;
            // 둘 다 있으면 studioType이 없는 메시지는 제외 (명확하지 않으므로)
            if (hasLogoTypeMessage && hasShortFormMessage) return false;
            // 둘 다 없으면 기존 동작 유지 (숏폼으로 간주)
            return true;
          });

          // 숏폼 안내 문장이 처음 나온 위치 찾기 (새로운 흐름 또는 기존 흐름)
          const shortQuestionIndex = chatMessages.findIndex(
            (m) =>
              m.role === "assistant" &&
              (m.content.includes("이제 숏폼을 만들어 드리겠습니다") || m.content === "어떤 식으로 숏폼을 생성하시겠습니까?")
          );

          if (shortQuestionIndex !== -1) {
            // 그 이전 온보딩/JSON 메시지는 버리고, 여기부터의 대화만 사용
            const shortMessages = chatMessages.slice(shortQuestionIndex);
            setMessages(shortMessages);
            setHasStartedChat(true);

            const hasLogoListStep = shortMessages.some(
              (msg) =>
                msg.role === "assistant" &&
                msg.content === "어떤 로고로 만들까요?"
            );

            if (hasLogoListStep) {
              setShortFormQuestionStep("logoList");
            } else {
              setShortFormQuestionStep("select");
            }
            
            // 결과 패널 복원 (이미지가 있는 assistant 메시지 확인)
            const lastImageMessage = shortMessages
              .filter(m => m.role === "assistant" && m.images && m.images.length > 0)
              .pop();
            if (lastImageMessage && lastImageMessage.images && lastImageMessage.images.length > 0) {
              // 최종 생성된 숏폼이 있는 경우
              setHasResultPanel(true);
              setSelectedResult({
                type: "short",
                url: lastImageMessage.images[0],
                index: 0
              });
              setLastGeneratedShortFormUrl(lastImageMessage.images[0]);
              
              // 만족도 질문 단계 확인
              const hasSatisfactionQuestion = lastImageMessage.content.includes("마음에 드시나요?") || 
                                              lastImageMessage.content.includes("어떠신가요?");
              
              // 만족도 질문 이후에 사용자 응답이 있는지 확인
              const lastImageMessageIndex = shortMessages.indexOf(lastImageMessage);
              const messagesAfterImage = shortMessages.slice(lastImageMessageIndex + 1);
              const hasUserResponse = messagesAfterImage.some(m => m.role === "user");
              
              if (hasSatisfactionQuestion && !hasUserResponse) {
                // 만족도 질문이 있지만 아직 응답이 없는 경우
                setShortFormQuestionStep("satisfaction");
              } else {
                // 이미 응답했거나 만족도 질문이 없는 경우
                setShortFormQuestionStep(null);
              }
            }
          } else {
            // 아직 숏폼 안내가 한 번도 없던 프로젝트면, 새로 시작
            // DB 프로젝트 ID인지 확인 (숫자로만 이루어진 경우)
            const isDbProjectId = /^\d+$/.test(projectId);
            
            if (isDbProjectId) {
              // DB 프로젝트 ID인 경우: intro API 호출하여 브랜드 요약 정보 가져오기
              const dbProjectIdNum = parseInt(projectId);
              
              // 로딩 상태 시작 및 채팅 시작 표시
              setIsLoadingShortsIntro(true);
              setHasStartedChat(true);
              
              getShortsIntro({ project_id: dbProjectIdNum })
                .then((response) => {
                  const introMessage: Message = {
                    role: "assistant",
                    content: response.reply,
                    studioType: "short"
                  };
                  setMessages([introMessage]);
                  setShortMessages([introMessage]); // 숏폼 탭 메시지 저장
                  // projectStorage에는 저장하지 않음 (DB 프로젝트이므로)
                  setShortFormQuestionStep(null);
                })
                .catch((error) => {
                  console.error('숏폼 intro API 호출 실패:', error);
                  toast({
                    title: "브랜드 정보 로드 실패",
                    description: "브랜드 요약 정보를 가져오는데 실패했습니다.",
                    variant: "destructive",
                  });
                  // 실패 시 기본 메시지 표시
                  const fallbackMessage: Message = {
                    role: "assistant",
                    content: `${userProfile.name}님, 숏폼을 만들어볼까요?`,
                    studioType: "short"
                  };
                  setMessages([fallbackMessage]);
                  setShortMessages([fallbackMessage]); // 숏폼 탭 메시지 저장
                  setShortFormQuestionStep(null);
                })
                .finally(() => {
                  setIsLoadingShortsIntro(false);
                });
            } else {
              // 로컬 프로젝트인 경우: 기존 로직 사용
              // 입장 시 안내 메시지 생성
              const systemMessage = project.messages.find(m => m.role === "system");
              let brandInfoForShort: { brand_name?: string; industry?: string; mood?: string; core_keywords?: string[]; target_age?: string; target_gender?: string; avoid_trends?: string[]; slogan?: string; preferred_colors?: string[] } = {};
              
              if (systemMessage) {
                try {
                  brandInfoForShort = JSON.parse(systemMessage.content);
                } catch (e) {
                  // 파싱 실패 시 무시
                }
              }
              
              // 이전 대화 내용 요약 생성 (실제로는 ChatPage의 메시지에서 추출)
              const chatPageMessages = allChatMessages.filter(m => !m.studioType || m.studioType !== "short");
              const summaryParts: string[] = [];
              
              if (brandInfoForShort.brand_name) {
                summaryParts.push(`브랜드명: ${brandInfoForShort.brand_name}`);
              }
              if (brandInfoForShort.industry) {
                summaryParts.push(`업종: ${brandInfoForShort.industry}`);
              }
              if (brandInfoForShort.mood) {
                summaryParts.push(`분위기: ${brandInfoForShort.mood}`);
              }
              if (brandInfoForShort.core_keywords && brandInfoForShort.core_keywords.length > 0) {
                summaryParts.push(`핵심 키워드: ${brandInfoForShort.core_keywords.join(", ")}`);
              }
              
              const summaryText = summaryParts.length > 0 
                ? `방금 입력한 브랜드 정보예요.\n${summaryParts.join("\n")}`
                : "";
              
              const trendAnalysis = "최근 숏폼 트렌드 분석 결과, 짧고 임팩트 있는 영상이 주목받고 있습니다.";
              
              const welcomeMessage = summaryText 
                ? `${summaryText}\n\n${trendAnalysis}\n\n${userProfile.name}님은 어떤 것이 궁금하신가요?`
                : `${trendAnalysis}\n\n${userProfile.name}님은 어떤 것이 궁금하신가요?`;
              
              const initialMessage: Message = {
                role: "assistant",
                content: welcomeMessage,
                studioType: "short"
              };
              setMessages([initialMessage]);
              setShortMessages([initialMessage]); // 숏폼 탭 메시지 저장
              projectStorage.addMessage(projectId, initialMessage);
              setHasStartedChat(true);
              setShortFormQuestionStep(null);
            }
          }

          setSelectedLogoForShort(null);
        } else {
          setMessages(project.messages);
          setHasStartedChat(project.messages.length > 0);
        }
        
        projectStorage.setCurrentProject(projectId);
        
        // 저장된 항목 로드
        if (project.savedItems) {
          const savedLogosFromProject = project.savedItems.filter(item => item.type === "logo");
          const savedShortsFromProject = project.savedItems.filter(item => item.type === "short");
          setSavedLogos(savedLogosFromProject);
          setSavedShorts(savedShortsFromProject);
        }

        // type에 따라 해당 탭 활성화
        if (studioType === "logo") {
          setActiveStorageTab("logos");
        } else if (studioType === "short") {
          setActiveStorageTab("shorts");
        }
        
        // 프로젝트 대화 로딩 완료 표시
        setIsChatLoaded(true);
      } else {
        // 프로젝트가 없거나 로그인하지 않은 경우 isChatLoaded를 false로 유지
        setIsChatLoaded(false);
      }
    } else {
      // 프로젝트 ID가 없는 경우
      setIsChatLoaded(false);
    }

    // 프로젝트 리스트 로드
  }, [isLoggedIn, navigate, searchParams]); // studioType 제거하여 탭 전환 시 재로드 방지

  // from_style 모드일 때 프로젝트 대화 로딩 완료 후 메시지 추가
  useEffect(() => {
    if (!isChatLoaded || !fromStyle || studioType !== "logo" || !currentProjectId) {
      return;
    }

    // 선택한 로고/숏폼 정보 찾기
    let baseAssetImageUrl: string | null = null;
    if (baseAssetId && assetType) {
      const project = projectStorage.getProject(currentProjectId);
      if (project) {
        // public_logos 또는 public_shortforms에서 찾기
        if (assetType === "logo") {
          const publicLogos = JSON.parse(localStorage.getItem('public_logos') || '[]');
          const foundLogo = publicLogos.find((l: any) => String(l.id) === String(baseAssetId));
          if (foundLogo && foundLogo.imageUrl) {
            baseAssetImageUrl = foundLogo.imageUrl;
          } else {
            // 프로젝트의 savedItems에서 찾기
            if (project.savedItems) {
              const savedLogo = project.savedItems.find(item => item.type === "logo" && String(item.id) === String(baseAssetId));
              if (savedLogo) {
                baseAssetImageUrl = savedLogo.url;
              }
            }
          }
        } else if (assetType === "shortform") {
          const publicShortForms = JSON.parse(localStorage.getItem('public_shortforms') || '[]');
          const foundShortForm = publicShortForms.find((sf: any) => String(sf.id) === String(baseAssetId));
          if (foundShortForm && foundShortForm.videoUrl) {
            baseAssetImageUrl = foundShortForm.videoUrl;
          } else {
            // 프로젝트의 savedItems에서 찾기
            if (project.savedItems) {
              const savedShortForm = project.savedItems.find(item => item.type === "short" && String(item.id) === String(baseAssetId));
              if (savedShortForm) {
                baseAssetImageUrl = savedShortForm.url;
              }
            }
          }
        }
      }
    }

    // 기존 메시지에 from_style 메시지 추가
    setMessages(prev => {
      // 이미 from_style 메시지가 추가되어 있는지 확인
      const hasFromStyleMessage = prev.some(m => 
        m.role === "assistant" && 
        m.studioType === "logo" && 
        m.content === "이 스타일을 기반으로 로고를 생성해 드릴게요!"
      );
      
      if (hasFromStyleMessage) {
        // 이미 추가되어 있으면 그대로 반환
        return prev;
      }

      // 선택한 로고/숏폼 정보 메시지 추가
      const fromStyleMessage: Message = {
        role: "assistant",
        content: "이 스타일을 기반으로 로고를 생성해 드릴게요!",
        studioType: "logo",
        images: baseAssetImageUrl ? [baseAssetImageUrl] : []
      };

      // 로고 타입 선택 안내 메시지 추가
      const logoTypeSelectionMessage: Message = {
        role: "assistant",
        content: brandInfo ? `${brandInfo.brand_name} ${brandInfo.industry}을 위한 세 가지 로고 디자인 방향을 제안해 드리겠습니다.` : "세 가지 로고 디자인 방향을 제안해 드리겠습니다.",
        images: [
          getLogoImagesByType("text")[0] || "",
          getLogoImagesByType("text-icon")[0] || "",
          getLogoImagesByType("emblem")[0] || ""
        ].filter(Boolean), // 빈 문자열 제거
        studioType: "logo"
      };

      // 기존 메시지 뒤에 추가
      return [...prev, fromStyleMessage, logoTypeSelectionMessage];
    });

    // 로고 타입 선택 상태를 false로 설정하여 선택지를 보여줌
    setLogoTypeSelected(false);
  }, [isChatLoaded, fromStyle, studioType, currentProjectId, baseAssetId, assetType, brandInfo]);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 숏폼 intro 로딩 상태 변경 시 스크롤
  useEffect(() => {
    if (isLoadingShortsIntro) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [isLoadingShortsIntro]);

  // 로고 intro 로딩 상태 변경 시 스크롤
  useEffect(() => {
    if (isLoadingLogoIntro) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [isLoadingLogoIntro]);

  // 선택 버튼이 표시될 때 스크롤
  useEffect(() => {
    if (selectedSecondLogo) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [selectedSecondLogo]);

  // 숏폼 스튜디오에서 로고 선택 시 선택 버튼이 보이도록 스크롤
  useEffect(() => {
    if (selectedLogoForShort && studioType === "short") {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [selectedLogoForShort, studioType]);

  // 저장된 로고/숏폼이 있을 때 "내 프로젝트로 가기" 버튼이 표시되면 스크롤
  useEffect(() => {
    if ((savedLogos.length > 0 || savedShorts.length > 0) && currentProjectId) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 200);
    }
  }, [savedLogos.length, savedShorts.length, currentProjectId]);

  // "업로드하기" 버튼이 표시될 때 자동 스크롤
  useEffect(() => {
    if (uploadQuestionStep && selectedPlatforms.size > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    }
  }, [uploadQuestionStep, selectedPlatforms.size]);

  // 로고 타입별 이미지 파일 목록 (실제 파일 목록)
  const getLogoImagesByType = (type: "text" | "text-icon" | "emblem"): string[] => {
    const typeToFolder: Record<"text" | "text-icon" | "emblem", string> = {
      "text": "wordmark",
      "text-icon": "symbol_plus_text",
      "emblem": "emblem"
    };
    
    const folder = typeToFolder[type];
    // 실제 파일 목록 (public/logo 폴더 구조 기반)
    const imageMap: Record<string, string[]> = {
      "wordmark": [
        "/logo/wordmark/009_고선생.jpg",
        "/logo/wordmark/093_심볼_폰트_타입.jpg",
        "/logo/wordmark/page2_22.jpg",
        "/logo/wordmark/page3_29.jpg",
        "/logo/wordmark/page3_39.jpg",
        "/logo/wordmark/page4_18.jpg",
        "/logo/wordmark/page4_34.jpg",
        "/logo/wordmark/page4_48.jpg",
        "/logo/wordmark/page5_15.jpg",
        "/logo/wordmark/page5_28.jpg"
      ],
      "symbol_plus_text": [
        "/logo/symbol_plus_text/019_콩툰.jpg",
        "/logo/symbol_plus_text/020_THE_CONTROLOGY.jpg",
        "/logo/symbol_plus_text/020_wild_komb.jpg",
        "/logo/symbol_plus_text/020_명진식품.jpg",
        "/logo/symbol_plus_text/020_커네틱.jpg",
        "/logo/symbol_plus_text/021_Petinube.jpg",
        "/logo/symbol_plus_text/021_드림포유.jpg",
        "/logo/symbol_plus_text/022_교토돈부리.jpg",
        "/logo/symbol_plus_text/023_Oh__Poutine.jpg"
      ],
      "emblem": [
        "/logo/emblem/005_E_G_Yo.jpg",
        "/logo/emblem/026_Crazy_Bubble_Mall.jpg",
        "/logo/emblem/027_CTS.jpg",
        "/logo/emblem/028_와우사단_오프로드.jpg",
        "/logo/emblem/029_Royal_Crowd.jpg",
        "/logo/emblem/030_엠블럼_로고.jpg",
        "/logo/emblem/036_Elmarron.jpg",
        "/logo/emblem/page1_17.jpg",
        "/logo/emblem/page2_29.jpg"
      ]
    };
    
    return imageMap[folder] || [];
  };

  // 랜덤하게 4개 선택
  const getRandomLogos = (images: string[], count: number = 4): string[] => {
    const shuffled = [...images].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  };

  // 타입별 스타일 라벨 가져오기
  const getStyleLabelsByType = (logoType: "text" | "text-icon" | "emblem"): string[] => {
    const styleMap = {
      "text": ["캘리그라피", "얇은 선 타이포", "한글 형이상학", "영문 필기체"],
      "text-icon": ["한글 형이상학", "키치 캐릭터", "얇은 선 심볼", "힙한 무드"],
      "emblem": ["얇은 선", "키치 캐릭터", "한글 중심", "아이콘형"]
    };
    return styleMap[logoType] || [];
  };

  const handleLogoTypeSelection = (logoType: "text" | "text-icon" | "emblem", brandInfo: { brand_name: string; industry: string }) => {
    if (!currentProjectId) return;

    const logoTypeNames = {
      "text": "글씨",
      "text-icon": "글씨/아이콘",
      "emblem": "엠블럼"
    };

    // 사용자 메시지 추가
    const userMessage: Message = {
      role: "user",
      content: logoTypeNames[logoType],
      studioType: "logo"
    };
    setMessages(prev => [...prev, userMessage]);
    projectStorage.addMessage(currentProjectId, userMessage);

    // 첫 번째 추천 단계로 이동 (스타일 선택 단계)
    const allImages = getLogoImagesByType(logoType);
    const recommendedLogos = getRandomLogos(allImages, 4);
    setFirstRecommendations(recommendedLogos);
    setRecommendationStep("first");
    setSelectedFirstLogo(null);
    setSelectedStyle(null);
    
    // assistant 메시지로 4개 예시 로고 전송
    setTimeout(() => {
      const assistantMessage: Message = {
        role: "assistant",
        content: "원하시는 스타일을 선택해주세요.",
        images: recommendedLogos, // 추천 로고들을 images로 전달
        studioType: "logo"
      };
      setMessages(prev => [...prev, assistantMessage]);
      projectStorage.addMessage(currentProjectId, assistantMessage);
      
      // 첫 번째 이미지를 미리보기로 설정
      if (recommendedLogos.length > 0) {
        setPreviewLogoImage(recommendedLogos[0]);
        setSelectedResult({
          type: "logo",
          url: recommendedLogos[0],
          index: 0
        });
        setHasResultPanel(true);
      }
    }, 500);
  };

  // 첫 번째 추천에서 로고 클릭 (미리보기만)
  const handleFirstRecommendationClick = (imageUrl: string) => {
    setPreviewLogoImage(imageUrl);
    setSelectedResult({
      type: "logo",
      url: imageUrl,
      index: 0
    });
    setHasResultPanel(true);
  };

  // 첫 번째 추천에서 스타일 버튼 클릭 (다음 단계로 진행)
  const handleStyleSelection = (styleLabel: string, imageIndex: number) => {
    // firstRecommendations가 비어있으면 메시지에서 찾기
    if (firstRecommendations.length === 0) {
      const currentMessage = messages.find(m => 
        m.role === "assistant" && m.content.includes("원하시는 스타일을 선택해주세요") && m.images && m.images.length > 0
      );
      if (currentMessage && currentMessage.images) {
        setFirstRecommendations(currentMessage.images);
      }
    }
    
    if (!currentProjectId || !selectedLogoType) return;
    
    // firstRecommendations가 여전히 비어있거나 imageIndex가 범위를 벗어나면 return
    const imageToUse = firstRecommendations[imageIndex] || (messages.find(m => 
      m.role === "assistant" && m.content.includes("원하시는 스타일을 선택해주세요") && m.images && m.images.length > imageIndex
    )?.images?.[imageIndex]);
    
    if (!imageToUse) return;
    
    setSelectedStyle(styleLabel);
    setSelectedFirstLogo(imageToUse);
    
    // firstRecommendations 업데이트 (아직 업데이트되지 않았을 경우)
    if (firstRecommendations.length === 0) {
      const currentMessage = messages.find(m => 
        m.role === "assistant" && m.content.includes("원하시는 스타일을 선택해주세요") && m.images && m.images.length > 0
      );
      if (currentMessage && currentMessage.images) {
        setFirstRecommendations(currentMessage.images);
      }
    }
    
    // 자동으로 두 번째 추천 단계로 이동
    const allImages = getLogoImagesByType(selectedLogoType);
    // 선택한 이미지와 다른 이미지들 중에서 선택
    const otherImages = allImages.filter(img => img !== imageToUse);
    const recommendedLogos = getRandomLogos(otherImages, 4);
    setSecondRecommendations(recommendedLogos);
    setRecommendationStep("second");
    setSelectedSecondLogo(null);
    
    // assistant 메시지로 "선택하신 스타일을 기반으로..." 전송
    setTimeout(() => {
      const assistantMessage: Message = {
        role: "assistant",
        content: "선택하신 스타일을 기반으로 몇 가지 예시를 보여드릴게요.",
        images: recommendedLogos, // 유사 로고들을 images로 전달
        studioType: "logo"
      };
      setMessages(prev => [...prev, assistantMessage]);
      projectStorage.addMessage(currentProjectId, assistantMessage);
      
      // 첫 번째 이미지를 미리보기로 설정
      if (recommendedLogos.length > 0) {
        setPreviewLogoImage(recommendedLogos[0]);
        setSelectedResult({
          type: "logo",
          url: recommendedLogos[0],
          index: 0
        });
        setHasResultPanel(true);
      }
    }, 500);
  };


  // 두 번째 추천에서 로고 클릭 (미리보기만)
  const handleSecondRecommendationClick = (imageUrl: string) => {
    setSelectedSecondLogo(imageUrl);
    setPreviewLogoImage(imageUrl);
    setSelectedResult({
      type: "logo",
      url: imageUrl,
      index: 0
    });
    setHasResultPanel(true);
  };

  // 최종 로고 생성 함수 (추가 설명 포함)
  const generateFinalLogo = (extraDescription: string = "") => {
    if (!currentProjectId || !selectedLogoType || !selectedSecondLogo) return;
    
    const logoTypeNames = {
      "text": "글씨",
      "text-icon": "글씨/아이콘",
      "emblem": "엠블럼"
    };

    // assistant 메시지로 "이 로고 느낌을 기반으로..." 전송
    setTimeout(() => {
      const assistantMessage: Message = {
        role: "assistant",
        content: "이 로고 느낌을 기반으로 최종 로고를 생성해 드릴게요.",
        studioType: "logo"
      };
      setMessages(prev => [...prev, assistantMessage]);
      projectStorage.addMessage(currentProjectId, assistantMessage);
      
      // 실제 로고 생성
      setTimeout(() => {
        const imageCount = 2;
        const dummyImages = Array(imageCount).fill(0).map((_, i) => 
          `https://images.unsplash.com/photo-1634942537034-2531766767d1?w=400&h=400&fit=crop&crop=center&q=80&sig=${i}`
        );
        
        const aiMessage: Message = { 
          role: "assistant", 
          content: `${logoTypeNames[selectedLogoType]} 시안 ${imageCount}개를 생성했습니다. 원하시는 것을 클릭하면 크게 볼 수 있어요!`,
          images: dummyImages,
          studioType: "logo"
        };
        setMessages(prev => [...prev, aiMessage]);
        projectStorage.addMessage(currentProjectId, aiMessage);
        
        // 결과 패널 표시
        if (dummyImages.length > 0) {
          setHasResultPanel(true);
          setSelectedResult({
            type: "logo",
            url: dummyImages[0],
            index: 0
          });
        }
        
        // 추천 단계 종료
        setRecommendationStep("none");
        setIsWaitingFinalLogoDetail(false);
        setFinalLogoExtraDescription("");
      }, 800);
    }, 500);
  };

  // 두 번째 추천에서 선택 버튼 클릭 (추가 설명 요청 단계로 진행)
  const handleConfirmSecondSelection = () => {
    if (!currentProjectId || !selectedLogoType || !selectedSecondLogo) return;
    
    // 추가 설명 요청 메시지 출력
    setTimeout(() => {
      const assistantMessage: Message = {
        role: "assistant",
        content: "이 로고 느낌을 기반으로 최종 로고를 만들어 드릴게요.\n\n추가로 반영하고 싶은 내용이 있다면 자유롭게 적어주세요.\n(예: 가게 이름/영문 표기, 슬로건, 색감, 심플/귀여운/프리미엄 정도 등)\n\n특별히 없으면 '없음'이라고 입력해 주세요.",
        studioType: "logo"
      };
      setMessages(prev => [...prev, assistantMessage]);
      projectStorage.addMessage(currentProjectId, assistantMessage);
      
      // 추가 설명 대기 상태로 설정
      setIsWaitingFinalLogoDetail(true);
    }, 500);
  };


  // 사용자 응답 해석 (긍정/부정 판단)
  const interpretUserResponse = (response: string): "positive" | "negative" | "unknown" => {
    const normalized = response.toLowerCase().trim();
    
    // 긍정 키워드
    const positiveKeywords = ["좋아요", "맘에 들어", "마음에 들어", "괜찮", "좋은데", "좋네", "네 좋아요", "좋아", "만족", "괜찮아", "좋습니다", "좋아요", "괜찮습니다"];
    // 부정/재생성 키워드
    const negativeKeywords = ["별로", "다시", "재생성", "다르게", "마음에 안 들어", "다른 버전", "다시 만들어줘", "다시 만들어", "재생성해줘", "재생성해", "아니", "안 좋아", "싫어", "별로야", "별로예요"];
    
    const hasPositive = positiveKeywords.some(keyword => normalized.includes(keyword));
    const hasNegative = negativeKeywords.some(keyword => normalized.includes(keyword));
    
    if (hasPositive) return "positive";
    if (hasNegative) return "negative";
    return "unknown";
  };

  // 숏폼 생성 함수
  const generateShortForm = async (intent: string, logoUrl: string | null, isRegeneration: boolean = false) => {
    if (!currentProjectId) return;
    
    setIsGeneratingShortForm(true);
    
    // 더미 API 호출 (실제로는 API 호출)
    setTimeout(() => {
      const dummyVideoUrl = `https://videos.unsplash.com/video-${Date.now()}.mp4`;
      
      const satisfactionMessage = isRegeneration 
        ? "숏폼 시안 1개를 다시 생성했습니다. 이번에는 어떠신가요?"
        : "숏폼 시안 1개를 생성했습니다. 마음에 드시나요?";
      
      const aiMessage: Message = {
        role: "assistant",
        content: satisfactionMessage,
        images: [dummyVideoUrl],
        studioType: "short"
      };
      setMessages(prev => [...prev, aiMessage]);
      projectStorage.addMessage(currentProjectId, aiMessage);
      
      // 결과 패널 표시
      setHasResultPanel(true);
      setSelectedResult({
        type: "short",
        url: dummyVideoUrl,
        index: 0
      });
      setLastGeneratedShortFormUrl(dummyVideoUrl);
      setIsGeneratingShortForm(false);
      setShortFormQuestionStep("satisfaction");
    }, 2000);
  };

  const handleSendMessage = () => {
    if ((!inputValue.trim() && attachedImages.length === 0) || !currentProjectId) return;

    // 첫 메시지 전송 시 온보딩 숨김
    if (!hasStartedChat) {
      setHasStartedChat(true);
    }

    const userMessage: Message = { 
      role: "user", 
      content: inputValue || (attachedImages.length > 0 ? "(이미지 첨부)" : ""),
      images: attachedImages.length > 0 ? attachedImages : undefined,
      studioType: studioType || undefined
    };
    setMessages(prev => {
      const newMessages = [...prev, userMessage];
      // 탭별 메시지도 업데이트
      if (studioType === "logo") {
        setLogoMessages(newMessages);
      } else if (studioType === "short") {
        setShortMessages(newMessages);
      }
      return newMessages;
    });
    
    // 프로젝트에 메시지 저장
    projectStorage.addMessage(currentProjectId, userMessage);
    
    const currentInput = inputValue;
    const currentImages = attachedImages;
    setInputValue("");
    setAttachedImages([]);

    // 최종 로고 생성용 추가 설명 대기 중인 경우
    if (isWaitingFinalLogoDetail) {
      const extraDescription = currentInput.trim().toLowerCase() === "없음" || currentInput.trim() === "" 
        ? "" 
        : currentInput.trim();
      
      setFinalLogoExtraDescription(extraDescription);
      setIsWaitingFinalLogoDetail(false);
      
      // 최종 로고 생성
      generateFinalLogo(extraDescription);
      return;
    }

    // 더미 AI 응답
    setTimeout(() => {
      // 숏폼 스튜디오의 새로운 흐름 처리
      if (studioType === "short") {
        const previousMessages = messages.slice(0, -1);
        const lastAssistantMessage = previousMessages.length > 0 
          ? previousMessages.filter(m => m.role === "assistant").pop()
          : null;
        
        // 만족도 질문에 대한 응답인지 확인
        const isSatisfactionResponse = lastAssistantMessage && 
          (lastAssistantMessage.content.includes("마음에 드시나요?") || 
           lastAssistantMessage.content.includes("어떠신가요?"));
        
        if (isSatisfactionResponse) {
          const interpretation = interpretUserResponse(currentInput);
          
          if (interpretation === "positive") {
            // 긍정 응답
            const aiMessage: Message = {
              role: "assistant",
              content: "마음에 드셨다니 다행이에요! 저장하거나 업로드해서 활용해 보세요.",
              studioType: "short"
            };
            setMessages(prev => [...prev, aiMessage]);
            projectStorage.addMessage(currentProjectId, aiMessage);
            setShortFormQuestionStep(null);
            return;
          } else if (interpretation === "negative") {
            // 부정/재생성 요청
            const aiMessage: Message = {
              role: "assistant",
              content: "다시 만들어 드리겠습니다. 잠시만 기다려 주세요.",
              studioType: "short"
            };
            setMessages(prev => [...prev, aiMessage]);
            projectStorage.addMessage(currentProjectId, aiMessage);
            
            // 재생성
            generateShortForm(shortFormIntent, selectedLogoForShort?.url || null, true);
            return;
          } else {
            // 알 수 없는 응답 - 다시 물어보기
            const aiMessage: Message = {
              role: "assistant",
              content: "숏폼이 마음에 드시나요? (예: 좋아요, 별로예요, 다시 만들어줘 등)",
              studioType: "short"
            };
            setMessages(prev => [...prev, aiMessage]);
            projectStorage.addMessage(currentProjectId, aiMessage);
            return;
          }
        }
        
        // 입장 안내 메시지에 대한 첫 답변인지 확인
        const isFirstResponse = lastAssistantMessage && 
          lastAssistantMessage.content.includes("어떤 것이 궁금하신가요?");
        
        if (isFirstResponse) {
          // "어떤 내용으로 만들어 드릴까요?" 질문
          const aiMessage: Message = {
            role: "assistant",
            content: "어떤 내용으로 만들어 드릴까요?",
            studioType: "short"
          };
          setMessages(prev => [...prev, aiMessage]);
          projectStorage.addMessage(currentProjectId, aiMessage);
          setShortFormQuestionStep("content");
          return;
        }
        
        // "어떤 내용으로 만들어 드릴까요?"에 대한 답변인지 확인
        const isContentResponse = lastAssistantMessage && 
          lastAssistantMessage.content === "어떤 내용으로 만들어 드릴까요?";
        
        if (isContentResponse) {
          // 사용자 입력 내용 저장
          setShortFormIntent(currentInput);
          
          // 로고 여부 질문
          const aiMessage: Message = {
            role: "assistant",
            content: "이제 숏폼을 만들어 드리겠습니다. 로고가 있으신가요?",
            studioType: "short"
          };
          setMessages(prev => [...prev, aiMessage]);
          projectStorage.addMessage(currentProjectId, aiMessage);
          setShortFormQuestionStep("select");
          return;
        }
        
        // 숏폼 스튜디오에서 이미지만 첨부한 경우
        if (currentImages.length > 0 && !currentInput.trim()) {
          const aiMessage: Message = { 
            role: "assistant", 
            content: "무엇을 도와드릴까요?",
            studioType: "short"
          };
          setMessages(prev => [...prev, aiMessage]);
          projectStorage.addMessage(currentProjectId, aiMessage);
          return;
        }
        
        // 일반 메시지 처리
        const aiMessage: Message = {
          role: "assistant",
          content: "무엇을 도와드릴까요?",
          studioType: "short"
        };
        setMessages(prev => [...prev, aiMessage]);
        projectStorage.addMessage(currentProjectId, aiMessage);
        return;
      }
      
      // 로고 스튜디오는 기존 로직 유지
      const previousMessages = messages.slice(0, -1);
      const lastAssistantMessage = previousMessages.length > 0 
        ? previousMessages.filter(m => m.role === "assistant").pop()
        : null;
      
      const isRegenerationRequest = lastAssistantMessage && 
                                   lastAssistantMessage.content === "어떻게 다시 만들어드릴까요?" &&
                                   currentInput.trim();
      
      if (isRegenerationRequest) {
        const imageCount = studioType === "logo" ? 2 : 1;
        const dummyImages = Array(imageCount).fill(0).map((_, i) => 
          `https://images.unsplash.com/photo-1634942537034-2531766767d1?w=400&h=400&fit=crop&crop=center&q=80&sig=${Date.now()}_${i}`
        );
        
        const contentType = studioType === "logo" ? "로고" : "숏폼";
        const aiMessage: Message = { 
          role: "assistant", 
          content: `요청하신 내용을 반영하여 ${contentType}를 다시 생성했습니다. 원하시는 것을 클릭하면 크게 볼 수 있어요!`,
          images: dummyImages,
          studioType: studioType || undefined
        };
        setMessages(prev => [...prev, aiMessage]);
        projectStorage.addMessage(currentProjectId, aiMessage);
        
        if (dummyImages.length > 0) {
          setHasResultPanel(true);
          setSelectedResult({
            type: studioType === "logo" ? "logo" : "short",
            url: dummyImages[0],
            index: 0
          });
        }
        return;
      }

      // 이미지만 첨부한 경우 (로고 스튜디오 또는 일반 스튜디오)
      if (currentImages.length > 0 && !currentInput.trim()) {
        const aiMessage: Message = { 
          role: "assistant", 
          content: "무엇을 도와드릴까요?",
          studioType: studioType || undefined
        };
        setMessages(prev => [...prev, aiMessage]);
        projectStorage.addMessage(currentProjectId, aiMessage);
        return;
      }

      const hasLogo = currentInput.toLowerCase().includes("로고");
      const hasShort = currentInput.toLowerCase().includes("숏폼");
      
      if (studioType === "logo" && hasLogo) {
        const imageCount = 2;
        const dummyImages = Array(imageCount).fill(0).map((_, i) => 
          `https://images.unsplash.com/photo-1634942537034-2531766767d1?w=400&h=400&fit=crop&crop=center&q=80&sig=${i}`
        );
        
        const aiMessage: Message = { 
          role: "assistant", 
          content: `로고 시안 ${imageCount}개를 생성했습니다. 원하시는 것을 클릭하면 크게 볼 수 있어요!`,
          images: dummyImages,
          studioType: "logo"
        };
        setMessages(prev => [...prev, aiMessage]);
        projectStorage.addMessage(currentProjectId, aiMessage);
      } else if (!studioType && (hasLogo || hasShort)) {
        const imageCount = hasShort ? 1 : 2;
        const dummyImages = Array(imageCount).fill(0).map((_, i) => 
          `https://images.unsplash.com/photo-1634942537034-2531766767d1?w=400&h=400&fit=crop&crop=center&q=80&sig=${i}`
        );
        
        const aiMessage: Message = { 
          role: "assistant", 
          content: `${hasLogo ? "로고" : "숏폼"} 시안 ${imageCount}개를 생성했습니다. 원하시는 것을 클릭하면 크게 볼 수 있어요!`,
          images: dummyImages,
          studioType: hasLogo ? "logo" : "short"
        };
        setMessages(prev => [...prev, aiMessage]);
        projectStorage.addMessage(currentProjectId, aiMessage);
      } else {
        const aiMessage: Message = { 
          role: "assistant", 
          content: studioType === "logo" 
            ? "무엇을 도와드릴까요? '로고'를 포함해서 요청해주세요." 
            : "무엇을 도와드릴까요?",
          studioType: studioType || undefined
        };
        setMessages(prev => [...prev, aiMessage]);
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
          status: "warning",
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

  // 저장 버튼 클릭 핸들러
  const handleSave = (url: string, type: "logo" | "short", index: number) => {
    if (!currentProjectId) return;
    
    const item: SavedItem = {
      id: `${type}_${Date.now()}_${index}`,
      url,
      type,
      index,
      title: type === "logo" ? `로고 ${savedLogos.length + 1}` : `숏폼 ${savedShorts.length + 1}`,
      createdAt: new Date().toISOString(),
    };

    if (type === "logo") {
      // 프로젝트에서 현재 저장된 항목 확인
      const project = projectStorage.getProject(currentProjectId);
      if (project) {
        // 프로젝트의 savedItems에서도 중복 체크
        const existingInProject = project.savedItems?.some(saved => saved.url === url && saved.type === "logo");
        if (existingInProject) {
          toast({
            title: "이미 저장된 로고입니다",
            description: "이 로고는 이미 저장되어 있습니다.",
            status: "info",
          });
          return;
        }
      }
      
      setSavedLogos(prev => {
        // state에서도 중복 체크
        if (prev.some(saved => saved.url === url)) {
          toast({
            title: "이미 저장된 로고입니다",
            description: "이 로고는 이미 저장되어 있습니다.",
            status: "info",
          });
          return prev;
        }
        
        const updated = [...prev, item];
        
        // 프로젝트에 저장된 항목 업데이트
        if (project) {
          const allSavedItems = [...(project.savedItems || []), item];
          project.savedItems = allSavedItems;
          projectStorage.saveProject(project);
        }
        
        toast({
          title: "로고가 저장되었습니다",
          description: "하단 보관함에서 확인할 수 있습니다.",
          status: "success",
        });
        return updated;
      });
    } else {
      // 프로젝트에서 현재 저장된 항목 확인
      const project = projectStorage.getProject(currentProjectId);
      if (project) {
        // 프로젝트의 savedItems에서도 중복 체크
        const existingInProject = project.savedItems?.some(saved => saved.url === url && saved.type === "short");
        if (existingInProject) {
          toast({
            title: "이미 저장된 숏폼입니다",
            description: "이 숏폼은 이미 저장되어 있습니다.",
            status: "info",
          });
          return;
        }
      }
      
      setSavedShorts(prev => {
        // state에서도 중복 체크
        if (prev.some(saved => saved.url === url)) {
          toast({
            title: "이미 저장된 숏폼입니다",
            description: "이 숏폼은 이미 저장되어 있습니다.",
            status: "info",
          });
          return prev;
        }
        
        const updated = [...prev, item];
        
        // 프로젝트에 저장된 항목 업데이트
        if (project) {
          const allSavedItems = [...(project.savedItems || []), item];
          project.savedItems = allSavedItems;
          projectStorage.saveProject(project);
        }
        
        toast({
          title: "숏폼이 저장되었습니다",
          description: "하단 보관함에서 확인할 수 있습니다.",
          status: "success",
        });
        return updated;
      });
    }
  };

  // 저장 탭 토글 핸들러
  const handleToggleStorageTab = (tab: "logos" | "shorts") => {
    if (activeStorageTab === tab) {
      setActiveStorageTab(null);
    } else {
      setActiveStorageTab(tab);
    }
  };

  // 저장된 항목 클릭 핸들러
  const handleSavedItemClick = (item: SavedItem) => {
    setSelectedResult({
      type: item.type,
      url: item.url,
      index: item.index,
    });
    // 저장된 항목 클릭 시에는 결과 그리드 뷰를 보여주지 않음
    setHasResultPanel(false);
  };

  // 삭제 핸들러
  const handleDelete = () => {
    if (!itemToDelete || !currentProjectId) return;

    const project = projectStorage.getProject(currentProjectId);
    if (!project) return;

    // savedItems에서 제거
    const updatedSavedItems = (project.savedItems || []).filter(
      item => item.id !== itemToDelete.id
    );
    project.savedItems = updatedSavedItems;
    projectStorage.saveProject(project);

    // 상태 업데이트
    if (itemToDelete.type === "logo") {
      setSavedLogos(prev => prev.filter(item => item.id !== itemToDelete.id));
    } else {
      setSavedShorts(prev => prev.filter(item => item.id !== itemToDelete.id));
    }

    // 선택된 항목이 삭제된 항목이면 닫기
    if (selectedResult && selectedResult.url === itemToDelete.url) {
      setSelectedResult(null);
      setHasResultPanel(false);
    }

    // 공개 상태도 제거 (localStorage)
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

    setIsDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  // 삭제 버튼 클릭 핸들러
  const handleDeleteClick = () => {
    if (!selectedResult || !currentProjectId) return;

    // 현재 선택된 항목이 저장된 항목인지 확인
    const allSavedItems = [...savedLogos, ...savedShorts];
    const foundItem = allSavedItems.find(
      item => item.url === selectedResult.url && item.type === selectedResult.type
    );

    if (foundItem) {
      setItemToDelete(foundItem);
      setIsDeleteDialogOpen(true);
    } else {
      toast({
        title: "저장된 항목이 아닙니다",
        description: "저장된 항목만 삭제할 수 있습니다.",
        status: "error",
      });
    }
  };

  // 숏폼 업로드 버튼 클릭 핸들러
  const handleShortFormUpload = (url: string) => {
    const connections = checkSocialMediaConnection();
    const hasConnection = connections.instagram || connections.youtube;

    if (hasConnection) {
      // 연동된 경우 채팅창에 질문 메시지 추가
      if (currentProjectId) {
        setPendingUploadUrl(url);
        setUploadQuestionStep(url);
        setSelectedPlatforms(new Set());
        
        const questionMessage: Message = {
          role: "assistant",
          content: "업로드 하시겠습니까?",
          studioType: "short"
        };
        setMessages(prev => [...prev, questionMessage]);
        projectStorage.addMessage(currentProjectId, questionMessage);
        
        // 채팅 입력창으로 포커스 이동
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    } else {
      // 연동 안된 경우 알림 표시
      toast({
        title: "소셜 미디어 연동 필요",
        description: "숏폼을 업로드하려면 먼저 소셜 미디어 계정을 연동해주세요.",
        status: "warning",
      });
    }
  };

  // 숏폼 업로드 상태 확인 (localStorage에서)
  const getShortFormUploadStatus = (url: string) => {
    if (!currentProjectId) return { instagram: false, youtube: false };
    const project = projectStorage.getProject(currentProjectId);
    if (project && project.savedItems) {
      const shortItem = project.savedItems.find(item => item.url === url && item.type === "short");
      if (shortItem) {
        const uploadStatuses = JSON.parse(localStorage.getItem('shortFormUploadStatuses') || '{}');
        return uploadStatuses[shortItem.id] || { instagram: false, youtube: false };
      }
    }
    return { instagram: false, youtube: false };
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
    if (pendingUploadUrl) {
      const uploadStatus = getShortFormUploadStatus(pendingUploadUrl);
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
    if (pendingUploadUrl && selectedPlatforms.size > 0 && currentProjectId) {
      const platforms = Array.from(selectedPlatforms);
      const platformNames = platforms.map(p => p === "instagram" ? "Instagram" : "YouTube").join(", ");
      
      // 업로드 상태 저장 (localStorage)
      // savedItems에서 해당 URL의 숏폼 ID 찾기
      const project = projectStorage.getProject(currentProjectId);
      if (project) {
        // savedItems가 없으면 초기화
        if (!project.savedItems) {
          project.savedItems = [];
        }
        
        const shortItem = project.savedItems.find(item => item.url === pendingUploadUrl && item.type === "short");
        if (shortItem) {
          // 이미 저장된 숏폼인 경우, 업로드 상태만 업데이트
          const uploadStatuses = JSON.parse(localStorage.getItem('shortFormUploadStatuses') || '{}');
          if (!uploadStatuses[shortItem.id]) {
            uploadStatuses[shortItem.id] = { instagram: false, youtube: false };
          }
          platforms.forEach(platform => {
            uploadStatuses[shortItem.id][platform as "instagram" | "youtube"] = true;
          });
          localStorage.setItem('shortFormUploadStatuses', JSON.stringify(uploadStatuses));
        } else {
          // 아직 저장되지 않은 숏폼인 경우, 새로 저장하면서 업로드 상태도 저장
          const newShortItem: SavedItem = {
            id: `short_${Date.now()}_${savedShorts.length}`,
            url: pendingUploadUrl,
            type: "short",
            index: savedShorts.length,
            title: `숏폼 ${savedShorts.length + 1}`,
            createdAt: new Date().toISOString(),
          };
          
          const uploadStatuses = JSON.parse(localStorage.getItem('shortFormUploadStatuses') || '{}');
          uploadStatuses[newShortItem.id] = { instagram: false, youtube: false };
          platforms.forEach(platform => {
            uploadStatuses[newShortItem.id][platform as "instagram" | "youtube"] = true;
          });
          localStorage.setItem('shortFormUploadStatuses', JSON.stringify(uploadStatuses));
          
          // 프로젝트에 저장
          const allSavedItems = [...(project.savedItems || []), newShortItem];
          project.savedItems = allSavedItems;
          projectStorage.saveProject(project);
          
          setSavedShorts(prev => {
            if (prev.some(saved => saved.url === pendingUploadUrl)) {
              return prev;
            }
            return [...prev, newShortItem];
          });
        }
      }
      
      // 실제 업로드 로직 (여기서는 더미)
      toast({
        title: "업로드 완료",
        description: `숏폼이 ${platformNames}에 성공적으로 업로드되었습니다.`,
        status: "success",
      });
      
      // 채팅창에 확인 메시지 추가
      const confirmMessage: Message = {
        role: "assistant",
        content: "업로드가 완료되었습니다.",
        studioType: "short"
      };
      setMessages(prev => [...prev, confirmMessage]);
      projectStorage.addMessage(currentProjectId, confirmMessage);
      
      // 스크롤
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
      
      // 상태 초기화
      setPendingUploadUrl(null);
      setUploadQuestionStep(null);
      setSelectedPlatforms(new Set());
    }
  };


  const currentLoggedIn = localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true';
  if (!currentLoggedIn) {
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
        userAvatar={userProfile.avatar}
        instagramConnected={userProfile.instagram}
        youtubeConnected={userProfile.youtube}
      />

      {/* Main Content - Flipped: Canvas Left, Chat Right */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Main Canvas - Results Display */}
          <ResizablePanel defaultSize={70} minSize={60} maxSize={85}>
            <div className="h-full flex flex-col bg-background">
              {/* 스튜디오 타입 전환 탭 */}
              {currentProjectId && (
                <div className="border-b border-border bg-background flex-shrink-0 relative">
                  {/* from_style 모드일 때 상단 문구 표시 */}
                  {fromStyleMode && studioType === "logo" && (
                    <div className="absolute top-0 left-0 right-0 py-2 text-center z-10">
                      <p className="text-sm font-semibold text-foreground">
                        이 로고 느낌을 기반으로 로고를 생성해 드릴게요!
                      </p>
                    </div>
                  )}
                  <div className={`h-full flex items-center justify-center px-4 ${fromStyleMode && studioType === "logo" ? "pt-10" : "py-3"}`}>
                    <Tabs value={studioType || "logo"} onValueChange={(value) => {
                      if (currentProjectId) {
                        const fromStyleParam = fromStyleMode && baseAssetType && baseAssetId
                          ? `&from_style=true&baseAssetType=${baseAssetType}&baseAssetId=${baseAssetId}`
                          : "";
                        navigate(`/studio?project=${currentProjectId}&type=${value}${fromStyleParam}`);
                      }
                    }}>
                      <div className="flex items-center gap-2">
                        <TabsList className="grid grid-cols-2">
                          <TabsTrigger 
                            value="logo" 
                            className="data-[state=active]:text-white data-[state=active]:bg-[#7C22C8] flex items-center gap-2"
                          >
                            <Image className="h-4 w-4" />
                            로고 스튜디오
                          </TabsTrigger>
                          <TabsTrigger 
                            value="short" 
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2"
                          >
                            <Video className="h-4 w-4" />
                            숏폼 스튜디오
                          </TabsTrigger>
                        </TabsList>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                                <Info className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="text-sm space-y-2">
                                <p className="font-semibold text-foreground">
                                  AI 생성물 이용 안내
                                </p>
                                <p className="text-muted-foreground">
                                  AI 생성물의 내용과 활용에 대한 책임은 이용자에게 있으며,<br />
                                  회사는 이에 대해 법적 책임을 지지 않습니다.
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </Tabs>
                  </div>
                </div>
              )}
              {/* 메인 콘텐츠 영역 */}
              <div className="flex-1 min-h-0 overflow-hidden">
                {!hasResultPanel && !selectedResult ? (
                  // Empty State - 완전히 비어있음
                  <div className="h-full" />
                ) : selectedResult ? (
                // Single Selected Result View
                <div className="h-full flex flex-col">
                  <div className="p-4 flex items-center justify-between flex-shrink-0">
                    <h2 className="text-lg font-semibold">
                      {selectedResult.type === "logo" ? "로고" : "숏폼"} #{selectedResult.index + 1}
                    </h2>
                    <div className="flex items-center gap-2">
                      {/* 저장된 항목인지 확인 */}
                      {[...savedLogos, ...savedShorts].some(
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
                    {selectedResult.type === "short" ? (
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
                        {/* Hover Overlay - 버튼들 (재생성 버튼 제거) */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg pointer-events-none">
                          <div className="flex flex-col gap-2 justify-center items-center pointer-events-auto">
                            <Button 
                              size="sm" 
                              variant="secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSave(selectedResult.url, "short", selectedResult.index);
                              }}
                              className="bg-background/90 hover:bg-background"
                            >
                              <Star className="h-4 w-4 mr-2" />
                              저장
                            </Button>
                            <Button 
                              size="sm" 
                              variant="secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShortFormUpload(selectedResult.url);
                              }}
                              className="bg-background/90 hover:bg-background"
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              업로드
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className={`relative max-w-full max-h-full ${recommendationStep === "none" ? "group" : ""}`}>
                        <img 
                          src={selectedResult.url} 
                          alt={`로고 ${selectedResult.index + 1}`}
                          className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                        />
                        {/* Hover Overlay - 추천 단계가 아닐 때만 표시 (최종 생성된 로고에만) */}
                        {recommendationStep === "none" && (
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                            <div className="flex flex-wrap gap-2 justify-center items-center">
                              <Button 
                                size="sm" 
                                variant="secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // 재생성 버튼 클릭: assistant 메시지로 질문만 표시 (이미지 제외)
                                  if (selectedResult?.url && currentProjectId) {
                                    // "어떻게 다시 만들어드릴까요?" 질문을 assistant 메시지로 전송 (이미지 없이)
                                    const questionMessage: Message = {
                                      role: "assistant",
                                      content: "어떻게 다시 만들어드릴까요?",
                                      studioType: selectedResult.type === "short" ? "short" : "logo"
                                    };
                                    setMessages(prev => [...prev, questionMessage]);
                                    projectStorage.addMessage(currentProjectId, questionMessage);
                                    // 채팅 입력창으로 포커스 이동
                                    setTimeout(() => {
                                      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                                    }, 100);
                                  }
                                }}
                                className="bg-background/90 hover:bg-background"
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                재생성
                              </Button>
                              <Button 
                                size="sm" 
                              variant="secondary"
                              onClick={() => handleSave(selectedResult.url, "logo", selectedResult.index)}
                              className="bg-background/90 hover:bg-background"
                            >
                              <Star className="h-4 w-4 mr-2" />
                              저장
                            </Button>
                          </div>
                        </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                ) : (
                  // Results Grid View
                  <>
                    {/* Results Header */}
                    <div className="p-4 flex items-center justify-between flex-shrink-0">
                      <h2 className="text-lg font-semibold">결과</h2>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setHasResultPanel(false)}
                        className="hover:bg-transparent"
                      >
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        결과 닫기
                      </Button>
                    </div>

                    {/* Tabs */}
                    <Tabs defaultValue={studioType === "short" ? "shorts" : "logos"} className="flex-1 flex flex-col overflow-hidden">
                      <TabsList className="mx-4 mt-4 flex-shrink-0">
                        {(!studioType || studioType === "logo") && (
                          <TabsTrigger value="logos">로고</TabsTrigger>
                        )}
                        {(!studioType || studioType === "short") && (
                          <TabsTrigger value="shorts">숏폼</TabsTrigger>
                        )}
                        {!studioType && (
                          <TabsTrigger value="others">기타</TabsTrigger>
                        )}
                      </TabsList>

                      {(!studioType || studioType === "logo") && (
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
                                        onClick={() => {
                                          const dummyUrl = `https://images.unsplash.com/photo-1634942537034-2531766767d1?w=400&h=400&fit=crop&crop=center&q=80&sig=${item}`;
                                          handleSave(dummyUrl, "logo", item - 1);
                                        }}
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
                      )}

                      {(!studioType || studioType === "short") && (
                        <TabsContent value="shorts" className="flex-1 overflow-y-auto p-4 mt-0">
                        </TabsContent>
                      )}

                      {!studioType && (
                        <TabsContent value="others" className="flex-1 overflow-y-auto p-4 mt-0">
                          <div className="text-center text-muted-foreground py-12">
                            아직 생성된 결과가 없습니다.
                          </div>
                        </TabsContent>
                      )}
                    </Tabs>
                  </>
                )}
              </div>

              {/* 하단 고정: 썸네일 줄과 버튼 */}
              <div className="flex-shrink-0 bg-background">
                {/* 썸네일 줄 */}
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
                              style={selectedResult?.url === logo.url && selectedResult?.type === "logo" && studioType === "logo" ? { borderColor: '#7C22C8' } : selectedResult?.url === logo.url && selectedResult?.type === "logo" ? {} : {}}
                              onMouseEnter={(e) => {
                                if (!(selectedResult?.url === logo.url && selectedResult?.type === "logo")) {
                                  if (studioType === "logo") {
                                    e.currentTarget.style.borderColor = '#7C22C8';
                                    e.currentTarget.style.opacity = '0.5';
                                  }
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!(selectedResult?.url === logo.url && selectedResult?.type === "logo")) {
                                  if (studioType === "logo") {
                                    e.currentTarget.style.borderColor = '';
                                    e.currentTarget.style.opacity = '';
                                  }
                                }
                              }}
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
                
                {/* 버튼 영역 */}
                <div className="flex justify-center gap-2 pb-6">
                  {(!studioType || studioType === "logo") && (
                    <Button
                      variant={activeStorageTab === "logos" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleToggleStorageTab("logos")}
                      className={activeStorageTab === "logos" && studioType === "logo" ? "text-white" : activeStorageTab === "logos" ? "bg-[#7C22C8] hover:bg-[#6B1DB5] text-white" : "hover:bg-[#7C22C8] hover:text-white hover:border-[#7C22C8]"}
                      style={activeStorageTab === "logos" && studioType === "logo" ? { backgroundColor: '#7C22C8' } : {}}
                      onMouseEnter={(e) => {
                        if (activeStorageTab === "logos" && studioType === "logo") {
                          e.currentTarget.style.backgroundColor = '#6B1DB5';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (activeStorageTab === "logos" && studioType === "logo") {
                          e.currentTarget.style.backgroundColor = '#7C22C8';
                        }
                      }}
                    >
                      <FolderOpen className="h-4 w-4 mr-2" />
                      로고 보관함
                    </Button>
                  )}
                  {(!studioType || studioType === "short") && (
                    <Button
                      variant={activeStorageTab === "shorts" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleToggleStorageTab("shorts")}
                      className={activeStorageTab === "shorts" ? "bg-primary hover:bg-primary/90 text-primary-foreground" : ""}
                    >
                      <FolderOpen className="h-4 w-4 mr-2" />
                      숏폼 보관함
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle className="w-1 bg-transparent hover:bg-transparent" withHandle />

          {/* Right Chat Panel */}
          <ResizablePanel defaultSize={30} minSize={15} maxSize={40}>
            <div className="h-full p-4">
              <div className="h-full flex flex-col rounded-2xl bg-studio-chat-panel border border-border shadow-lg overflow-hidden">
              {/* Messages container */}
              <div className="flex-1 overflow-y-auto p-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
                <div className="space-y-3">


                  {/* Onboarding Message - intro 로딩 중일 때는 표시하지 않음 */}
                  {!hasStartedChat && studioType !== "logo" && !isLoadingShortsIntro && (
                    <div className="mb-6">
                      <p className="text-xs text-muted-foreground mb-3">Nov 16, 2025</p>
                      <div className="flex justify-start">
                        <Card className="max-w-[80%] p-4 bg-muted">
                          <p className="whitespace-pre-wrap">안녕하세요! MAKERY에 오신 것을 환영합니다.</p>
                        </Card>
                      </div>
                    </div>
                  )}

                  {/* 숏폼 Intro 로딩 인디케이터 */}
                  {isLoadingShortsIntro && studioType === "short" && (
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

                  {/* 로고 Intro 로딩 인디케이터 */}
                  {isLoadingLogoIntro && studioType === "logo" && (
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

                  {/* Chat Messages */}
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
                      {/* 텍스트 메시지가 있을 때만 말풍선 표시 */}
                      {message.content && message.content.trim() && (
                        <div className={`flex items-end gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                          <Card
                            className={`max-w-[80%] p-4 ${
                              message.role === "user"
                                ? "text-white border-0"
                                : "bg-muted"
                            }`}
                            style={message.role === "user" && studioType === "logo" ? { backgroundColor: '#7C22C8' } : message.role === "user" && studioType === "short" ? { backgroundColor: '#FF8A3D' } : undefined}
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
                            <div className="flex items-center gap-2">
                              <p className="whitespace-pre-wrap">{message.content}</p>
                              {isGeneratingShortForm && 
                               (message.content.includes("잠시만 기다려 주세요") || message.content.includes("다시 만들어 드리겠습니다")) && (
                                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                              )}
                            </div>
                          </Card>
                        </div>
                      )}
                      
                      {/* 업로드 완료 메시지 아래 "내 프로젝트로 가기" 버튼 */}
                      {message.role === "assistant" && 
                       message.content === "업로드가 완료되었습니다." &&
                       currentProjectId && (
                        <div className="flex justify-start mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`font-medium text-sm border border-neutral-300 dark:border-neutral-700 transition-colors ${
                              studioType === "logo" 
                                ? "hover:bg-[#7C22C8] hover:text-white hover:border-[#7C22C8]"
                                : "hover:bg-primary hover:text-white hover:border-primary"
                            }`}
                            onClick={() => {
                              if (currentProjectId) {
                                navigate(`/project?project=${currentProjectId}`);
                              }
                            }}
                          >
                            내 프로젝트로 가기
                          </Button>
                        </div>
                      )}
                      
                      {/* 숏폼 생성 방식 선택 버튼 */}
                      {message.role === "assistant" && 
                       message.content === "이제 숏폼을 만들어 드리겠습니다. 로고가 있으신가요?" && 
                       shortFormQuestionStep === "select" && (
                        <div className="flex justify-start mt-2">
                          <div className="max-w-[80%] w-full space-y-2">
                            <Button
                              variant="outline"
                              className="w-full h-auto py-4 justify-start"
                              onClick={() => {
                                if (!currentProjectId) return;
                                if (savedLogos.length > 0) {
                                  // 로고 목록 단계로 이동
                                  setShortFormQuestionStep("logoList");
                                  const userMessage: Message = {
                                    role: "user",
                                    content: "생성된 로고로 만들기",
                                    studioType: "short"
                                  };
                                  setMessages(prev => [...prev, userMessage]);
                                  projectStorage.addMessage(currentProjectId, userMessage);
                                  
                                  // 로고 목록 메시지 추가
                                  setTimeout(() => {
                                    const logoListMessage: Message = {
                                      role: "assistant",
                                      content: "어떤 로고로 만들까요?",
                                      studioType: "short"
                                    };
                                    setMessages(prev => [...prev, logoListMessage]);
                                    projectStorage.addMessage(currentProjectId, logoListMessage);
                                  }, 500);
                                } else {
                                  toast({
                                    title: "저장된 로고가 없습니다",
                                    description: "먼저 로고를 생성하고 저장해주세요.",
                                    status: "warning",
                                  });
                                }
                              }}
                            >
                              <div className="flex flex-col items-start gap-1">
                                <span className="font-semibold">생성된 로고로 만들기</span>
                                <span className="text-sm text-muted-foreground">저장된 로고를 사용하여 숏폼을 생성합니다</span>
                              </div>
                            </Button>
                            <Button
                              variant="outline"
                              className="w-full h-auto py-4 justify-start"
                              onClick={() => {
                                if (!currentProjectId) return;
                                setSelectedLogoForShort(null);
                                const userMessage: Message = {
                                  role: "user",
                                  content: "생성된 로고 없이 만들기",
                                  studioType: "short"
                                };
                                setMessages(prev => [...prev, userMessage]);
                                projectStorage.addMessage(currentProjectId, userMessage);
                                
                                // 생성 안내 메시지 추가
                                setTimeout(() => {
                                  const confirmMessage: Message = {
                                    role: "assistant",
                                    content: "로고 없이 숏폼을 생성하겠습니다. 잠시만 기다려 주세요.",
                                    studioType: "short"
                                  };
                                  setMessages(prev => [...prev, confirmMessage]);
                                  projectStorage.addMessage(currentProjectId, confirmMessage);
                                  
                                  // 숏폼 생성 시작
                                  generateShortForm(shortFormIntent, null);
                                }, 500);
                              }}
                            >
                              <div className="flex flex-col items-start gap-1">
                                <span className="font-semibold">생성된 로고 없이 만들기</span>
                                <span className="text-sm text-muted-foreground">로고 없이 숏폼만 생성합니다</span>
                              </div>
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {/* 로고 목록 표시 */}
                      {message.role === "assistant" && 
                       message.content === "어떤 로고로 만들까요?" && 
                       shortFormQuestionStep === "logoList" && (
                        <div className="flex justify-start mt-2">
                          <div className="max-w-[80%] w-full">
                            <div className="grid grid-cols-2 gap-4">
                              {savedLogos.map((logo) => (
                                <div
                                  key={logo.id}
                                  onClick={() => {
                                    setSelectedLogoForShort(logo);
                                    // 왼쪽에 미리보기 표시
                                    setSelectedResult({
                                      type: "logo",
                                      url: logo.url,
                                      index: 0
                                    });
                                    setHasResultPanel(true);
                                  }}
                                  className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                                    selectedLogoForShort?.id === logo.id
                                      ? "border-2 border-primary shadow-md"
                                      : studioType === "logo" ? "border-border" : "border-border hover:border-primary/50"
                                  }`}
                                  onMouseEnter={(e) => {
                                    if (selectedLogoForShort?.id !== logo.id && studioType === "logo") {
                                      e.currentTarget.style.borderColor = '#7C22C8';
                                      e.currentTarget.style.opacity = '0.5';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (selectedLogoForShort?.id !== logo.id && studioType === "logo") {
                                      e.currentTarget.style.borderColor = '';
                                      e.currentTarget.style.opacity = '';
                                    }
                                  }}
                                >
                                  <img
                                    src={logo.url}
                                    alt={logo.title}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ))}
                            </div>
                            {/* 선택 버튼 - 선택된 로고가 있을 때만 표시 */}
                            {selectedLogoForShort && (
                              <div className="mt-4 flex justify-start">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={`font-medium text-sm border border-neutral-300 dark:border-neutral-700 transition-colors ${
                                    studioType === "logo" 
                                      ? "hover:bg-[#7C22C8] hover:text-white hover:border-[#7C22C8]"
                                      : "hover:bg-primary hover:text-white hover:border-primary"
                                  }`}
                                  onClick={() => {
                                    if (!currentProjectId || !selectedLogoForShort) return;
                                    const userMessage: Message = {
                                      role: "user",
                                      content: selectedLogoForShort.title || "로고 선택",
                                      studioType: "short"
                                    };
                                    setMessages(prev => [...prev, userMessage]);
                                    projectStorage.addMessage(currentProjectId, userMessage);
                                    
                                    // 생성 안내 메시지 추가
                                    setTimeout(() => {
                                      const confirmMessage: Message = {
                                        role: "assistant",
                                        content: `선택하신 로고로 숏폼을 생성하겠습니다. 잠시만 기다려 주세요.`,
                                        studioType: "short"
                                      };
                                      setMessages(prev => [...prev, confirmMessage]);
                                      projectStorage.addMessage(currentProjectId, confirmMessage);
                                      setShortFormQuestionStep(null);
                                      
                                      // 숏폼 생성 시작
                                      generateShortForm(shortFormIntent, selectedLogoForShort.url);
                                    }, 500);
                                  }}
                                >
                                  선택
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* 업로드 질문 및 플랫폼 선택 */}
                      {message.role === "assistant" && 
                       message.content === "업로드 하시겠습니까?" && 
                       uploadQuestionStep === pendingUploadUrl && (() => {
                        const connections = checkSocialMediaConnection();
                        const uploadStatus = pendingUploadUrl ? getShortFormUploadStatus(pendingUploadUrl) : { instagram: false, youtube: false };
                        return (
                          <div className="flex justify-start mt-2">
                            <div className="max-w-[80%] w-full space-y-3">
                              <div className="flex gap-3 items-start">
                                {/* Instagram Card */}
                                <div className="flex flex-col items-center gap-1">
                                <Card
                                  className={`relative cursor-pointer transition-all border-2 ${
                                    selectedPlatforms.has("instagram")
                                      ? "border-[#FF8A3D] shadow-md"
                                      : "border-border hover:border-primary/50"
                                  } ${
                                    !connections.instagram || uploadStatus.instagram ? "opacity-50 cursor-not-allowed" : ""
                                  }`}
                                  onClick={() => {
                                    if (connections.instagram && !uploadStatus.instagram) {
                                      handlePlatformToggle("instagram");
                                    }
                                  }}
                                >
                                  <CardContent className="p-4 flex flex-col items-center gap-2 min-w-[120px]">
                                    {/* 선택 표시 (빈 회색에 체크표시, 선택 시 주황색) */}
                                      <div className={`absolute top-2 left-2 h-4 w-4 rounded-full border transition-colors flex items-center justify-center ${
                                      selectedPlatforms.has("instagram")
                                          ? "bg-[#FF8A3D] border-[#FF8A3D]"
                                          : "bg-transparent dark:bg-neutral-700 border-neutral-400 dark:border-neutral-600"
                                    }`}>
                                      {selectedPlatforms.has("instagram") && (
                                        <Check className="h-2.5 w-2.5 text-white" />
                                      )}
                                    </div>
                                      <img
                                        src="/icon/instagram-logo.png"
                                        alt="Instagram"
                                        className="h-8 w-8 object-contain"
                                      />
                                    <span className="text-sm font-medium">instagram</span>
                                  </CardContent>
                                </Card>
                                  {uploadStatus.instagram && (
                                    <span className="text-xs text-muted-foreground mt-1">(이미 업로드됨)</span>
                                  )}
                                </div>
                                
                                {/* YouTube Card */}
                                <div className="flex flex-col items-center gap-1">
                                <Card
                                  className={`relative cursor-pointer transition-all border-2 ${
                                    selectedPlatforms.has("youtube")
                                      ? "border-[#FF8A3D] shadow-md"
                                      : "border-border hover:border-primary/50"
                                  } ${
                                    !connections.youtube || uploadStatus.youtube ? "opacity-50 cursor-not-allowed" : ""
                                  }`}
                                  onClick={() => {
                                    if (connections.youtube && !uploadStatus.youtube) {
                                      handlePlatformToggle("youtube");
                                    }
                                  }}
                                >
                                  <CardContent className="p-4 flex flex-col items-center gap-2 min-w-[120px]">
                                    {/* 선택 표시 (빈 회색에 체크표시, 선택 시 주황색) */}
                                      <div className={`absolute top-2 left-2 h-4 w-4 rounded-full border transition-colors flex items-center justify-center ${
                                      selectedPlatforms.has("youtube")
                                          ? "bg-[#FF8A3D] border-[#FF8A3D]"
                                          : "bg-transparent dark:bg-neutral-700 border-neutral-400 dark:border-neutral-600"
                                    }`}>
                                      {selectedPlatforms.has("youtube") && (
                                        <Check className="h-2.5 w-2.5 text-white" />
                                      )}
                                    </div>
                                      <img
                                        src="/icon/youtube-logo.png"
                                        alt="YouTube"
                                        className="h-8 w-8 object-contain"
                                      />
                                    <span className="text-sm font-medium">youtube</span>
                                  </CardContent>
                                </Card>
                                  {uploadStatus.youtube && (
                                    <span className="text-xs text-muted-foreground mt-1">(이미 업로드됨)</span>
                                  )}
                                </div>
                              </div>
                              
                              {/* 업로드하기 버튼 */}
                              {selectedPlatforms.size > 0 && (
                                <div className="flex justify-center">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="font-medium border-neutral-300 dark:border-neutral-700"
                                    onClick={() => {
                                      handleConfirmUpload();
                                    }}
                                  >
                                    업로드하기
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                      
                      {/* 이미지 그리드 영역 - 말풍선 밖으로 분리 (assistant 메시지) */}
                      {message.role === "assistant" && message.images && message.images.length > 0 && (() => {
                        const isShort = message.content.includes("숏폼") || (studioType === "short" && message.content === "어떻게 다시 만들어드릴까요?");
                        const isLogoTypeSelection = message.content.includes("세 가지 로고 디자인 방향");
                        const isStyleSelectionStep = message.content.includes("원하시는 스타일을 선택해주세요");
                        const isRecommendationStep = message.content.includes("선택하신 스타일을 기반으로") || 
                                                     message.content.includes("선택하신 로고와 유사한") ||
                                                     message.content.includes("예시를 보여드릴게요") ||
                                                     message.content.includes("로고들을 더 보여드릴게요");
                        const isFirstRecommendation = message.content.includes("선택하신 스타일을 기반으로");
                        const isSecondRecommendation = message.content.includes("선택하신 로고와 유사한");
                        
                        // 로고 타입 선택 카드 렌더링
                        if (isLogoTypeSelection && message.images.length === 3 && brandInfo) {
                          return (
                            <div className="flex justify-start mt-2">
                              <div className="max-w-[80%] w-full">
                                <div className="grid grid-cols-3 gap-3">
                                  {/* 글씨만 있는 로고 */}
                                  <div className="flex flex-col gap-2">
                                    <Card 
                                      className="border-border overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => {
                                        if (message.images[0]) {
                                          setPreviewLogoImage(message.images[0]);
                                          setSelectedResult({
                                            type: "logo",
                                            url: message.images[0],
                                            index: 0
                                          });
                                          setHasResultPanel(true);
                                        }
                                      }}
                                    >
                                      <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                                        <img 
                                          src={message.images[0] || "/placeholder.svg"} 
                                          alt="글씨만 있는 로고"
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    </Card>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className={`w-full font-medium text-sm border transition-colors ${
                                        selectedLogoType === "text"
                                          ? "bg-[#7C22C8] text-white border-[#7C22C8] hover:bg-[#6B1DB5] hover:border-[#6B1DB5]"
                                          : "border-neutral-300 dark:border-neutral-700 hover:bg-[#7C22C8] hover:text-white hover:border-[#7C22C8]"
                                      }`}
                                      onClick={() => {
                                        setSelectedLogoType("text");
                                        setLogoTypeSelected(true);
                                        setHasStartedChat(true);
                                        handleLogoTypeSelection("text", brandInfo);
                                      }}
                                    >
                                      글씨
                                    </Button>
                                  </div>
                                  {/* 글씨랑 아이콘 있는 로고 */}
                                  <div className="flex flex-col gap-2">
                                    <Card 
                                      className="border-border overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => {
                                        if (message.images[1]) {
                                          setPreviewLogoImage(message.images[1]);
                                          setSelectedResult({
                                            type: "logo",
                                            url: message.images[1],
                                            index: 0
                                          });
                                          setHasResultPanel(true);
                                        }
                                      }}
                                    >
                                      <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                                        <img 
                                          src={message.images[1] || "/placeholder.svg"} 
                                          alt="글씨랑 아이콘 있는 로고"
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    </Card>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className={`w-full font-medium text-sm border transition-colors ${
                                        selectedLogoType === "text-icon"
                                          ? "bg-[#7C22C8] text-white border-[#7C22C8] hover:bg-[#6B1DB5] hover:border-[#6B1DB5]"
                                          : "border-neutral-300 dark:border-neutral-700 hover:bg-[#7C22C8] hover:text-white hover:border-[#7C22C8]"
                                      }`}
                                      onClick={() => {
                                        setSelectedLogoType("text-icon");
                                        setLogoTypeSelected(true);
                                        setHasStartedChat(true);
                                        handleLogoTypeSelection("text-icon", brandInfo);
                                      }}
                                    >
                                      글씨/아이콘
                                    </Button>
                                  </div>
                                  {/* 엠블럼만 있는 로고 */}
                                  <div className="flex flex-col gap-2">
                                    <Card 
                                      className="border-border overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => {
                                        if (message.images[2]) {
                                          setPreviewLogoImage(message.images[2]);
                                          setSelectedResult({
                                            type: "logo",
                                            url: message.images[2],
                                            index: 0
                                          });
                                          setHasResultPanel(true);
                                        }
                                      }}
                                    >
                                      <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                                        <img 
                                          src={message.images[2] || "/placeholder.svg"} 
                                          alt="엠블럼만 있는 로고"
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    </Card>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className={`w-full font-medium text-sm border transition-colors ${
                                        selectedLogoType === "emblem"
                                          ? "bg-[#7C22C8] text-white border-[#7C22C8] hover:bg-[#6B1DB5] hover:border-[#6B1DB5]"
                                          : "border-neutral-300 dark:border-neutral-700 hover:bg-[#7C22C8] hover:text-white hover:border-[#7C22C8]"
                                      }`}
                                      onClick={() => {
                                        setSelectedLogoType("emblem");
                                        setLogoTypeSelected(true);
                                        setHasStartedChat(true);
                                        handleLogoTypeSelection("emblem", brandInfo);
                                      }}
                                    >
                                      엠블럼
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        
                        // 스타일 선택 단계 (1차 예시) - 이미지 아래에 스타일 버튼
                        if (isStyleSelectionStep && message.images.length === 4 && selectedLogoType) {
                          // firstRecommendations가 비어있으면 메시지의 images로 설정
                          if (firstRecommendations.length === 0 && message.images.length > 0) {
                            setFirstRecommendations(message.images);
                          }
                          
                          const styleLabels = getStyleLabelsByType(selectedLogoType);
                          return (
                            <div className="flex justify-start mt-2">
                              <div className="max-w-[80%] w-full">
                                <div className="grid grid-cols-2 gap-3">
                                  {message.images.map((img, imgIndex) => {
                                    const styleLabel = styleLabels[imgIndex] || "";
                                    const isStyleSelected = selectedStyle === styleLabel;
                                    
                                    return (
                                      <div key={imgIndex} className="flex flex-col gap-2">
                                        <Card
                                          className={`border-border overflow-hidden cursor-pointer hover:opacity-90 transition-opacity ${
                                            isStyleSelected
                                              ? "border-2 shadow-md"
                                              : ""
                                          }`}
                                          style={isStyleSelected ? { borderColor: '#7C22C8' } : {}}
                                          onMouseEnter={(e) => {
                                            if (!isStyleSelected && studioType === "logo") {
                                              e.currentTarget.style.borderColor = '#7C22C8';
                                              e.currentTarget.style.opacity = '0.9';
                                            }
                                          }}
                                          onMouseLeave={(e) => {
                                            if (!isStyleSelected && studioType === "logo") {
                                              e.currentTarget.style.borderColor = '';
                                              e.currentTarget.style.opacity = '';
                                            }
                                          }}
                                          onClick={() => handleFirstRecommendationClick(img)}
                                        >
                                          <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                                            <img 
                                              src={img} 
                                              alt={`스타일 예시 ${imgIndex + 1}`}
                                              className="w-full h-full object-cover"
                                            />
                                          </div>
                                        </Card>
                                        <Button
                                          variant={isStyleSelected ? "default" : "ghost"}
                                          size="sm"
                                          className={`w-full font-medium text-sm border border-neutral-300 dark:border-neutral-700 ${isStyleSelected && studioType === "logo" ? "text-white" : ""}`}
                                          style={isStyleSelected && studioType === "logo" ? { backgroundColor: '#7C22C8' } : undefined}
                                          onMouseEnter={(e) => {
                                            if (!isStyleSelected && studioType === "logo") {
                                              e.currentTarget.style.backgroundColor = '#7C22C8';
                                              e.currentTarget.style.borderColor = '#7C22C8';
                                              e.currentTarget.style.color = 'white';
                                            }
                                          }}
                                          onMouseLeave={(e) => {
                                            if (!isStyleSelected && studioType === "logo") {
                                              e.currentTarget.style.backgroundColor = '';
                                              e.currentTarget.style.borderColor = '';
                                              e.currentTarget.style.color = '';
                                            }
                                          }}
                                          onClick={() => handleStyleSelection(styleLabel, imgIndex)}
                                        >
                                          {styleLabel}
                                        </Button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        }
                        
                        // 일반 이미지 그리드 렌더링 (2차 추천 단계, 최종 생성 결과)
                        return (
                          <div className="flex justify-start mt-2">
                            <div className="max-w-[80%] w-full">
                              <div className="grid grid-cols-2 gap-2">
                                {message.images.map((img, imgIndex) => {
                                  // 추천 단계인 경우: 오버레이 없이 선택 가능한 카드
                                  if (isRecommendationStep) {
                                    // "선택하신 스타일을 기반으로..." 단계 또는 "선택하신 로고와 유사한..." 단계
                                    const isSelected = isFirstRecommendation
                                      ? selectedSecondLogo === img
                                      : isSecondRecommendation 
                                      ? selectedSecondLogo === img
                                      : false;
                                    
                                    return (
                                        <Card
                                        key={imgIndex}
                                        className={`cursor-pointer overflow-hidden transition-all ${
                                          isSelected
                                            ? "border-2 shadow-md"
                                            : "border-border"
                                        }`}
                                        style={isSelected ? { borderColor: '#7C22C8' } : {}}
                                        onMouseEnter={(e) => {
                                          if (!isSelected) {
                                            if (studioType === "logo") {
                                              e.currentTarget.style.borderColor = '#7C22C8';
                                              e.currentTarget.style.opacity = '0.5';
                                            }
                                          }
                                        }}
                                        onMouseLeave={(e) => {
                                          if (!isSelected) {
                                            if (studioType === "logo") {
                                              e.currentTarget.style.borderColor = '';
                                              e.currentTarget.style.opacity = '';
                                            }
                                          }
                                        }}
                                        onClick={() => {
                                          // 이미지 클릭: 미리보기만 업데이트 및 선택 표시
                                          if (isFirstRecommendation || isSecondRecommendation) {
                                            setSelectedSecondLogo(img);
                                            setPreviewLogoImage(img);
                                            setSelectedResult({
                                              type: "logo",
                                              url: img,
                                              index: 0
                                            });
                                            setHasResultPanel(true);
                                          }
                                        }}
                                      >
                                        <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                                          <img 
                                            src={img} 
                                            alt={`추천 로고 ${imgIndex + 1}`}
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                      </Card>
                                    );
                                  }
                                
                                // 최종 생성 결과인 경우: 오버레이 있는 카드
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
                                    {isShort ? (
                                      <video 
                                        src={img} 
                                        className="w-full h-full object-cover"
                                        muted
                                        loop
                                        playsInline
                                        autoPlay
                                      />
                                    ) : (
                                      <img 
                                        src={img} 
                                        alt={`생성물 ${imgIndex + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    )}
                                    {/* Hover Overlay - 최종 생성 결과에만 표시 */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                      <div className="flex flex-col gap-2 justify-center items-center pointer-events-auto">
                                        {isShort ? (
                                          <>
                                            <Button 
                                              size="sm" 
                                              variant="secondary"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleSave(img, "short", imgIndex);
                                              }}
                                              className="bg-background/90 hover:bg-background"
                                            >
                                              <Star className="h-4 w-4 mr-2" />
                                              저장
                                            </Button>
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
                                          </>
                                        ) : (
                                          <>
                                            <Button 
                                              size="sm" 
                                              variant="secondary"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                // 재생성 버튼 클릭: assistant 메시지로 질문만 표시 (이미지 제외)
                                                if (currentProjectId) {
                                                  // "어떻게 다시 만들어드릴까요?" 질문을 assistant 메시지로 전송 (이미지 없이)
                                                  const questionMessage: Message = {
                                                    role: "assistant",
                                                    content: "어떻게 다시 만들어드릴까요?",
                                                    studioType: "logo"
                                                  };
                                                  setMessages(prev => [...prev, questionMessage]);
                                                  projectStorage.addMessage(currentProjectId, questionMessage);
                                                  // 채팅 입력창으로 포커스 이동
                                                  setTimeout(() => {
                                                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                                                  }, 100);
                                                }
                                              }}
                                              className="bg-background/90 hover:bg-background"
                                            >
                                              <RefreshCw className="h-4 w-4 mr-2" />
                                              재생성
                                            </Button>
                                            <Button 
                                              size="sm" 
                                              variant="secondary"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleSave(img, "logo", imgIndex);
                                              }}
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
                              {/* "선택하신 스타일을 기반으로..." 단계에서만 선택 버튼 표시 */}
                              {isRecommendationStep && isFirstRecommendation && selectedSecondLogo && (
                                <div className="mt-4 flex justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="font-medium text-sm border border-neutral-300 dark:border-neutral-700 transition-colors hover:bg-[#7C22C8] hover:text-white hover:border-[#7C22C8]"
                                    onClick={() => {
                                      // 선택 버튼 클릭: 최종 선택 및 다음 단계로 진행
                                      if (currentProjectId && selectedLogoType) {
                                        handleConfirmSecondSelection();
                                      }
                                    }}
                                  >
                                    선택
                                  </Button>
                                </div>
                              )}
                              {/* 저장된 로고/숏폼이 있을 때 "내 프로젝트로 가기" 버튼 표시 */}
                              {!isRecommendationStep && currentProjectId && 
                                ((studioType === "logo" && savedLogos.length > 0) || 
                                 (studioType === "short" && savedShorts.length > 0)) ? (
                                <div className={`mt-4 flex ${studioType === "short" ? "justify-start" : "justify-center"}`}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`font-medium text-sm border border-neutral-300 dark:border-neutral-700 transition-colors ${
                                      studioType === "logo" 
                                        ? "hover:bg-[#7C22C8] hover:text-white hover:border-[#7C22C8]"
                                        : "hover:bg-primary hover:text-white hover:border-primary"
                                    }`}
                                    onClick={() => {
                                      if (currentProjectId) {
                                        navigate(`/project?project=${currentProjectId}`);
                                      }
                                    }}
                                  >
                                    내 프로젝트로 가기
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })()}
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
                    placeholder={studioType === "short" ? "메시지를 입력하세요..." : "메시지를 입력하세요..."}
                    className={`min-h-[40px] max-h-[40px] resize-none pr-12 pl-12 py-2 text-sm w-full ${studioType === "logo" ? "focus-visible:ring-[#7C22C8]" : ""}`}
                    disabled={isGeneratingShortForm}
                    rows={1}
                  />
                  <Button
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    variant="ghost"
                    className="absolute bottom-1 left-2 h-8 w-8 p-0 bg-transparent border-0 hover:bg-transparent"
                    disabled={isGeneratingShortForm}
                  >
                    <Plus className={`h-4 w-4 ${studioType !== "logo" ? "text-primary" : ""}`} style={studioType === "logo" ? { color: '#7C22C8' } : undefined} />
                  </Button>
                  <Button 
                    onClick={handleSendMessage} 
                    size="icon"
                    variant="ghost"
                    className="absolute bottom-1 right-1 h-8 w-8 hover:bg-transparent"
                    disabled={(!inputValue.trim() && attachedImages.length === 0) || isGeneratingShortForm}
                  >
                    {isGeneratingShortForm ? (
                      <RefreshCw className={`h-4 w-4 animate-spin ${studioType !== "logo" ? "text-primary" : ""}`} style={studioType === "logo" ? { color: '#7C22C8' } : undefined} />
                    ) : (
                      <Send className={`h-4 w-4 ${studioType !== "logo" ? "text-primary" : ""}`} style={studioType === "logo" ? { color: '#7C22C8' } : undefined} />
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
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>삭제하시겠습니까?</DialogTitle>
            <DialogDescription>
              {itemToDelete?.type === "logo" ? "로고" : "숏폼"}를 삭제하면 저장된 항목에서 제거됩니다.
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

export default StudioPage;
