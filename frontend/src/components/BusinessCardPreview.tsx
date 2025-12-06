import { useState, useRef, MouseEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface BusinessCardPreviewProps {
  logoUrl: string;
  logoTitle?: string;
}

type LogoPosition = "top-left" | "top-center" | "top-right" | "center";

interface TextElement {
  id: string;
  text: string;
  position: { x: number; y: number }; // 퍼센트 단위
  fontSize: number;
  fontWeight: "normal" | "bold";
  color: string;
}

const BusinessCardPreview = ({ logoUrl, logoTitle }: BusinessCardPreviewProps) => {
  const [logoPosition, setLogoPosition] = useState<LogoPosition>("top-left");
  const [logoSize, setLogoSize] = useState(150); // 기본값 150px
  const [textElements, setTextElements] = useState<TextElement[]>([
    { id: "company", text: "회사명", position: { x: 65.5556, y: 22 }, fontSize: 18, fontWeight: "bold", color: "#1f2937" },
    { id: "name", text: "이름", position: { x: 61.6667, y: 38.5 }, fontSize: 14, fontWeight: "normal", color: "#4b5563" },
    { id: "email", text: "이메일@example.com", position: { x: 74.7222, y: 51.5 }, fontSize: 12, fontWeight: "normal", color: "#6b7280" },
    { id: "phone", text: "010-1234-5678", position: { x: 70, y: 65 }, fontSize: 12, fontWeight: "normal", color: "#6b7280" },
    { id: "address", text: "서울시 강남구", position: { x: 68.8889, y: 78 }, fontSize: 12, fontWeight: "normal", color: "#6b7280" },
  ]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  // 명함 크기 (표준 명함: 90mm x 50mm, 비율 약 1.8:1)
  const cardWidth = 360; // px
  const cardHeight = 200; // px

  const getLogoStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      width: `${logoSize}px`,
      height: `${logoSize}px`,
      objectFit: "contain",
    };

    switch (logoPosition) {
      case "top-left":
        return { ...baseStyle, position: "absolute", top: "20px", left: "20px" };
      case "top-center":
        // 상단 중앙은 카드 상단에 완전히 붙여서 배치
        return { ...baseStyle, position: "absolute", top: "0px", left: "50%", transform: "translateX(-50%)" };
      case "top-right":
        return { ...baseStyle, position: "absolute", top: "20px", right: "20px" };
      case "center":
        return { ...baseStyle, position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
      default:
        return baseStyle;
    }
  };

  const handleTextMouseDown = (e: MouseEvent<HTMLDivElement>, elementId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (cardRef.current) {
      const cardRect = cardRef.current.getBoundingClientRect();
      const element = textElements.find((el) => el.id === elementId);
      if (element) {
        const elementX = (element.position.x / 100) * cardRect.width;
        const elementY = (element.position.y / 100) * cardRect.height;
        setDragOffset({
          x: e.clientX - cardRect.left - elementX,
          y: e.clientY - cardRect.top - elementY,
        });
        setDraggingId(elementId);
      }
    }
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (draggingId && cardRef.current) {
      const cardRect = cardRef.current.getBoundingClientRect();
      const x = ((e.clientX - cardRect.left - dragOffset.x) / cardRect.width) * 100;
      const y = ((e.clientY - cardRect.top - dragOffset.y) / cardRect.height) * 100;
      
      setTextElements((prev) =>
        prev.map((el) =>
          el.id === draggingId
            ? { ...el, position: { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) } }
            : el
        )
      );
    }
  };

  const handleMouseUp = () => {
    setDraggingId(null);
  };

  const updateTextElement = (id: string, updates: Partial<TextElement>) => {
    setTextElements((prev) => prev.map((el) => (el.id === id ? { ...el, ...updates } : el)));
  };

  return (
    <div className="flex flex-row items-center gap-6 w-full">
      {/* 명함 미리보기 (왼쪽) */}
      <div className="flex-shrink-0" style={{ width: `${cardWidth}px` }}>
        <Card
          ref={cardRef}
          data-card-ref="true"
          className="relative overflow-hidden bg-gradient-to-br from-white to-gray-50 border-2 shadow-lg"
          style={{ width: `${cardWidth}px`, height: `${cardHeight}px` }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* 로고 배치 */}
          <img
            src={logoUrl}
            alt={logoTitle || "로고"}
            style={getLogoStyle()}
          />

          {/* 개별 텍스트 요소들 (드래그 가능) */}
          {textElements.map((element) => (
            <div
              key={element.id}
              className="absolute cursor-move select-none"
              style={{
                left: `${element.position.x}%`,
                top: `${element.position.y}%`,
                transform: "translate(-50%, -50%)",
                fontSize: `${element.fontSize}px`,
                fontWeight: element.fontWeight,
                color: element.color,
                whiteSpace: "nowrap",
                userSelect: "none",
              }}
              onMouseDown={(e) => handleTextMouseDown(e, element.id)}
            >
              {element.text}
            </div>
          ))}
        </Card>
      </div>

      {/* 컨트롤 패널 (오른쪽) */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* 로고 위치 선택 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">로고 위치</label>
          <div className="grid grid-cols-4 gap-1.5">
            {(["top-left", "top-center", "top-right", "center"] as LogoPosition[]).map((pos) => (
              <Button
                key={pos}
                variant={logoPosition === pos ? "default" : "outline"}
                size="sm"
                onClick={() => setLogoPosition(pos)}
                className="text-xs h-7"
              >
                {pos === "top-left" && "좌상단"}
                {pos === "top-center" && "상단중앙"}
                {pos === "top-right" && "우상단"}
                {pos === "center" && "중앙"}
              </Button>
            ))}
          </div>
        </div>

        {/* 로고 크기 조절 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">로고 크기</label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setLogoSize(Math.max(30, logoSize - 10))}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span className="flex-1 text-center text-xs">{logoSize}px</span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setLogoSize(Math.min(170, logoSize + 10))}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* 텍스트 요소 편집 */}
        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">텍스트 요소 편집</label>
            <span className="text-xs text-muted-foreground">명함 위에서 드래그하여 위치 이동 가능</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {textElements.map((element) => (
              <div key={element.id} className="space-y-1.5 p-2 border rounded-md">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-700">
                    {element.id === "company" && "회사명"}
                    {element.id === "name" && "이름"}
                    {element.id === "email" && "이메일"}
                    {element.id === "phone" && "전화번호"}
                    {element.id === "address" && "주소"}
                  </label>
                </div>
                <Input
                  value={element.text}
                  onChange={(e) => updateTextElement(element.id, { text: e.target.value })}
                  className="h-7 text-xs"
                  placeholder="텍스트 입력"
                />
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-gray-600 whitespace-nowrap">크기:</label>
                  <div className="flex items-center gap-1 flex-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => updateTextElement(element.id, { fontSize: Math.max(10, element.fontSize - 2) })}
                    >
                      <ChevronLeft className="h-2.5 w-2.5" />
                    </Button>
                    <span className="text-xs text-center flex-1 min-w-[30px]">{element.fontSize}px</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => updateTextElement(element.id, { fontSize: Math.min(24, element.fontSize + 2) })}
                    >
                      <ChevronRight className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                  <Button
                    variant={element.fontWeight === "bold" ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-5 px-2"
                    onClick={() =>
                      updateTextElement(element.id, {
                        fontWeight: element.fontWeight === "bold" ? "normal" : "bold",
                      })
                    }
                  >
                    굵게
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessCardPreview;

