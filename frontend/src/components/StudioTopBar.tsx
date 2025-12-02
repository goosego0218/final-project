import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import { Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft,
  CreditCard,
  FolderOpen,
  Heart,
  MoreVertical,
  User,
  Youtube,
  BarChart3,
} from "lucide-react";

interface StudioTopBarProps {
  onBack: () => void;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  userName: string;
  userEmail: string;
  tokensUsed: number;
  tokensTotal: number;
  userAvatar?: string | null;
  tiktokConnected?: boolean;
  youtubeConnected?: boolean;
  studioType?: "logo" | "shorts";
}

const StudioTopBar = ({
  onBack,
  onNavigate,
  onLogout,
  userName,
  userEmail,
  tokensUsed,
  tokensTotal,
  userAvatar,
  tiktokConnected = false,
  youtubeConnected = false,
  studioType,
}: StudioTopBarProps) => {
  const userInitials = userName?.charAt(0) || "U";

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-xl flex-shrink-0 relative">
      <div className="w-full px-12 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 hover:bg-transparent">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Link
            to="/"
            className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground hover:opacity-80 transition-opacity"
          >
            <img 
              src="/makery-logo.png" 
              alt="Makery Logo" 
              className="h-8 w-8 flex-shrink-0"
            />
            <span>MAKERY</span>
            {studioType === "logo" && (
              <span className="text-[#7C22C8] font-handwriting">Logo</span>
            )}
            {studioType === "shorts" && (
              <span className="text-[#FF8B3D] font-handwriting">Shorts</span>
            )}
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
              <div className="px-2 py-3 flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {userAvatar ? (
                    <AvatarImage src={userAvatar} alt={userName} />
                  ) : null}
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{userName}</p>
                  <p className="text-xs text-muted-foreground">{userEmail}</p>
                </div>
                <div className="flex items-center gap-2">
                  {tiktokConnected ? (
                    <img src="/icon/tiktok-logo.png" alt="TikTok" className="h-5 w-5" />
                  ) : (
                    <img src="/icon/tiktok-logo.png" alt="TikTok" className="h-5 w-5 opacity-30" />
                  )}
                  {youtubeConnected ? (
                    <img src="/icon/youtube-logo.png" alt="YouTube" className="h-5 w-5 object-contain" />
                  ) : (
                    <Youtube className="h-5 w-5 text-muted-foreground/30" strokeWidth={1.5} />
                  )}
                </div>
              </div>

              <DropdownMenuSeparator />

              <div className="px-2 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">토큰 사용량</span>
                  <span className="text-xs font-semibold text-foreground">
                    {tokensUsed} / {tokensTotal}
                  </span>
                </div>
                <Progress value={(tokensUsed / tokensTotal) * 100} className="h-1.5" />
              </div>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={() => onNavigate("/account")}>
                <User className="h-4 w-4 mr-2" />
                내 프로필
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNavigate("/mypage")}>
                <Heart className="h-4 w-4 mr-2" />
                마이페이지
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNavigate("/projects")}>
                <FolderOpen className="h-4 w-4 mr-2" />
                내 프로젝트
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNavigate("/plans")}>
                <CreditCard className="h-4 w-4 mr-2" />
                플랜 관리
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNavigate("/shortsReport")}>
                <BarChart3 className="h-4 w-4 mr-2" />
                숏폼 리포트
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={onLogout}>로그아웃</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default StudioTopBar;

