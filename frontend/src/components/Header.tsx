import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Image, Video, FolderKanban, User, Menu, CreditCard, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import LoginModal from "./LoginModal";
import ProfileDropdown from "./ProfileDropdown";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const Header = () => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { label: "홈", path: "/", hasDropdown: false },
    { label: "로고 갤러리", path: "/logos", hasDropdown: true },
    { label: "숏폼 갤러리", path: "/shorts", hasDropdown: true },
    { label: "내 프로젝트", path: "/dashboard", hasDropdown: false },
    { label: "플랜관리", path: "/plan-management", hasDropdown: false },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-header border-b border-header-hover/30">
        <div className="container mx-auto">
          <div className="flex h-14 items-center justify-between px-6">
            {/* Logo */}
            <Link to="/" className="flex items-center shrink-0">
              <span className="text-xl font-bold text-header-foreground hover:opacity-80 transition-opacity tracking-wide">
                MAKARY
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-2">
              {menuItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-1 px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors",
                    "hover:bg-header-hover",
                    location.pathname === item.path
                      ? "text-header-foreground"
                      : "text-header-foreground/80"
                  )}
                >
                  {item.label}
                  {item.hasDropdown && <ChevronDown className="h-3 w-3" />}
                </Link>
              ))}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Mobile Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild className="lg:hidden">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-10 w-10 text-header-foreground hover:bg-header-hover hover:text-header-foreground"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-header border-header-hover">
                  {menuItems.map((item) => (
                    <DropdownMenuItem
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className="cursor-pointer text-header-foreground hover:bg-header-hover focus:bg-header-hover"
                    >
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem
                    onClick={() => navigate("/profile")}
                    className="cursor-pointer text-header-foreground hover:bg-header-hover focus:bg-header-hover"
                  >
                    프로필
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Auth / Profile */}
              <div className="hidden lg:flex items-center gap-2">
                {isAuthenticated ? (
                  <>
                    <Link
                      to="/profile"
                      className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-header-foreground/80 hover:text-header-foreground hover:bg-header-hover transition-colors"
                    >
                      프로필
                    </Link>
                    <ProfileDropdown />
                  </>
                ) : (
                  <Button
                    onClick={() => setIsLoginModalOpen(true)}
                    variant="ghost"
                    className="px-6 py-2 text-xs font-medium uppercase tracking-wider text-header-foreground bg-header-hover hover:bg-header-foreground/10 border border-header-foreground/20"
                  >
                    사용하기
                  </Button>
                )}
              </div>

              {/* Mobile Auth */}
              {!isAuthenticated && (
                <Button
                  onClick={() => setIsLoginModalOpen(true)}
                  variant="ghost"
                  className="lg:hidden px-4 py-2 text-xs font-medium uppercase tracking-wider text-header-foreground bg-header-hover hover:bg-header-foreground/10 border border-header-foreground/20"
                >
                  사용하기
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <LoginModal open={isLoginModalOpen} onOpenChange={setIsLoginModalOpen} />
    </>
  );
};

export default Header;
