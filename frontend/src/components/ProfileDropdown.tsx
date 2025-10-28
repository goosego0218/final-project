import { Link, useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { User, LogOut, Settings, LayoutDashboard, Zap } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const ProfileDropdown = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  // Mock data - 실제로는 API에서 가져올 데이터
  const [tokenUsage] = useState({
    used: 7500,
    total: 10000
  });

  const usagePercentage = (tokenUsage.used / tokenUsage.total) * 100;
  const remainingTokens = tokenUsage.total - tokenUsage.used;

  const handleLogout = () => {
    logout();
    toast.success("로그아웃되었습니다");
    navigate("/");
  };

  return (
    <div className="flex items-center gap-3">
      {/* 토큰 사용량 표시 */}
      <Link 
        to="/plan-management"
        className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary/50 hover:bg-secondary transition-colors"
      >
        <Zap className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium">
          {remainingTokens.toLocaleString()}
        </span>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            <Avatar>
              <AvatarImage src={user?.avatar} alt={user?.name} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {user?.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64" align="end">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* 토큰 사용량 상세 */}
          <div className="px-2 py-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">토큰 사용량</span>
                <Link to="/plan-management" className="text-xs text-primary hover:underline">
                  자세히 보기
                </Link>
              </div>
              <Progress value={usagePercentage} className="h-2" />
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  {tokenUsage.used.toLocaleString()} / {tokenUsage.total.toLocaleString()}
                </span>
                <span className="font-medium text-primary">
                  {remainingTokens.toLocaleString()} 남음
                </span>
              </div>
            </div>
          </div>
          
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/dashboard" className="cursor-pointer">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              프로젝트 대시보드
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/profile-setup" className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              프로필 수정
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/settings" className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              설정
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" />
            로그아웃
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default ProfileDropdown;
