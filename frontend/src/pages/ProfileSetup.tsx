import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Header from "@/components/Header";
import { Settings, Facebook, Youtube, Instagram, Plus, Image, Video } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ProfileSetup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [connectedSocials, setConnectedSocials] = useState({
    facebook: false,
    youtube: false,
    instagram: false,
  });

  const [projects] = useState([
    {
      id: "1",
      title: "브랜드 A 프로젝트",
      logos: [
        { id: "1", title: "로고 1", image: "https://images.unsplash.com/photo-1634942537034-2531766767d1?w=400" },
        { id: "2", title: "로고 2", image: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400" },
      ],
      shorts: [
        { id: "1", title: "숏폼 1", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400" },
      ],
    },
    {
      id: "2",
      title: "브랜드 B 프로젝트",
      logos: [
        { id: "3", title: "로고 3", image: "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=400" },
      ],
      shorts: [
        { id: "2", title: "숏폼 2", image: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400" },
        { id: "3", title: "숏폼 3", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400" },
      ],
    },
  ]);

  const handleSocialConnect = (platform: string) => {
    setConnectedSocials((prev) => ({
      ...prev,
      [platform]: !prev[platform as keyof typeof prev],
    }));
    toast.success(`${platform} ${connectedSocials[platform as keyof typeof connectedSocials] ? '연동 해제' : '연동 완료'}`);
  };

  const socialPlatforms = [
    { name: "facebook", icon: Facebook, label: "Facebook", color: "text-blue-600" },
    { name: "youtube", icon: Youtube, label: "YouTube", color: "text-red-600" },
    { name: "instagram", icon: Instagram, label: "Instagram", color: "text-pink-600" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Profile Hero Section */}
      <div className="bg-gradient-to-b from-muted/50 to-background border-b">
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24 border-4 border-background shadow-xl">
                <AvatarImage src={user?.avatar} />
                <AvatarFallback className="bg-primary text-primary-foreground text-3xl">
                  {user?.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-3xl font-bold mb-2">{user?.name}</h1>
                <div className="flex gap-6 text-sm text-muted-foreground">
                  <span>프로젝트 <strong className="text-foreground">{projects.length}</strong></span>
                  <span>로고 <strong className="text-foreground">{projects.reduce((acc, p) => acc + p.logos.length, 0)}</strong></span>
                  <span>숏폼 <strong className="text-foreground">{projects.reduce((acc, p) => acc + p.shorts.length, 0)}</strong></span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => navigate("/dashboard")}>
                <Plus className="mr-2 h-4 w-4" />
                새 프로젝트
              </Button>
              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Social Connect Section */}
          <div className="mt-8 p-4 bg-card rounded-lg border">
            <h3 className="text-sm font-medium mb-4">소셜 계정 연동</h3>
            <div className="flex gap-4">
              {socialPlatforms.map((platform) => (
                <button
                  key={platform.name}
                  onClick={() => handleSocialConnect(platform.name)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all hover:scale-105 ${
                    connectedSocials[platform.name as keyof typeof connectedSocials]
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-primary/50'
                  }`}
                >
                  <platform.icon className={`h-8 w-8 ${platform.color}`} />
                  <span className="text-xs font-medium">{platform.label}</span>
                  {connectedSocials[platform.name as keyof typeof connectedSocials] && (
                    <Badge variant="secondary" className="text-xs">연동됨</Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Projects Section */}
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {projects.map((project) => (
            <Card key={project.id}>
              <CardContent className="pt-6">
                <h2 className="text-xl font-bold mb-4">{project.title}</h2>
                <Tabs defaultValue="logos" className="w-full">
                  <TabsList>
                    <TabsTrigger value="logos">
                      <Image className="mr-2 h-4 w-4" />
                      로고 ({project.logos.length})
                    </TabsTrigger>
                    <TabsTrigger value="shorts">
                      <Video className="mr-2 h-4 w-4" />
                      숏폼 ({project.shorts.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="logos" className="mt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {project.logos.map((logo) => (
                        <div
                          key={logo.id}
                          className="group relative aspect-square rounded-lg overflow-hidden border hover:shadow-lg transition-all cursor-pointer"
                        >
                          <img
                            src={logo.image}
                            alt={logo.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-sm font-medium">
                              {logo.title}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="shorts" className="mt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {project.shorts.map((short) => (
                        <div
                          key={short.id}
                          className="group relative aspect-[9/16] rounded-lg overflow-hidden border hover:shadow-lg transition-all cursor-pointer"
                        >
                          <img
                            src={short.image}
                            alt={short.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                          <Badge className="absolute top-2 right-2" variant="secondary">
                            <Video className="h-3 w-3" />
                          </Badge>
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-sm font-medium">
                              {short.title}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;
