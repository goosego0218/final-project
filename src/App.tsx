import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import SignupModal from "./components/SignupModal";
import { useState, useEffect } from "react";
import Index from "./pages/Index";
import LogosGallery from "./pages/LogosGallery";
import ShortsGallery from "./pages/ShortsGallery";
import ProfileSetup from "./pages/ProfileSetup";
import Dashboard from "./pages/Dashboard";
import ProjectDetail from "./pages/ProjectDetail";
import UserProfile from "./pages/UserProfile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  const { isNewUser } = useAuth();
  const [signupModalOpen, setSignupModalOpen] = useState(false);

  // Show signup modal for new users
  useEffect(() => {
    if (isNewUser) {
      setSignupModalOpen(true);
    }
  }, [isNewUser]);

  return (
    <>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/logos" element={<LogosGallery />} />
        <Route path="/shorts" element={<ShortsGallery />} />
        <Route path="/profile-setup" element={<ProfileSetup />} />
        <Route path="/profile/:userId" element={<UserProfile />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/project/:projectId" element={<ProjectDetail />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      <SignupModal open={signupModalOpen} onOpenChange={setSignupModalOpen} />
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
