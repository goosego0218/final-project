import { useState, useEffect, useRef } from "react";
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
import { Zap, User, FolderOpen, CreditCard, Heart, Instagram, Youtube, BarChart3 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMenus, Menu } from "@/lib/api";

const Navigation = () => {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 초기 로그인 상태를 즉시 확인하여 깜빡임 방지
  // 토큰이 있는지도 함께 확인
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    const hasLoginFlag = localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true';
    const hasToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    // 로그인 플래그와 토큰이 모두 있어야 로그인 상태로 인식
    return hasLoginFlag && !!hasToken;
  });

  // 메뉴 데이터 가져오기 - 로그인 상태를 queryKey에 포함하여 로그인 상태 변경 시 자동으로 다시 가져오기
  const { data: menus = [], isLoading: isMenusLoading } = useQuery({
    queryKey: ['menus', isLoggedIn],
    queryFn: getMenus,
    staleTime: 0, // 로그인 상태 변경 시 즉시 다시 가져오기 위해 staleTime을 0으로 설정
  });

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
  
  // interval 내부에서 최신 상태를 참조하기 위한 ref
  const isLoggedInRef = useRef(isLoggedIn);
  
  // isLoggedIn이 변경될 때마다 ref 업데이트
  useEffect(() => {
    isLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn]);

  // localStorage 변경 감지
  useEffect(() => {
    const handleStorageChange = () => {
      const hasLoginFlag = localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true';
      const hasToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
      const newLoggedIn = hasLoginFlag && !!hasToken;
      setIsLoggedIn(newLoggedIn);
      setUserProfile(getUserProfile());
    };
    
    const handleProfileUpdate = () => {
      setUserProfile(getUserProfile());
    };
    
    const handleLogout = () => {
      setIsLoggedIn(false);
      setUserProfile({ nickname: "사용자", id: "user123", avatar: null });
      queryClient.invalidateQueries({ queryKey: ['menus'] });
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('profileUpdated', handleProfileUpdate);
    window.addEventListener('logout', handleLogout);
    
    // 같은 탭에서의 변경도 감지하기 위해 interval 사용 (5초로 변경하여 깜빡임 최소화)
    const interval = setInterval(() => {
      const hasLoginFlag = localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true';
      const hasToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
      const currentLoggedIn = hasLoginFlag && !!hasToken;
      // 상태가 실제로 변경된 경우에만 업데이트
      if (currentLoggedIn !== isLoggedInRef.current) {
        setIsLoggedIn(currentLoggedIn);
      }
      // 프로필 정보는 항상 최신 상태로 유지
      setUserProfile(getUserProfile());
    }, 5000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('profileUpdated', handleProfileUpdate);
      window.removeEventListener('logout', handleLogout);
      clearInterval(interval);
    };
  }, [queryClient]);

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

  const handleLoginSuccess = (rememberMe: boolean, isSignUp?: boolean) => {
    setIsLoggedIn(true);
    if (rememberMe) {
      localStorage.setItem('isLoggedIn', 'true');
      sessionStorage.removeItem('isLoggedIn');
    } else {
      sessionStorage.setItem('isLoggedIn', 'true');
      localStorage.removeItem('isLoggedIn');
    }
    setIsLoginOpen(false);
    setIsSignUpOpen(false);
    
    // 메뉴 쿼리 무효화 및 다시 가져오기
    queryClient.invalidateQueries({ queryKey: ['menus'] });
    
    // 회원가입이 아닌 경우에만 로그인 토스트 표시
    if (!isSignUp) {
      toast({
        title: "로그인 되었습니다",
        description: "환영합니다!",
        status: "success",
      });
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userProfile');
    localStorage.removeItem('accessToken');
    sessionStorage.removeItem('accessToken');
    
    // 메뉴 쿼리 무효화 및 다시 가져오기
    queryClient.invalidateQueries({ queryKey: ['menus'] });
    
    // 프로필 업데이트 이벤트 발생
    window.dispatchEvent(new Event('profileUpdated'));
    
    toast({
      title: "로그아웃되었습니다",
      description: "다음에 또 만나요!",
      status: "success",
    });
    navigate("/");
  };

  const getUserInitials = () => {
    const nickname = userProfile?.nickname || "사용자";
    return nickname.charAt(0);
  };

  // 메뉴를 상위 메뉴 기준으로 그룹화하고 menu_order로 정렬
  const topLevelMenus = menus
    .filter(menu => menu.up_menu_id === null)
    .sort((a, b) => {
      // menu_order가 null인 경우 뒤로
      if (a.menu_order === null && b.menu_order === null) return 0;
      if (a.menu_order === null) return 1;
      if (b.menu_order === null) return -1;
      return a.menu_order - b.menu_order;
    });
  const subMenus = menus.filter(menu => menu.up_menu_id !== null);

  // DB 메뉴에서 특정 메뉴 찾기 헬퍼 함수
  const findMenuByPath = (path: string) => {
    return menus.find(menu => menu.menu_path === path);
  };
  
  // DB 메뉴에서 특정 메뉴명으로 찾기 헬퍼 함수
  const findMenuByName = (name: string) => {
    return menus.find(menu => menu.menu_nm.includes(name));
  };
  
  // DB에서 가져온 메뉴 경로 사용
  const projectsMenu = findMenuByName("프로젝트") || findMenuByPath("/projects");
  const shortsReportMenu = findMenuByName("숏폼 리포트") || findMenuByPath("/shortsReport");

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

          {/* Center Menu - DB에서 가져온 메뉴로 렌더링 */}
          <div className="hidden md:flex items-center gap-8">
            {isMenusLoading ? (
              <div className="text-sm text-muted-foreground">로딩 중...</div>
            ) : (
              topLevelMenus.map((menu) => (
                <Link 
                  key={menu.menu_id}
                  to={menu.menu_path}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {menu.menu_nm}
                </Link>
              ))
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <ThemeToggle />
            
            {isLoggedIn ? (
              <>
                {/* Token Badge */}
                <Link to="/plans" className="flex-shrink-0">
                  <Badge 
                    variant="secondary" 
                    className="px-3 py-1.5 cursor-pointer hover:bg-primary/20 transition-colors bg-primary/10 border-primary/20 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Zap className="h-3.5 w-3.5 text-primary fill-primary flex-shrink-0" />
                    <span className="text-foreground font-semibold">{tokenData.tokensUsed.toLocaleString()}</span>
                  </Badge>
                </Link>

                {/* Profile Dropdown */}
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button className="focus:outline-none flex-shrink-0">
                      <Avatar className="h-9 w-9 cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0">
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
                        {userProfile?.instagram?.connected ? (
                          <img src="/icon/instagram-logo.png" alt="Instagram" className="h-5 w-5" />
                        ) : (
                          <Instagram className="h-5 w-5 text-muted-foreground/30" strokeWidth={1.5} />
                        )}
                        {userProfile?.youtube?.connected ? (
                          <img src="/icon/youtube-logo.png" alt="YouTube" className="h-5 w-5 object-contain" />
                        ) : (
                          <Youtube className="h-5 w-5 text-muted-foreground/30" strokeWidth={1.5} />
                        )}
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
                    <DropdownMenuItem onClick={() => navigate("/account")}>
                      <User className="h-4 w-4 mr-2" />
                      내 프로필
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/mypage")}>
                      <Heart className="h-4 w-4 mr-2" />
                      마이페이지
                    </DropdownMenuItem>
                    {projectsMenu && (
                      <DropdownMenuItem onClick={() => navigate(projectsMenu.menu_path)}>
                        <FolderOpen className="h-4 w-4 mr-2" />
                        {projectsMenu.menu_nm}
                      </DropdownMenuItem>
                    )}
                    {shortsReportMenu && (
                      <DropdownMenuItem onClick={() => navigate(shortsReportMenu.menu_path)}>
                        <BarChart3 className="h-4 w-4 mr-2" />
                        {shortsReportMenu.menu_nm}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => navigate("/plans")}>
                      <CreditCard className="h-4 w-4 mr-2" />
                      플랜 관리
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
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 whitespace-nowrap"
                >
                  Log in
                </button>
                <Button 
                  size="sm" 
                  onClick={() => setIsSignUpOpen(true)}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0 whitespace-nowrap"
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
