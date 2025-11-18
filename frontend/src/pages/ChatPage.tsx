import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowRight, Send, ChevronLeft } from "lucide-react";
import { projectStorage, type Message } from "@/lib/projectStorage";
import { useToast } from "@/hooks/use-toast";

const ChatPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "안녕하세요! 프로젝트를 시작하기 전에 몇 가지 정보를 알려주세요.\n\n먼저, 브랜드 이름이나 회사명을 알려주실 수 있나요?"
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [collectedInfo, setCollectedInfo] = useState({
    brandName: "",
    industry: "",
    targetAudience: "",
    style: ""
  });

  useEffect(() => {
    const projectId = searchParams.get('project') || projectStorage.getCurrentProjectId();
    if (!projectId) {
      navigate("/projects");
      return;
    }
    setCurrentProjectId(projectId);
    
    const project = projectStorage.getProject(projectId);
    if (project) {
      setMessages(project.messages);
      // system 메시지 제외하고 로드
      const chatMessages = project.messages.filter(m => m.role !== "system");
      setMessages(chatMessages);
    }
  }, [navigate, searchParams]);

  const handleSendMessage = () => {
    if (!inputMessage.trim() || !currentProjectId) return;

    const userMessage: Message = {
      role: "user",
      content: inputMessage
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    // 간단한 대화 로직 - 실제로는 더 복잡한 로직이 필요할 수 있습니다
    let assistantResponse = "";
    const messageCount = messages.filter(m => m.role === "user").length;

    if (messageCount === 0) {
      setCollectedInfo(prev => ({ ...prev, brandName: inputMessage }));
      assistantResponse = "좋습니다! 어떤 업종이나 분야인가요? (예: IT, 패션, 식음료 등)";
    } else if (messageCount === 1) {
      setCollectedInfo(prev => ({ ...prev, industry: inputMessage }));
      assistantResponse = "타겟 고객층은 어떻게 되나요? (예: 20-30대 여성, MZ세대 등)";
    } else if (messageCount === 2) {
      setCollectedInfo(prev => ({ ...prev, targetAudience: inputMessage }));
      assistantResponse = "원하시는 디자인 스타일이나 느낌이 있나요? (예: 모던, 클래식, 미니멀 등)";
    } else {
      setCollectedInfo(prev => ({ ...prev, style: inputMessage }));
      assistantResponse = "완벽합니다! 모든 정보를 수집했습니다.\n\n아래 '생성하기' 버튼을 눌러 스튜디오로 이동하세요.";
    }

    const assistantMessage: Message = {
      role: "assistant",
      content: assistantResponse
    };

    setTimeout(() => {
      setMessages([...newMessages, assistantMessage]);
      projectStorage.addMessage(currentProjectId, userMessage);
      projectStorage.addMessage(currentProjectId, assistantMessage);
    }, 500);

    setInputMessage("");
  };

  const handleGenerateClick = () => {
    if (!currentProjectId) return;

    const project = projectStorage.getProject(currentProjectId);
    if (project) {
      // 수집된 정보를 프로젝트에 추가
      const infoMessage: Message = {
        role: "system",
        content: JSON.stringify(collectedInfo)
      };
      projectStorage.addMessage(currentProjectId, infoMessage);
      
      toast({
        title: "정보가 저장되었습니다",
        description: "스튜디오로 이동합니다.",
      });

      navigate(`/studio?project=${currentProjectId}`);
    }
  };

  const canGenerate = messages.filter(m => m.role === "user").length >= 4;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/projects")}
            className="h-9 w-9"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">프로젝트 정보 수집</h1>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 container mx-auto px-4 py-8 flex flex-col max-w-4xl">
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
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
        </div>

        {/* Action Buttons */}
        {canGenerate && (
          <div className="mb-4 flex justify-center">
            <Button
              size="lg"
              onClick={handleGenerateClick}
              className="gap-2"
            >
              생성하기
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        )}

        {/* Input Area */}
        <div className="flex gap-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                handleSendMessage();
              }
            }}
            placeholder="메시지를 입력하세요..."
            className="flex-1"
            disabled={canGenerate}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || canGenerate}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
