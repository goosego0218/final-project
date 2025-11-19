import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Send, Zap, ChevronLeft, ChevronRight, Download, RefreshCw, Star, Plus, Upload, X, FolderOpen, Instagram, Youtube, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { projectStorage, type Message, type Project, type SavedItem } from "@/lib/projectStorage";
import StudioTopBar from "@/components/StudioTopBar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

interface SelectedResult {
  type: "logo" | "short";
  url: string;
  index: number;
}

const StudioPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [isLoggedIn] = useState(() => localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true');
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<SavedItem | null>(null);
  
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
  const [isLoggedInState, setIsLoggedInState] = useState(() => localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true');

  // localStorage 변경 감지하여 사용자 정보 업데이트
  useEffect(() => {
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

  // 프로젝트 로드
  useEffect(() => {
    const currentLoggedIn = localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true';
    if (!currentLoggedIn) {
      navigate("/");
      return;
    }

    const projectId = searchParams.get('project');
    if (projectId) {
      const project = projectStorage.getProject(projectId);
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
          
          // 로고 관련 대화가 이미 있는지 확인 (시안, 로고 타입 선택 메시지 확인)
          const chatMessages = project.messages.filter(m => m.role !== "system");
          const logoTypeUserMessageIndex = chatMessages.findIndex(m => 
            m.role === "user" && (m.content.includes("글씨만 있는 로고") || m.content.includes("글씨랑 아이콘 있는 로고") || m.content.includes("엠블럼만 있는 로고"))
          );
          
          // 로고 타입 선택 메시지가 있으면 로고 관련 대화가 진행된 상태
          if (logoTypeUserMessageIndex !== -1) {
            // 로고 타입 선택 이후의 메시지만 표시 (ChatPage 대화 제외)
            const logoMessages = chatMessages.slice(logoTypeUserMessageIndex);
            setMessages(logoMessages);
            setHasStartedChat(true);
            setLogoTypeSelected(true);
            
            // 선택된 로고 타입 복원
            const logoTypeUserMessage = chatMessages[logoTypeUserMessageIndex];
            if (logoTypeUserMessage) {
              if (logoTypeUserMessage.content.includes("글씨만 있는 로고")) {
                setSelectedLogoType("text");
              } else if (logoTypeUserMessage.content.includes("글씨랑 아이콘 있는 로고")) {
                setSelectedLogoType("text-icon");
              } else if (logoTypeUserMessage.content.includes("엠블럼만 있는 로고")) {
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
              // 로고 타입은 선택했지만 아직 생성되지 않은 경우 - 첫 번째 추천 단계로 복원
              const allImages = getLogoImagesByType(selectedLogoType || "text");
              const recommendedLogos = getRandomLogos(allImages, 4);
              setFirstRecommendations(recommendedLogos);
              setRecommendationStep("first");
              setSelectedFirstLogo(null);
              
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
            // 로고 타입 선택 메시지가 없으면 아직 선택하지 않은 상태
            // 초기 안내 메시지를 assistant 메시지로 추가
            const initialMessage: Message = {
              role: "assistant",
              content: brandInfo ? `${brandInfo.brand_name} ${brandInfo.industry}을 위한 세 가지 로고 디자인 방향을 제안해 드리겠습니다.` : "세 가지 로고 디자인 방향을 제안해 드리겠습니다.",
              images: [
                getLogoImagesByType("text")[0] || "",
                getLogoImagesByType("text-icon")[0] || "",
                getLogoImagesByType("emblem")[0] || ""
              ].filter(Boolean) // 빈 문자열 제거
            };
            setMessages([initialMessage]);
            setHasStartedChat(true);
            setLogoTypeSelected(false);
          }
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
      }
    }

    // 프로젝트 리스트 로드
    setProjects(projectStorage.getProjects());
  }, [isLoggedIn, navigate, searchParams, studioType]);

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

  const handleLogoTypeSelection = (logoType: "text" | "text-icon" | "emblem", brandInfo: { brand_name: string; industry: string }) => {
    if (!currentProjectId) return;

    const logoTypeNames = {
      "text": "글씨만 있는 로고",
      "text-icon": "글씨랑 아이콘 있는 로고",
      "emblem": "엠블럼만 있는 로고"
    };

    // 사용자 메시지 추가
    const userMessage: Message = {
      role: "user",
      content: logoTypeNames[logoType]
    };
    setMessages(prev => [...prev, userMessage]);
    projectStorage.addMessage(currentProjectId, userMessage);

    // 첫 번째 추천 단계로 이동 (채팅 메시지로 표시)
    const allImages = getLogoImagesByType(logoType);
    const recommendedLogos = getRandomLogos(allImages, 4);
    setFirstRecommendations(recommendedLogos);
    setRecommendationStep("first");
    setSelectedFirstLogo(null);
    
    // assistant 메시지로 "선택하신 스타일을 기반으로..." 전송
    setTimeout(() => {
      const assistantMessage: Message = {
        role: "assistant",
        content: "선택하신 스타일을 기반으로 몇 가지 예시를 보여드릴게요.",
        images: recommendedLogos // 추천 로고들을 images로 전달
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
    setSelectedFirstLogo(imageUrl);
    setPreviewLogoImage(imageUrl);
    setSelectedResult({
      type: "logo",
      url: imageUrl,
      index: 0
    });
    setHasResultPanel(true);
  };

  // 첫 번째 추천에서 선택 버튼 클릭 (다음 단계로 진행)
  const handleConfirmFirstSelection = () => {
    if (!currentProjectId || !selectedLogoType || !selectedFirstLogo) return;
    
    // 자동으로 두 번째 추천 단계로 이동
    const allImages = getLogoImagesByType(selectedLogoType);
    // 선택한 이미지와 다른 이미지들 중에서 선택
    const otherImages = allImages.filter(img => img !== selectedFirstLogo);
    const recommendedLogos = getRandomLogos(otherImages, 4);
    setSecondRecommendations(recommendedLogos);
    setRecommendationStep("second");
    setSelectedSecondLogo(null);
    
    // assistant 메시지로 "선택하신 로고와 유사한..." 전송
    setTimeout(() => {
      const assistantMessage: Message = {
        role: "assistant",
        content: "선택하신 로고와 유사한 느낌의 로고들을 더 보여드릴게요.",
        images: recommendedLogos // 유사 로고들을 images로 전달
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

  // 두 번째 추천에서 선택 버튼 클릭 (최종 생성으로 진행)
  const handleConfirmSecondSelection = () => {
    if (!currentProjectId || !selectedLogoType || !selectedSecondLogo) return;
    
    // 자동으로 최종 로고 생성 흐름으로 이동
    const logoTypeNames = {
      "text": "글씨만 있는 로고",
      "text-icon": "글씨랑 아이콘 있는 로고",
      "emblem": "엠블럼만 있는 로고"
    };

    // assistant 메시지로 "이 로고 느낌을 기반으로..." 전송
    setTimeout(() => {
      const assistantMessage: Message = {
        role: "assistant",
        content: "이 로고 느낌을 기반으로 최종 로고를 생성해 드릴게요."
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
          images: dummyImages
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
      }, 800);
    }, 500);
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
      // 재생성 요청인지 확인 (이전 메시지가 assistant 메시지이고 "어떻게 다시 만들어드릴까요?"와 이미지가 함께 있는 경우)
      // messages는 이미 userMessage가 추가된 상태이므로, 그 이전 메시지들을 확인
      const previousMessages = messages.slice(0, -1); // 현재 추가된 userMessage 제외
      const lastAssistantMessage = previousMessages.length > 0 
        ? previousMessages.filter(m => m.role === "assistant").pop()
        : null;
      
      const isRegenerationRequest = lastAssistantMessage && 
                                   lastAssistantMessage.content === "어떻게 다시 만들어드릴까요?" &&
                                   lastAssistantMessage.images && 
                                   lastAssistantMessage.images.length > 0 &&
                                   currentInput.trim();
      
      // 재생성 요청인지 확인 (attachedImages에 이미지가 있고 내용이 있는 경우) 또는 메시지 히스토리 기반 확인
      if ((currentImages.length > 0 && currentInput.trim()) || isRegenerationRequest) {
        // 재생성 로직: 다시 생성한 로고 2개 보여주기
        const imageCount = 2;
        const dummyImages = Array(imageCount).fill(0).map((_, i) => 
          `https://images.unsplash.com/photo-1634942537034-2531766767d1?w=400&h=400&fit=crop&crop=center&q=80&sig=${Date.now()}_${i}`
        );
        
        const aiMessage: Message = { 
          role: "assistant", 
          content: `요청하신 내용을 반영하여 로고를 다시 생성했습니다. 원하시는 것을 클릭하면 크게 볼 수 있어요!`,
          images: dummyImages
        };
        setMessages(prev => [...prev, aiMessage]);
        projectStorage.addMessage(currentProjectId, aiMessage);
        return;
      }

      const hasLogo = currentInput.toLowerCase().includes("로고");
      const hasShort = currentInput.toLowerCase().includes("숏폼");
      
      // type 파라미터에 따라 생성 가능 여부 확인
      if (studioType === "logo" && hasLogo) {
        // 로고 생성 모드에서 로고 생성 요청
        const imageCount = 2;
        const dummyImages = Array(imageCount).fill(0).map((_, i) => 
          `https://images.unsplash.com/photo-1634942537034-2531766767d1?w=400&h=400&fit=crop&crop=center&q=80&sig=${i}`
        );
        
        const aiMessage: Message = { 
          role: "assistant", 
          content: `로고 시안 ${imageCount}개를 생성했습니다. 원하시는 것을 클릭하면 크게 볼 수 있어요!`,
          images: dummyImages
        };
        setMessages(prev => [...prev, aiMessage]);
        projectStorage.addMessage(currentProjectId, aiMessage);
      } else if (studioType === "short" && hasShort) {
        // 숏폼 생성 모드에서 숏폼 생성 요청
        const imageCount = 1;
        const dummyImages = Array(imageCount).fill(0).map((_, i) => 
          `https://images.unsplash.com/photo-1634942537034-2531766767d1?w=400&h=400&fit=crop&crop=center&q=80&sig=${i}`
        );
        
        const aiMessage: Message = { 
          role: "assistant", 
          content: `숏폼 시안 ${imageCount}개를 생성했습니다. 원하시는 것을 클릭하면 크게 볼 수 있어요!`,
          images: dummyImages
        };
        setMessages(prev => [...prev, aiMessage]);
        projectStorage.addMessage(currentProjectId, aiMessage);
      } else if (!studioType && (hasLogo || hasShort)) {
        // type 파라미터가 없는 경우 기존 동작 (로고/숏폼 모두 가능)
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
        projectStorage.addMessage(currentProjectId, aiMessage);
      } else {
        // type 파라미터에 맞지 않는 요청 또는 일반 메시지
        const aiMessage: Message = { 
          role: "assistant", 
          content: studioType === "logo" 
            ? "무엇을 도와드릴까요? '로고'를 포함해서 요청해주세요." 
            : studioType === "short"
            ? "무엇을 도와드릴까요? '숏폼'을 포함해서 요청해주세요."
            : "무엇을 도와드릴까요? '로고' 또는 '숏폼'을 포함해서 요청해주세요."
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
      setSavedLogos(prev => {
        // 중복 체크
        if (prev.some(saved => saved.url === url)) {
          toast({
            title: "이미 저장된 로고입니다",
            description: "이 로고는 이미 저장되어 있습니다.",
          });
          return prev;
        }
        
        const updated = [...prev, item];
        
        // 프로젝트에 저장된 항목 업데이트
        const project = projectStorage.getProject(currentProjectId);
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
    } else {
      setSavedShorts(prev => {
        // 중복 체크
        if (prev.some(saved => saved.url === url)) {
          toast({
            title: "이미 저장된 숏폼입니다",
            description: "이 숏폼은 이미 저장되어 있습니다.",
          });
          return prev;
        }
        
        const updated = [...prev, item];
        
        // 프로젝트에 저장된 항목 업데이트
        const project = projectStorage.getProject(currentProjectId);
        if (project) {
          const allSavedItems = [...(project.savedItems || []), item];
          project.savedItems = allSavedItems;
          projectStorage.saveProject(project);
        }
        
        toast({
          title: "숏폼이 저장되었습니다",
          description: "하단 보관함에서 확인할 수 있습니다.",
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
        variant: "destructive",
      });
    }
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
      
      // 업로드 시 자동 저장
      if (currentProjectId) {
        const shortItem: SavedItem = {
          id: `short_${Date.now()}_${savedShorts.length}`,
          url: pendingUploadUrl,
          type: "short",
          index: savedShorts.length,
          title: `숏폼 ${savedShorts.length + 1}`,
          createdAt: new Date().toISOString(),
        };
        
        setSavedShorts(prev => {
          // 중복 체크
          if (prev.some(saved => saved.url === pendingUploadUrl)) {
            return prev;
          }
          
          const updated = [...prev, shortItem];
          
          // 프로젝트에 저장된 항목 업데이트
          const project = projectStorage.getProject(currentProjectId);
          if (project) {
            const allSavedItems = [...(project.savedItems || []), shortItem];
            project.savedItems = allSavedItems;
            projectStorage.saveProject(project);
          }
          
          return updated;
        });
      }
      
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
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 flex items-center justify-center p-8 overflow-auto bg-background">
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
                              onClick={() => handleSave(selectedResult.url, "short", selectedResult.index)}
                              className="bg-background/90 hover:bg-background"
                            >
                              <Star className="h-4 w-4 mr-2" />
                              저장
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
                                  // 재생성 버튼 클릭: assistant 메시지로 질문과 함께 이미지 표시
                                  if (selectedResult?.url && currentProjectId) {
                                    // "어떻게 다시 만들어드릴까요?" 질문을 assistant 메시지로 전송하고 이미지도 함께 표시
                                    const questionMessage: Message = {
                                      role: "assistant",
                                      content: "어떻게 다시 만들어드릴까요?",
                                      images: [selectedResult.url]
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
                                        onClick={() => {
                                          const dummyUrl = `https://images.unsplash.com/photo-1634942537034-2531766767d1?w=400&h=400&fit=crop&crop=center&q=80&sig=${item}`;
                                          handleSave(dummyUrl, "short", item - 1);
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
                                  ? "border-orange-500 shadow-md"
                                  : "border-border hover:border-orange-500/50"
                              }`}
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
                                  ? "border-orange-500 shadow-md"
                                  : "border-border hover:border-orange-500/50"
                              }`}
                            >
                              <img
                                src={short.url}
                                alt={short.title}
                                className="w-full h-full object-cover"
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
                      className={activeStorageTab === "logos" ? "bg-orange-500 hover:bg-orange-600" : ""}
                    >
                      <FolderOpen className="h-4 w-4 mr-2" />
                      로고
                    </Button>
                  )}
                  {(!studioType || studioType === "short") && (
                    <Button
                      variant={activeStorageTab === "shorts" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleToggleStorageTab("shorts")}
                      className={activeStorageTab === "shorts" ? "bg-orange-500 hover:bg-orange-600" : ""}
                    >
                      <FolderOpen className="h-4 w-4 mr-2" />
                      숏폼
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


                  {/* Onboarding Message */}
                  {!hasStartedChat && studioType !== "logo" && (
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
                          </Card>
                        </div>
                      )}
                      
                      {/* 이미지 그리드 영역 - 말풍선 밖으로 분리 (assistant 메시지) */}
                      {message.role === "assistant" && message.images && message.images.length > 0 && (() => {
                        const isShort = message.content.includes("숏폼");
                        const isLogoTypeSelection = message.content.includes("세 가지 로고 디자인 방향");
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
                                  <Card 
                                    className="border-border overflow-hidden flex flex-col"
                                  >
                                    <div 
                                      className="aspect-square bg-muted flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
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
                                      <img 
                                        src={message.images[0] || "/placeholder.svg"} 
                                        alt="글씨만 있는 로고"
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div className="px-3 pt-3 pb-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full font-medium text-sm"
                                        onClick={() => {
                                          setSelectedLogoType("text");
                                          setLogoTypeSelected(true);
                                          setHasStartedChat(true);
                                          handleLogoTypeSelection("text", brandInfo);
                                        }}
                                      >
                                        글씨만 있는 로고
                                      </Button>
                                    </div>
                                  </Card>
                                  {/* 글씨랑 아이콘 있는 로고 */}
                                  <Card 
                                    className="border-border overflow-hidden flex flex-col"
                                  >
                                    <div 
                                      className="aspect-square bg-muted flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
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
                                      <img 
                                        src={message.images[1] || "/placeholder.svg"} 
                                        alt="글씨랑 아이콘 있는 로고"
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div className="px-3 pt-3 pb-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full font-medium text-sm"
                                        onClick={() => {
                                          setSelectedLogoType("text-icon");
                                          setLogoTypeSelected(true);
                                          setHasStartedChat(true);
                                          handleLogoTypeSelection("text-icon", brandInfo);
                                        }}
                                      >
                                        글씨랑 아이콘 있는 로고
                                      </Button>
                                    </div>
                                  </Card>
                                  {/* 엠블럼만 있는 로고 */}
                                  <Card 
                                    className="border-border overflow-hidden flex flex-col"
                                  >
                                    <div 
                                      className="aspect-square bg-muted flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
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
                                      <img 
                                        src={message.images[2] || "/placeholder.svg"} 
                                        alt="엠블럼만 있는 로고"
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div className="px-3 pt-3 pb-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full font-medium text-sm"
                                        onClick={() => {
                                          setSelectedLogoType("emblem");
                                          setLogoTypeSelected(true);
                                          setHasStartedChat(true);
                                          handleLogoTypeSelection("emblem", brandInfo);
                                        }}
                                      >
                                        엠블럼만 있는 로고
                                      </Button>
                                    </div>
                                  </Card>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        
                        // 일반 이미지 그리드 렌더링 (추천 단계, 최종 생성 결과)
                        return (
                          <div className="flex justify-start mt-2">
                            <div className="max-w-[80%] w-full">
                              <div className="grid grid-cols-2 gap-2">
                                {message.images.map((img, imgIndex) => {
                                  // 추천 단계인 경우: 오버레이 없이 선택 가능한 카드
                                  if (isRecommendationStep) {
                                    const isSelected = isFirstRecommendation 
                                      ? selectedFirstLogo === img
                                      : isSecondRecommendation 
                                      ? selectedSecondLogo === img
                                      : false;
                                    
                                    return (
                                      <Card
                                        key={imgIndex}
                                        className={`cursor-pointer overflow-hidden transition-all ${
                                          isSelected
                                            ? "border-2 border-primary shadow-md"
                                            : "border-border hover:border-primary/50"
                                        }`}
                                        onClick={() => {
                                          // 왼쪽 미리보기만 갱신 (선택 상태는 업데이트하되 다음 단계로는 넘어가지 않음)
                                          if (isFirstRecommendation) {
                                            handleFirstRecommendationClick(img);
                                          } else if (isSecondRecommendation) {
                                            handleSecondRecommendationClick(img);
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
                                    <img 
                                      src={img} 
                                      alt={`생성물 ${imgIndex + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                    {/* Hover Overlay - 최종 생성 결과에만 표시 */}
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
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleSave(img, "short", imgIndex);
                                              }}
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
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                // 재생성 버튼 클릭: assistant 메시지로 질문과 함께 이미지 표시
                                                if (currentProjectId) {
                                                  // "어떻게 다시 만들어드릴까요?" 질문을 assistant 메시지로 전송하고 이미지도 함께 표시
                                                  const questionMessage: Message = {
                                                    role: "assistant",
                                                    content: "어떻게 다시 만들어드릴까요?",
                                                    images: [img]
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
                              {/* 추천 단계에서 선택 버튼 표시 */}
                              {isRecommendationStep && (
                                <div className="mt-4 flex justify-end">
                                  {isFirstRecommendation && selectedFirstLogo && (
                                    <Button
                                      onClick={handleConfirmFirstSelection}
                                      className="bg-primary hover:bg-primary/90"
                                    >
                                      선택
                                    </Button>
                                  )}
                                  {isSecondRecommendation && selectedSecondLogo && (
                                    <Button
                                      onClick={handleConfirmSecondSelection}
                                      className="bg-primary hover:bg-primary/90"
                                    >
                                      선택
                                    </Button>
                                  )}
                                </div>
                              )}
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
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
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
