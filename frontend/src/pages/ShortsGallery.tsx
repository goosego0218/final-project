import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import GalleryCard from "@/components/GalleryCard";
import DetailModal from "@/components/DetailModal";
import { GalleryItem } from "@/components/AutoScrollGallery";

const ShortsGallery = () => {
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);

  // Extended sample data - top 30 shorts
  const allShorts: GalleryItem[] = [
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="w-6 h-6" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">AI로 만든 숏폼</h1>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {allShorts.map((short) => (
            <div key={short.id}>
              <GalleryCard
                image={short.image}
                views={short.views}
                likes={short.likes}
                isVideo={short.isVideo}
                onClick={() => setSelectedItem(short)}
              />
            </div>
          ))}
        </div>
      </div>

      {selectedItem && (
        <DetailModal
          open={!!selectedItem}
          onOpenChange={(open) => !open && setSelectedItem(null)}
          title={selectedItem.title}
          image={selectedItem.image}
          views={selectedItem.views}
          likes={selectedItem.likes}
          isVideo={selectedItem.isVideo}
        />
      )}
    </div>
  );
};

export default ShortsGallery;
