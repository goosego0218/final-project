import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Instagram, Youtube } from "lucide-react";

const Footer = () => {
  return (
    <footer className="border-t border-border bg-gradient-to-b from-background to-secondary/10">
      <div className="container mx-auto px-6 py-12">
        {/* Main Footer Content - All in one row */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-12 pb-8 border-b border-border">
          {/* Logo Section */}
          <div className="space-y-4">
<<<<<<< HEAD
            <Link to="/" className="inline-flex items-center gap-2">
              <img 
                src="/makery-logo.png" 
                alt="Makery Logo" 
                className="h-8 w-8 flex-shrink-0"
              />
=======
            <Link to="/" className="inline-block">
>>>>>>> 6c5c159b500ffac8ffb45544f3a1ffbaa2b43002
              <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                MAKERY
              </h2>
            </Link>
            <p className="text-sm text-muted-foreground">
              AI로 완성하는 브랜드 콘텐츠
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground">Product</h3>
            <ul className="space-y-3">
              <li>
                <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  서비스 소개
                </Link>
              </li>
              <li>
                <Link to="/logos" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  로고 갤러리
                </Link>
              </li>
              <li>
                <Link to="/shorts" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  숏폼 갤러리
                </Link>
              </li>
              <li>
                <Link to="/plans" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  가격
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground">Resources</h3>
            <ul className="space-y-3">
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  트렌드 인사이트
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  튜토리얼
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Support & Legal Links */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground">Support & Legal</h3>
            <ul className="space-y-3">
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  문의하기
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  이용약관
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  개인정보 처리방침
                </a>
              </li>
            </ul>
          </div>

          {/* Newsletter Section */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground">Newsletter</h3>
            <p className="text-sm text-muted-foreground mb-4">
              최신 트렌드와 소식을 받아보세요
            </p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="이메일 주소"
                className="flex-1"
              />
              <Button size="sm" className="shrink-0">
                구독
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © 2025 Makery. All rights reserved.
          </p>
          <div className="flex gap-4">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Instagram className="h-5 w-5" />
            </a>
            <a
              href="https://youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Youtube className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
