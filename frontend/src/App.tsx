import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import LogosPage from "./pages/LogosPage";
import ShortsPage from "./pages/ShortsPage";
import ProjectsPage from "./pages/ProjectsPage";
<<<<<<< HEAD
import ProjectDashboardPage from "./pages/ProjectDashboardPage";
=======
>>>>>>> 6c5c159b500ffac8ffb45544f3a1ffbaa2b43002
import PlansPage from "./pages/PlansPage";
import StudioPage from "./pages/StudioPage";
import AccountPage from "./pages/AccountPage";
import MyPage from "./pages/MyPage";
import ChatPage from "./pages/ChatPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

<<<<<<< HEAD
const App = () => {
  // 앱 초기 로드 시 로그아웃 상태로 설정
  useEffect(() => {
    localStorage.removeItem('isLoggedIn');
  }, []);

  return (
=======
const App = () => (
>>>>>>> 6c5c159b500ffac8ffb45544f3a1ffbaa2b43002
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/logos" element={<LogosPage />} />
            <Route path="/shorts" element={<ShortsPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
<<<<<<< HEAD
            <Route path="/project" element={<ProjectDashboardPage />} />
=======
>>>>>>> 6c5c159b500ffac8ffb45544f3a1ffbaa2b43002
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/studio" element={<StudioPage />} />
            <Route path="/mypage" element={<MyPage />} />
            <Route path="/account" element={<AccountPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
  );
};

export default App;
