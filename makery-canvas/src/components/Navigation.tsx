import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import { AuthModals } from "./AuthModals";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Zap, User, FolderOpen, CreditCard, Heart, Instagram, Youtube } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const Navigation = () => {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    // localStorage에서 로그인 상태 복원
    return localStorage.getItem('isLoggedIn') === 'true';
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  // localStorage에서 사용자 정보 가져오기
  const getUserProfile = () => {
    const stored = localStorage.getItem('userProfile');
    if (stored) {
      const profile = JSON.parse(stored);
      // 기존 name 필드를 nickname으로 마이그레이션
      if (profile.name && !profile.nickname) {
        profile.nickname = profile.name;
        delete profile.name;
        localStorage.setItem('userProfile', JSON.stringify(profile));
      }
      // 기존 email 필드를 id로 마이그레이션
      if (profile.email && !profile.id) {
        profile.id = profile.email;
        delete profile.email;
        localStorage.setItem('userProfile', JSON.stringify(profile));
      }
      return profile;
    }
    return { nickname: "사용자", id: "user123", avatar: null };
  };

  const [userProfile, setUserProfile] = useState(getUserProfile());

  // localStorage 변경 감지
  useEffect(() => {
    const handleStorageChange = () => {
      setUserProfile(getUserProfile());
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

  // 더미 토큰 데이터
  const tokenData = {
    tokensUsed: 132,
    tokensTotal: 200,
  };

  const handleSwitchToSignUp = () => {
    setIsLoginOpen(false);
    setIsSignUpOpen(true);
  };

  const handleSwitchToLogin = () => {
    setIsSignUpOpen(false);
    setIsLoginOpen(true);
  };

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    localStorage.setItem('isLoggedIn', 'true');
    setIsLoginOpen(false);
    setIsSignUpOpen(false);
    toast({
      title: "로그인 되었습니다",
      description: "환영합니다!",
    });
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('isLoggedIn');
    toast({
      title: "로그아웃되었습니다",
      description: "다음에 또 만나요!",
    });
    navigate("/");
  };

  const getUserInitials = () => {
    const nickname = userProfile?.nickname || "사용자";
    return nickname.charAt(0);
  };

  return (
    <>
      <AuthModals
        isLoginOpen={isLoginOpen}
        isSignUpOpen={isSignUpOpen}
        onLoginClose={() => setIsLoginOpen(false)}
        onSignUpClose={() => setIsSignUpOpen(false)}
        onSwitchToSignUp={handleSwitchToSignUp}
        onSwitchToLogin={handleSwitchToLogin}
        onLoginSuccess={handleLoginSuccess}
      />
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="max-w-7xl mx-auto px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link 
            to="/"
            className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground hover:text-primary transition-colors"
          >
            <img 
              src="/makery-logo.png" 
              alt="Makery Logo" 
              className="h-8 w-8 flex-shrink-0"
            />
            MAKERY
          </Link>

          {/* Center Menu */}
          <div className="hidden md:flex items-center gap-8">
            <Link 
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Home
            </Link>
            <Link 
              to="/logos"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              로고 갤러리
            </Link>
            <Link 
              to="/shorts"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              숏폼 갤러리
            </Link>
            <Link 
              to="/projects"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              내 프로젝트
            </Link>
            <Link 
              to="/plans"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              플랜 관리
            </Link>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <ThemeToggle />
            
            {isLoggedIn ? (
              <>
                {/* Token Badge */}
                <Link to="/plans">
                  <Badge 
                    variant="secondary" 
                    className="px-3 py-1.5 cursor-pointer hover:bg-primary/20 transition-colors bg-primary/10 border-primary/20 flex items-center gap-1.5"
                  >
                    <Zap className="h-3.5 w-3.5 text-primary fill-primary" />
                    <span className="text-foreground font-semibold">{tokenData.tokensUsed.toLocaleString()}</span>
                  </Badge>
                </Link>

                {/* Profile Dropdown */}
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button className="focus:outline-none">
                      <Avatar className="h-9 w-9 cursor-pointer hover:opacity-80 transition-opacity">
                        {userProfile.avatar ? (
                          <img src={userProfile.avatar} alt="Profile" className="h-full w-full object-cover" />
                        ) : (
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {getUserInitials()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    {/* User Info */}
                    <div className="px-2 py-3 flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        {userProfile.avatar ? (
                          <img src={userProfile.avatar} alt="Profile" className="h-full w-full object-cover" />
                        ) : (
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {getUserInitials()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{userProfile?.nickname || "사용자"}</p>
                        <p className="text-xs text-muted-foreground">{userProfile?.id || "user123"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Instagram 
                          className={`h-5 w-5 ${
                            userProfile?.instagram?.connected 
                              ? "text-pink-600 fill-pink-600" 
                              : "text-muted-foreground/30"
                          }`}
                        />
                        <Youtube 
                          className={`h-5 w-5 ${
                            userProfile?.youtube?.connected 
                              ? "text-red-600 fill-red-600" 
                              : "text-muted-foreground/30"
                          }`}
                        />
                      </div>
                    </div>
                    
                    <DropdownMenuSeparator />
                    
                    {/* Token Usage */}
                    <div className="px-2 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground">토큰 사용량</span>
                        <span className="text-xs font-semibold text-foreground">
                          {tokenData.tokensUsed} / {tokenData.tokensTotal}
                        </span>
                      </div>
                      <Progress 
                        value={(tokenData.tokensUsed / tokenData.tokensTotal) * 100} 
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
              </>
            ) : (
              <>
                <button 
                  onClick={() => setIsLoginOpen(true)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Log in
                </button>
                <Button 
                  size="sm" 
                  onClick={() => setIsSignUpOpen(true)}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Sign up
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
    </>
  );
};

export default Navigation;
