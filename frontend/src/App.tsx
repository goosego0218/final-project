import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import LogosPage from "./pages/LogosPage";
import ShortsPage from "./pages/ShortsPage";
import ShortsReportPage from "./pages/ShortsReportPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDashboardPage from "./pages/ProjectDashboardPage";
import PlansPage from "./pages/PlansPage";
import StudioPage from "./pages/StudioPage";
import AccountPage from "./pages/AccountPage";
import MyPage from "./pages/MyPage";
import ChatPage from "./pages/ChatPage";
import LogoChatPage from "./pages/LogoChatPage";
import ShortsChatPage from "./pages/ShortsChatPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  return (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/logo-gallery" element={<LogosPage />} />
            <Route path="/shortform-gallery" element={<ShortsPage />} />
            <Route path="/shortsReport" element={<ShortsReportPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/project" element={<ProjectDashboardPage />} />
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/chat/logo" element={<LogoChatPage />} />
            <Route path="/chat/shorts" element={<ShortsChatPage />} />
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
