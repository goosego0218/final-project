import { useParams } from "react-router-dom";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GalleryCard from "@/components/GalleryCard";
import { useEffect, useState } from "react";

interface Creation {
  id: string;
  title: string;
  image: string;
  date: string;
  projectId: string;
  isPublic: boolean;
  views: number;
  likes: number;
}

const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const [publicCreations, setPublicCreations] = useState<{ logos: Creation[]; shorts: Creation[] }>({
    logos: [],
    shorts: [],
  });
  const [showAllLogos, setShowAllLogos] = useState(false);
  const [showAllShorts, setShowAllShorts] = useState(false);
  const [showAllCreations, setShowAllCreations] = useState(false);

  const ITEMS_PER_PAGE = 5;

  useEffect(() => {
    // Load public creations from localStorage
    const savedCreations = localStorage.getItem("creations");
    if (savedCreations) {
      const allCreations: { logos: Creation[]; shorts: Creation[] } = JSON.parse(savedCreations);
      
      // Filter only public creations
      setPublicCreations({
        logos: allCreations.logos.filter(logo => logo.isPublic),
        shorts: allCreations.shorts.filter(short => short.isPublic),
      });
    }
  }, [userId]);

  // Mock user data - in real app, fetch from backend
  const user = {
    id: userId,
    name: userId === "user1" ? "김철수" : userId === "user2" ? "이영희" : "박민수",
    avatar: userId === "user1" 
      ? "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100" 
      : userId === "user2" 
      ? "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100" 
      : "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100",
    bio: "AI 크리에이터",
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-start gap-6">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={user.avatar} />
                  <AvatarFallback>{user.name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold mb-2">{user.name}</h1>
                  <p className="text-muted-foreground mb-4">{user.bio}</p>
                  <div className="flex gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {publicCreations.logos.length + publicCreations.shorts.length}
                      </div>
                      <div className="text-xs text-muted-foreground">작품</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="all">
                    전체 ({publicCreations.logos.length + publicCreations.shorts.length})
                  </TabsTrigger>
                  <TabsTrigger value="logos">
                    로고 ({publicCreations.logos.length})
                  </TabsTrigger>
                  <TabsTrigger value="shorts">
                    숏폼 ({publicCreations.shorts.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="mt-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {(showAllCreations 
                      ? [...publicCreations.logos, ...publicCreations.shorts]
                      : [...publicCreations.logos, ...publicCreations.shorts].slice(0, ITEMS_PER_PAGE)
                    ).map((creation) => (
                      <GalleryCard
                        key={creation.id}
                        image={creation.image}
                        views={creation.views.toString()}
                        likes={creation.likes.toString()}
                        isVideo={publicCreations.shorts.includes(creation)}
                      />
                    ))}
                  </div>
                  {publicCreations.logos.length === 0 && publicCreations.shorts.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      공개된 작품이 없습니다
                    </div>
                  )}
                  {!showAllCreations && (publicCreations.logos.length + publicCreations.shorts.length) > ITEMS_PER_PAGE && (
                    <div className="flex justify-center mt-6">
                      <Button 
                        variant="outline"
                        onClick={() => setShowAllCreations(true)}
                      >
                        더보기 ({publicCreations.logos.length + publicCreations.shorts.length - ITEMS_PER_PAGE}개 더)
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="logos" className="mt-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {(showAllLogos 
                      ? publicCreations.logos 
                      : publicCreations.logos.slice(0, ITEMS_PER_PAGE)
                    ).map((logo) => (
                      <GalleryCard
                        key={logo.id}
                        image={logo.image}
                        views={logo.views.toString()}
                        likes={logo.likes.toString()}
                      />
                    ))}
                  </div>
                  {publicCreations.logos.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      공개된 로고가 없습니다
                    </div>
                  )}
                  {!showAllLogos && publicCreations.logos.length > ITEMS_PER_PAGE && (
                    <div className="flex justify-center mt-6">
                      <Button 
                        variant="outline"
                        onClick={() => setShowAllLogos(true)}
                      >
                        더보기 ({publicCreations.logos.length - ITEMS_PER_PAGE}개 더)
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="shorts" className="mt-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {(showAllShorts 
                      ? publicCreations.shorts 
                      : publicCreations.shorts.slice(0, ITEMS_PER_PAGE)
                    ).map((short) => (
                      <GalleryCard
                        key={short.id}
                        image={short.image}
                        views={short.views.toString()}
                        likes={short.likes.toString()}
                        isVideo={true}
                      />
                    ))}
                  </div>
                  {publicCreations.shorts.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      공개된 숏폼이 없습니다
                    </div>
                  )}
                  {!showAllShorts && publicCreations.shorts.length > ITEMS_PER_PAGE && (
                    <div className="flex justify-center mt-6">
                      <Button 
                        variant="outline"
                        onClick={() => setShowAllShorts(true)}
                      >
                        더보기 ({publicCreations.shorts.length - ITEMS_PER_PAGE}개 더)
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
