import { Eye, Heart } from "lucide-react";

interface GalleryCardProps {
  image: string;
  views: string;
  likes: string;
  isVideo?: boolean;
  onClick?: () => void;
}

const GalleryCard = ({ image, views, likes, isVideo = false, onClick }: GalleryCardProps) => {
  return (
    <div 
      className="group relative flex-shrink-0 w-64 h-64 rounded-xl overflow-hidden bg-card transition-all duration-300 hover:scale-105 hover:shadow-[var(--shadow-glow)] cursor-pointer"
      onClick={onClick}
    >
      <div className="relative w-full h-full">
        <img
          src={image}
          alt="AI generated content"
          className="w-full h-full object-cover"
        />
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/30 transition-colors">
              <div className="w-0 h-0 border-t-8 border-t-transparent border-l-12 border-l-white border-b-8 border-b-transparent ml-1" />
            </div>
          </div>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center gap-4 text-sm text-white">
          <div className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            <span>{views}</span>
          </div>
          <div className="flex items-center gap-1">
            <Heart className="w-4 h-4" />
            <span>{likes}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GalleryCard;
