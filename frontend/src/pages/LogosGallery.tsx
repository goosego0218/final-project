import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import GalleryCard from "@/components/GalleryCard";
import DetailModal from "@/components/DetailModal";
import { GalleryItem } from "@/components/AutoScrollGallery";

const LogosGallery = () => {
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);

  // Extended sample data - top 30 logos
  const allLogos: GalleryItem[] = [
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
          <h1 className="text-3xl font-bold">AI로 만든 로고들</h1>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {allLogos.map((logo) => (
            <div key={logo.id}>
              <GalleryCard
                image={logo.image}
                views={logo.views}
                likes={logo.likes}
                onClick={() => setSelectedItem(logo)}
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
        />
      )}
    </div>
  );
};

export default LogosGallery;
