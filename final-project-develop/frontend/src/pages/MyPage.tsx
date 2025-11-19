import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Share2, MessageCircle, Eye, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

const MyPage = () => {
  const navigate = useNavigate();
  const [sharedFilter, setSharedFilter] = useState<"all" | "logo" | "short">("all");
  const [likedFilter, setLikedFilter] = useState<"all" | "logo" | "short">("all");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [newComment, setNewComment] = useState("");
  const [comments, setComments] = useState<Array<{ id: number; author: string; text: string; time: string }>>([
    { id: 1, author: "김철수", text: "정말 멋진 디자인이에요!", time: "2시간 전" },
    { id: 2, author: "이영희", text: "색감이 너무 좋아요", time: "5시간 전" },
  ]);
  
  // 더미 데이터 - 좋아요한 작품들
  const likedItems = [
    {
      id: 1,
      type: "logo" as const,
      image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe",
      title: "Modern Tech Logo",
      likes: 324,
    },
    {
      id: 2,
      type: "short" as const,
      image: "https://images.unsplash.com/photo-1611162617474-5b21e879e113",
      title: "Fashion Reel",
      likes: 156,
    },
    {
      id: 3,
      type: "logo" as const,
      image: "https://images.unsplash.com/photo-1634942537034-2531766767d1",
      title: "Minimal Brand Logo",
      likes: 892,
    },
  ];

  // 더미 데이터 - 공유한 작품들
  const sharedItems = [
    {
      id: 1,
      type: "logo" as const,
      image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe",
      title: "My Logo Design",
      likes: 45,
      shares: 12,
      comments: 8,
      views: 320,
    },
    {
      id: 2,
      type: "short" as const,
      image: "https://images.unsplash.com/photo-1611162617474-5b21e879e113",
      title: "My Short Video",
      likes: 128,
      shares: 34,
      comments: 23,
      views: 1240,
    },
    {
      id: 3,
      type: "logo" as const,
      image: "https://images.unsplash.com/photo-1634942537034-2531766767d1",
      title: "Brand Logo 2",
      likes: 67,
      shares: 18,
      comments: 12,
      views: 540,
    },
  ];

  const filteredSharedItems = sharedFilter === "all" 
    ? [...sharedItems.filter(item => item.type === "logo"), ...sharedItems.filter(item => item.type === "short")]
    : sharedItems.filter(item => item.type === sharedFilter);

  const filteredLikedItems = likedFilter === "all"
    ? [...likedItems.filter(item => item.type === "logo"), ...likedItems.filter(item => item.type === "short")]
    : likedItems.filter(item => item.type === likedFilter);

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    
    setComments(prev => [
      ...prev,
      {
        id: Date.now(),
        author: "홍길동",
        text: newComment,
        time: "방금 전"
      }
    ]);
    setNewComment("");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="pt-20">
        <div className="max-w-6xl mx-auto px-8 py-16">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              마이페이지
            </h1>
            <p className="text-xl text-muted-foreground">
              내가 만든 작품과 좋아하는 작품들을 관리하세요
            </p>
          </div>
          
          <Tabs defaultValue="shared" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-8 mx-auto">
              <TabsTrigger value="shared">공유한 작품</TabsTrigger>
              <TabsTrigger value="liked">좋아요한 작품</TabsTrigger>
            </TabsList>
            
            <TabsContent value="shared" className="space-y-6">
              <div className="flex gap-2 mb-6">
                <Badge 
                  variant={sharedFilter === "all" ? "default" : "outline"}
                  className="cursor-pointer px-4 py-2"
                  onClick={() => setSharedFilter("all")}
                >
                  전체
                </Badge>
                <Badge 
                  variant={sharedFilter === "logo" ? "default" : "outline"}
                  className="cursor-pointer px-4 py-2"
                  onClick={() => setSharedFilter("logo")}
                >
                  로고
                </Badge>
                <Badge 
                  variant={sharedFilter === "short" ? "default" : "outline"}
                  className="cursor-pointer px-4 py-2"
                  onClick={() => setSharedFilter("short")}
                >
                  숏츠
                </Badge>
              </div>
              
              {sharedFilter === "all" ? (
                <>
                  {/* 로고 섹션 */}
                  {sharedItems.filter(item => item.type === "logo").length > 0 && (
                    <div className="space-y-4">
                      <h2 className="text-2xl font-semibold text-foreground">로고</h2>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {sharedItems.filter(item => item.type === "logo").map((item) => (
                          <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                            <CardContent className="p-0">
                              <div 
                                className="relative overflow-hidden aspect-square"
                                onClick={() => setSelectedItem(item)}
                              >
                                <img 
                                  src={item.image} 
                                  alt={item.title}
                                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                                />
                              </div>
                              <div className="p-4 space-y-3">
                                <h3 className="font-semibold text-foreground">{item.title}</h3>
                                
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <Heart className="h-4 w-4" />
                                    <span>{item.likes}</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <Share2 className="h-4 w-4" />
                                    <span>{item.shares}</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <MessageCircle className="h-4 w-4" />
                                    <span>{item.comments}</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <Eye className="h-4 w-4" />
                                    <span>{item.views}</span>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 숏츠 섹션 */}
                  {sharedItems.filter(item => item.type === "short").length > 0 && (
                    <div className="space-y-4 mt-8">
                      <h2 className="text-2xl font-semibold text-foreground">숏츠</h2>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {sharedItems.filter(item => item.type === "short").map((item) => (
                          <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                            <CardContent className="p-0">
                              <div 
                                className="relative overflow-hidden aspect-[9/16]"
                                onClick={() => setSelectedItem(item)}
                              >
                                <img 
                                  src={item.image} 
                                  alt={item.title}
                                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                                />
                              </div>
                              <div className="p-4 space-y-3">
                                <h3 className="font-semibold text-foreground">{item.title}</h3>
                                
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <Heart className="h-4 w-4" />
                                    <span>{item.likes}</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <Share2 className="h-4 w-4" />
                                    <span>{item.shares}</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <MessageCircle className="h-4 w-4" />
                                    <span>{item.comments}</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <Eye className="h-4 w-4" />
                                    <span>{item.views}</span>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredSharedItems.map((item) => (
                    <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                      <CardContent className="p-0">
                        <div 
                          className={`relative overflow-hidden ${item.type === "logo" ? "aspect-square" : "aspect-[9/16]"}`}
                          onClick={() => setSelectedItem(item)}
                        >
                          <img 
                            src={item.image} 
                            alt={item.title}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                        <div className="p-4 space-y-3">
                          <h3 className="font-semibold text-foreground">{item.title}</h3>
                          
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Heart className="h-4 w-4" />
                              <span>{item.likes}</span>
                            </div>
                            
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Share2 className="h-4 w-4" />
                              <span>{item.shares}</span>
                            </div>
                            
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <MessageCircle className="h-4 w-4" />
                              <span>{item.comments}</span>
                            </div>
                            
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Eye className="h-4 w-4" />
                              <span>{item.views}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="liked" className="space-y-6">
              <div className="flex gap-2 mb-6">
                <Badge 
                  variant={likedFilter === "all" ? "default" : "outline"}
                  className="cursor-pointer px-4 py-2"
                  onClick={() => setLikedFilter("all")}
                >
                  전체
                </Badge>
                <Badge 
                  variant={likedFilter === "logo" ? "default" : "outline"}
                  className="cursor-pointer px-4 py-2"
                  onClick={() => setLikedFilter("logo")}
                >
                  로고
                </Badge>
                <Badge 
                  variant={likedFilter === "short" ? "default" : "outline"}
                  className="cursor-pointer px-4 py-2"
                  onClick={() => setLikedFilter("short")}
                >
                  숏츠
                </Badge>
              </div>
              
              {likedFilter === "all" ? (
                <>
                  {/* 로고 섹션 */}
                  {likedItems.filter(item => item.type === "logo").length > 0 && (
                    <div className="space-y-4">
                      <h2 className="text-2xl font-semibold text-foreground">로고</h2>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {likedItems.filter(item => item.type === "logo").map((item) => (
                          <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                            <CardContent className="p-0">
                              <div 
                                className="relative overflow-hidden aspect-square"
                                onClick={() => setSelectedItem(item)}
                              >
                                <img 
                                  src={item.image} 
                                  alt={item.title}
                                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                                />
                              </div>
                              <div className="p-4 space-y-3">
                                <h3 className="font-semibold text-foreground">{item.title}</h3>
                                
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                  <Heart className="h-4 w-4 fill-primary text-primary" />
                                  <span>{item.likes} 좋아요</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 숏츠 섹션 */}
                  {likedItems.filter(item => item.type === "short").length > 0 && (
                    <div className="space-y-4 mt-8">
                      <h2 className="text-2xl font-semibold text-foreground">숏츠</h2>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {likedItems.filter(item => item.type === "short").map((item) => (
                          <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                            <CardContent className="p-0">
                              <div 
                                className="relative overflow-hidden aspect-[9/16]"
                                onClick={() => setSelectedItem(item)}
                              >
                                <img 
                                  src={item.image} 
                                  alt={item.title}
                                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                                />
                              </div>
                              <div className="p-4 space-y-3">
                                <h3 className="font-semibold text-foreground">{item.title}</h3>
                                
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                  <Heart className="h-4 w-4 fill-primary text-primary" />
                                  <span>{item.likes} 좋아요</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredLikedItems.map((item) => (
                    <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                      <CardContent className="p-0">
                        <div 
                          className={`relative overflow-hidden ${item.type === "logo" ? "aspect-square" : "aspect-[9/16]"}`}
                          onClick={() => setSelectedItem(item)}
                        >
                          <img 
                            src={item.image} 
                            alt={item.title}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                        <div className="p-4 space-y-3">
                          <h3 className="font-semibold text-foreground">{item.title}</h3>
                          
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Heart className="h-4 w-4 fill-primary text-primary" />
                            <span>{item.likes} 좋아요</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className={`max-w-4xl p-0 ${selectedItem?.type === "short" ? "max-h-[90vh]" : ""}`}>
          {selectedItem && (
            <div className="flex flex-col md:flex-row gap-0 max-h-[90vh]">
              {/* Left: Image */}
              <div className={`${selectedItem.type === "logo" ? "w-full md:w-1/2 aspect-square" : "w-full md:w-[40%] aspect-[9/16]"} bg-muted flex-shrink-0`}>
                <img 
                  src={selectedItem.image} 
                  alt={selectedItem.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Right: Details and Comments */}
              <div className="flex-1 flex flex-col min-h-0">
                {/* Header */}
                <div className="p-6 border-b">
                  <h2 className="text-2xl font-bold text-foreground mb-4">{selectedItem.title}</h2>
                  
                  {selectedItem.shares !== undefined && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Heart className="h-5 w-5" />
                        <span className="text-sm">{selectedItem.likes}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Share2 className="h-5 w-5" />
                        <span className="text-sm">{selectedItem.shares}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MessageCircle className="h-5 w-5" />
                        <span className="text-sm">{selectedItem.comments}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Eye className="h-5 w-5" />
                        <span className="text-sm">{selectedItem.views}</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 mt-4">
                    <Button size="sm" className="flex-1">
                      <Heart className="h-4 w-4 mr-2" />
                      좋아요
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1">
                      <Share2 className="h-4 w-4 mr-2" />
                      공유
                    </Button>
                  </div>
                </div>

                {/* Comments */}
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="px-6 py-3 border-b">
                    <h3 className="font-semibold text-foreground">댓글</h3>
                  </div>
                  
                  <ScrollArea className="flex-1 min-h-0 px-6 py-4">
                    <div className="space-y-4">
                      {comments.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          아직 댓글이 없습니다. 첫 댓글을 남겨보세요!
                        </p>
                      ) : (
                        comments.map((comment) => (
                          <div key={comment.id} className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-foreground">{comment.author}</span>
                              <span className="text-xs text-muted-foreground">{comment.time}</span>
                            </div>
                            <p className="text-sm text-foreground">{comment.text}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>

                  {/* Comment Input */}
                  <div className="p-4 border-t bg-background">
                    <div className="flex gap-2">
                      <Input
                        placeholder="댓글을 입력하세요..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                        className="flex-1"
                      />
                      <Button size="icon" onClick={handleAddComment}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      <Footer />
    </div>
  );
};

export default MyPage;
