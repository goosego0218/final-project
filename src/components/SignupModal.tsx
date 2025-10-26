import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface SignupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SignupModal = ({ open, onOpenChange }: SignupModalProps) => {
  const { completeSignup } = useAuth();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");

  const handleComplete = () => {
    if (!nickname.trim()) {
      toast.error("닉네임을 입력해주세요");
      return;
    }

    completeSignup({
      name: nickname,
      bio: bio,
    });

    toast.success("회원가입이 완료되었습니다!");
    onOpenChange(false);
    navigate("/");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">회원가입</DialogTitle>
          <DialogDescription className="text-center">
            프로필 정보를 입력해주세요
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nickname">닉네임 *</Label>
            <Input
              id="nickname"
              placeholder="사용할 닉네임을 입력하세요"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">소개</Label>
            <Textarea
              id="bio"
              placeholder="자기소개를 입력하세요 (선택사항)"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={200}
              rows={4}
            />
          </div>

          <Button 
            onClick={handleComplete}
            className="w-full"
          >
            가입 완료
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SignupModal;
