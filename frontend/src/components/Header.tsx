import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Image, Video, FolderKanban, User, Menu, CreditCard } from "lucide-react";
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
    { icon: Home, label: "홈", path: "/" },
    { icon: Image, label: "로고 갤러리", path: "/logos" },
    { icon: Video, label: "숏폼 갤러리", path: "/shorts" },
    { icon: FolderKanban, label: "내 프로젝트", path: "/dashboard" },
    { icon: CreditCard, label: "플랜관리", path: "/plan-management" },
    { icon: User, label: "프로필", path: "/profile-setup" },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center space-x-2">
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Makary
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-2">
              {menuItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium transition-all duration-200",
                    "hover:bg-accent hover:text-accent-foreground",
                    location.pathname === item.path
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Mobile Navigation */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {menuItems.map((item) => (
                  <DropdownMenuItem
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className="cursor-pointer"
                  >
                    <item.icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <ProfileDropdown />
            ) : (
              <Button
                onClick={() => setIsLoginModalOpen(true)}
                className="bg-primary hover:bg-primary/90"
              >
                사용하기
              </Button>
            )}
          </div>
        </div>
      </header>

      <LoginModal open={isLoginModalOpen} onOpenChange={setIsLoginModalOpen} />
    </>
  );
};

export default Header;
