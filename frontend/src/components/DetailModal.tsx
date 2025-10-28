import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heart, Eye, Share2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Comment {
  author: string;
  authorId: string;
  avatar?: string;
  text: string;
  time: string;
}

interface DetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  image: string;
  views: string;
  likes: string;
  isVideo?: boolean;
  comments?: Comment[];
}

const DetailModal = ({
  open,
  onOpenChange,
  title,
  image,
  views,
  likes,
  isVideo = false,
  comments = [
    { author: "김철수", authorId: "user1", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100", text: "정말 멋진 디자인이에요!", time: "2시간 전" },
    { author: "이영희", authorId: "user2", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100", text: "이런 스타일로 만들고 싶어요", time: "5시간 전" },
    { author: "박민수", authorId: "user3", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100", text: "색감이 너무 좋아요", time: "1일 전" },
  ],
}: DetailModalProps) => {
  const [liked, setLiked] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{title}</DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Image Section */}
          <div className="relative rounded-lg overflow-hidden bg-black aspect-square">
            <img
              src={image}
              alt={title}
              className="w-full h-full object-cover"
            />
            {isVideo && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors cursor-pointer">
                  <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[18px] border-l-white border-b-[12px] border-b-transparent ml-1" />
                </div>
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="flex flex-col gap-4">
            {/* Stats */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                className={`gap-1 ${liked ? "text-red-500" : ""}`}
                onClick={() => setLiked(!liked)}
              >
                <Heart className={`w-5 h-5 ${liked ? "fill-current" : ""}`} />
                <span>{likes}</span>
              </Button>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Eye className="w-5 h-5" />
                <span>{views}</span>
              </div>
              <Button variant="ghost" size="sm" className="gap-1 ml-auto">
                <Share2 className="w-5 h-5" />
              </Button>
            </div>

            {/* Create Similar Button */}
            <Button className="w-full gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90">
              <Sparkles className="w-4 h-4" />
              이 스타일로 새로운 작품을 만들기
            </Button>

            {/* Comments */}
            <div className="flex-1 border-t border-border pt-4">
              <h3 className="font-semibold mb-4">댓글</h3>
              <div className="space-y-4 mb-4">
                {comments.map((comment, index) => (
                  <div key={index} className="text-sm flex gap-3">
                    <Link to={`/profile/${comment.authorId}`}>
                      <Avatar className="w-8 h-8 cursor-pointer hover:opacity-80 transition-opacity">
                        <AvatarImage src={comment.avatar} />
                        <AvatarFallback>{comment.author[0]}</AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Link to={`/profile/${comment.authorId}`} className="font-semibold hover:underline">
                          {comment.author}
                        </Link>
                        <span className="text-xs text-muted-foreground">{comment.time}</span>
                      </div>
                      <p className="text-muted-foreground">{comment.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Comment Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="댓글을 입력하세요..."
                  className="flex-1"
                />
                <Button>게시</Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DetailModal;
