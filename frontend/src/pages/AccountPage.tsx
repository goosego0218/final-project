import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Camera, Instagram, Youtube } from "lucide-react";

const AccountPage = () => {
  const { toast } = useToast();
  
  // localStorage에서 사용자 정보 불러오기
  const getUserProfile = () => {
    const stored = localStorage.getItem('userProfile');
    if (stored) {
      const profile = JSON.parse(stored);
      // 기존 name 필드를 nickname으로 마이그레이션
      if (profile.name && !profile.nickname) {
        profile.nickname = profile.name;
        delete profile.name;
      }
      // 기존 email 필드를 id로 마이그레이션
      if (profile.email && !profile.id) {
        profile.id = profile.email;
        delete profile.email;
      }
      return profile;
    }
    return { nickname: "사용자", id: "user123", avatar: null };
  };
  
  const [nickname, setNickname] = useState(getUserProfile().nickname || "사용자");
  const [userId, setUserId] = useState(getUserProfile().id || "user123");
  const [avatar, setAvatar] = useState<string | null>(getUserProfile().avatar || null);
  const [instagramConnected, setInstagramConnected] = useState(getUserProfile().instagram?.connected || false);
  const [youtubeConnected, setYoutubeConnected] = useState(getUserProfile().youtube?.connected || false);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 파일 크기 확인 (5MB 제한)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "파일이 너무 큽니다",
          description: "5MB 이하의 이미지를 선택해주세요.",
          variant: "destructive",
        });
        return;
      }

      // 이미지를 base64로 변환
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setAvatar(base64String);
        
        toast({
          title: "사진이 업로드되었습니다",
          description: "변경사항 저장 버튼을 눌러 프로필을 저장하세요.",
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    // localStorage에 사용자 정보 저장
    localStorage.setItem('userProfile', JSON.stringify({
      nickname,
      id: userId,
      avatar,
      instagram: { connected: instagramConnected },
      youtube: { connected: youtubeConnected }
    }));
    
    // 커스텀 이벤트 발생시켜 Navigation에 즉시 반영
    window.dispatchEvent(new Event('profileUpdated'));
    
    toast({
      title: "프로필이 저장되었습니다",
      description: "변경사항이 성공적으로 저장되었습니다.",
    });
  };

  const handleInstagramConnect = () => {
    setInstagramConnected(true);
    toast({
      title: "인스타그램 연동",
      description: "인스타그램이 연동되었습니다.",
    });
  };

  const handleInstagramDisconnect = () => {
    setInstagramConnected(false);
    toast({
      title: "인스타그램 연동 해제",
      description: "인스타그램 연동이 해제되었습니다.",
    });
  };

  const handleYoutubeConnect = () => {
    setYoutubeConnected(true);
    toast({
      title: "유튜브 연동",
      description: "유튜브가 연동되었습니다.",
    });
  };

  const handleYoutubeDisconnect = () => {
    setYoutubeConnected(false);
    toast({
      title: "유튜브 연동 해제",
      description: "유튜브 연동이 해제되었습니다.",
    });
  };

  const getUserInitials = () => {
    return nickname.charAt(0);
  };

  const handleAvatarClick = () => {
    document.getElementById('avatar-upload')?.click();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="pt-20">
        <div className="max-w-6xl mx-auto px-8 py-16">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              내 프로필
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              프로필 정보를 관리하고 계정 설정을 변경하세요.
            </p>
          </div>
        
          <div className="max-w-4xl mx-auto">
            {/* Profile Information */}
            <Card>
              <CardHeader>
                <CardTitle>프로필 정보</CardTitle>
                <CardDescription>프로필 사진과 닉네임을 관리하세요</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Profile Picture Section */}
                <div className="space-y-4">
                  <Label>프로필 사진</Label>
                  <div className="flex items-center gap-6">
                    <Avatar className="h-24 w-24">
                      {avatar ? (
                        <img src={avatar} alt="Profile" className="h-full w-full object-cover" />
                      ) : (
                        <AvatarFallback className="bg-primary text-primary-foreground text-3xl">
                          {getUserInitials()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex flex-col gap-2">
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                      <Button variant="outline" className="gap-2" onClick={handleAvatarClick}>
                        <Camera className="h-4 w-4" />
                        사진 변경
                      </Button>
                      {avatar && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setAvatar(null);
                            toast({
                              title: "사진이 제거되었습니다",
                              description: "변경사항 저장 버튼을 눌러 프로필을 저장하세요.",
                            });
                          }}
                        >
                          사진 제거
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Personal Information Section */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nickname">닉네임</Label>
                    <Input 
                      id="nickname" 
                      value={nickname} 
                      onChange={(e) => setNickname(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="userId">아이디</Label>
                    <Input 
                      id="userId" 
                      type="text" 
                      value={userId} 
                      disabled
                      className="bg-muted cursor-not-allowed"
                    />
                    <p className="text-xs text-muted-foreground">아이디는 변경할 수 없습니다</p>
                  </div>
                  
                  <Button onClick={handleSave} className="w-full sm:w-auto">
                    변경사항 저장
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Social Media Connections */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>소셜 미디어 연동</CardTitle>
                <CardDescription>인스타그램과 유튜브 계정을 연동하세요</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Instagram Connection */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      instagramConnected 
                        ? "bg-gradient-to-br from-purple-600 via-pink-600 to-orange-600" 
                        : "bg-muted-foreground/20"
                    }`}>
                      <Instagram className={`h-5 w-5 ${
                        instagramConnected ? "text-white" : "text-muted-foreground"
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium">Instagram</p>
                      <p className="text-sm text-muted-foreground">
                        {instagramConnected ? "연동됨" : "연동되지 않음"}
                      </p>
                    </div>
                  </div>
                  {instagramConnected ? (
                    <Button variant="outline" onClick={handleInstagramDisconnect}>
                      연동 끊기
                    </Button>
                  ) : (
                    <Button onClick={handleInstagramConnect}>
                      연동하기
                    </Button>
                  )}
                </div>

                {/* YouTube Connection */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      youtubeConnected ? "bg-red-600" : "bg-muted-foreground/20"
                    }`}>
                      <Youtube className={`h-5 w-5 ${
                        youtubeConnected ? "text-white" : "text-muted-foreground"
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium">YouTube</p>
                      <p className="text-sm text-muted-foreground">
                        {youtubeConnected ? "연동됨" : "연동되지 않음"}
                      </p>
                    </div>
                  </div>
                  {youtubeConnected ? (
                    <Button variant="outline" onClick={handleYoutubeDisconnect}>
                      연동 끊기
                    </Button>
                  ) : (
                    <Button onClick={handleYoutubeConnect}>
                      연동하기
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default AccountPage;
