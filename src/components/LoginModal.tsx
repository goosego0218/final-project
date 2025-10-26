import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LoginModal = ({ open, onOpenChange }: LoginModalProps) => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = (provider: string) => {
    login(provider);
    toast.success(`${provider}로 로그인되었습니다`);
    onOpenChange(false);
    navigate("/profile-setup");
  };

  const loginProviders = [
    {
      name: "Kakao",
      color: "bg-[#FEE500] hover:bg-[#FEE500]/90 text-black",
      icon: "💬",
    },
    {
      name: "Naver",
      color: "bg-[#03C75A] hover:bg-[#03C75A]/90 text-white",
      icon: "N",
    },
    {
      name: "Google",
      color: "bg-white hover:bg-white/90 text-black border border-input",
      icon: "G",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">로그인</DialogTitle>
          <DialogDescription className="text-center">
            간편하게 소셜 계정으로 로그인하세요
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-3 py-4">
          {loginProviders.map((provider) => (
            <Button
              key={provider.name}
              onClick={() => handleLogin(provider.name)}
              className={`w-full h-12 text-base font-medium ${provider.color}`}
            >
              <span className="mr-2 text-xl">{provider.icon}</span>
              {provider.name}로 계속하기
            </Button>
          ))}
        </div>

        <p className="text-xs text-center text-muted-foreground">
          로그인하면 이용약관 및 개인정보처리방침에 동의하는 것으로 간주됩니다
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default LoginModal;
