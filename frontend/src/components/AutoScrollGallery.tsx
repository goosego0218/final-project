import { ChevronRight } from "lucide-react";
import GalleryCard from "./GalleryCard";
import { useRef, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DetailModal from "./DetailModal";

export interface GalleryItem {
  id: string;
  title: string;
  image: string;
  views: string;
  likes: string;
  isVideo?: boolean;
}

interface AutoScrollGalleryProps {
  title: string;
  items: GalleryItem[];
  viewAllLink: string;
}

const AutoScrollGallery = ({ title, items, viewAllLink }: AutoScrollGalleryProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    let scrollAmount = 0;
    const scrollSpeed = 1;

    const scroll = () => {
      if (scrollContainer) {
        scrollAmount += scrollSpeed;
        scrollContainer.scrollLeft = scrollAmount;

        // Seamless loop: reset when first set of items is fully scrolled
        const maxScroll = (items.length * 272); // card width + gap
        if (scrollAmount >= maxScroll) {
          scrollAmount = 0;
          scrollContainer.scrollLeft = 0;
        }
      }
    };

    const intervalId = setInterval(scroll, 30);

    return () => clearInterval(intervalId);
  }, [items.length]);

  return (
    <>
      <section className="mb-16 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">{title}</h2>
          <Link 
            to={viewAllLink}
            className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            전체보기 <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="relative overflow-hidden">
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-hidden pb-4"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {items.concat(items).concat(items).map((item, index) => (
              <GalleryCard
                key={`${item.id}-${index}`}
                image={item.image}
                views={item.views}
                likes={item.likes}
                isVideo={item.isVideo}
                onClick={() => setSelectedItem(item)}
              />
            ))}
          </div>
        </div>
      </section>

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
    </>
  );
};

export default AutoScrollGallery;
