import { useState, useEffect } from "react";
import Header from "@/components/Header";
import SearchHeader from "@/components/SearchHeader";
import AutoScrollGallery from "@/components/AutoScrollGallery";
import { GalleryItem } from "@/components/AutoScrollGallery";

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

const Index = () => {
  // Fallback sample data
  const fallbackLogos: GalleryItem[] = [
    { id: "1", title: "Halloween Night", image: "https://images.unsplash.com/photo-1634942537034-2531766767d1?w=400", views: "1.2k", likes: "89" },
    { id: "2", title: "Instagram Logo", image: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400", views: "2.6k", likes: "156" },
    { id: "3", title: "Digital Bust", image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400", views: "1.3k", likes: "234" },
    { id: "4", title: "Modern Design", image: "https://images.unsplash.com/photo-1634942537034-2531766767d1?w=400", views: "1.6k", likes: "178" },
    { id: "5", title: "Tech Logo", image: "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=400", views: "3.1k", likes: "267" },
    { id: "6", title: "Abstract Art", image: "https://images.unsplash.com/photo-1620421680010-0766ff230392?w=400", views: "2.8k", likes: "312" },
    { id: "7", title: "Creative Brand", image: "https://images.unsplash.com/photo-1618556658017-1a61d9f7d4b6?w=400", views: "1.9k", likes: "145" },
    { id: "8", title: "Neon Style", image: "https://images.unsplash.com/photo-1633177317976-3f9bc45e1d1d?w=400", views: "4.2k", likes: "389" },
    { id: "9", title: "Minimal Logo", image: "https://images.unsplash.com/photo-1620127807580-990c3eebaf9e?w=400", views: "2.1k", likes: "198" },
    { id: "10", title: "Gaming Setup", image: "https://images.unsplash.com/photo-1634942536790-1c0b5a2a0c0d?w=400", views: "3.5k", likes: "423" },
  ];

  const fallbackShorts: GalleryItem[] = [
    { id: "1", title: "Mountain Sunset", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400", views: "5.7k", likes: "342", isVideo: true },
    { id: "2", title: "Forest Path", image: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400", views: "8.5k", likes: "567", isVideo: true },
    { id: "3", title: "Gaming Setup", image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400", views: "3.5k", likes: "234", isVideo: true },
    { id: "4", title: "Workspace", image: "https://images.unsplash.com/photo-1484417894907-623942c8ee29?w=400", views: "6.8k", likes: "445", isVideo: true },
    { id: "5", title: "Food Bowl", image: "https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?w=400", views: "4.2k", likes: "289", isVideo: true },
    { id: "6", title: "City Night", image: "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=400", views: "7.3k", likes: "512", isVideo: true },
    { id: "7", title: "Ocean Wave", image: "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=400", views: "6.1k", likes: "478", isVideo: true },
    { id: "8", title: "Coffee Time", image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400", views: "5.4k", likes: "356", isVideo: true },
    { id: "9", title: "Travel Vlog", image: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400", views: "9.2k", likes: "623", isVideo: true },
    { id: "10", title: "Nature Walk", image: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400", views: "4.8k", likes: "334", isVideo: true },
  ];

  const [topLogos, setTopLogos] = useState<GalleryItem[]>(fallbackLogos);
  const [topShorts, setTopShorts] = useState<GalleryItem[]>(fallbackShorts);

  useEffect(() => {
    const savedCreations = localStorage.getItem("creations");
    if (savedCreations) {
      const creations: { logos: Creation[]; shorts: Creation[] } = JSON.parse(savedCreations);
      
      // Filter public creations and sort by engagement (likes + views)
      const publicLogos = creations.logos
        .filter(logo => logo.isPublic)
        .sort((a, b) => (b.likes + b.views) - (a.likes + a.views))
        .slice(0, 10)
        .map(logo => ({
          id: logo.id,
          title: logo.title,
          image: logo.image,
          views: logo.views.toString(),
          likes: logo.likes.toString(),
        }));

      const publicShorts = creations.shorts
        .filter(short => short.isPublic)
        .sort((a, b) => (b.likes + b.views) - (a.likes + a.views))
        .slice(0, 10)
        .map(short => ({
          id: short.id,
          title: short.title,
          image: short.image,
          views: short.views.toString(),
          likes: short.likes.toString(),
          isVideo: true,
        }));

      // Only update if there are public creations
      if (publicLogos.length > 0) setTopLogos(publicLogos);
      if (publicShorts.length > 0) setTopShorts(publicShorts);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <SearchHeader />
        
        <AutoScrollGallery 
          title="AI로 만든 로고들" 
          items={topLogos}
          viewAllLink="/logos"
        />
        
        <AutoScrollGallery 
          title="AI로 만든 숏폼" 
          items={topShorts}
          viewAllLink="/shorts"
        />
      </div>
    </div>
  );
};

export default Index;
