import { useState, useEffect, useMemo } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Heart, MessageCircle, BarChart3 } from "lucide-react";
import { projectStorage, type Project, type SavedItem } from "@/lib/projectStorage";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

interface ShortFormReport {
  id: string;
  title: string;
  thumbnailUrl: string;
  videoUrl: string;
  platforms: ("tiktok" | "youtube")[];
  uploadedAt: string;
  views: number;
  likes: number;
  comments: number;
  projectId?: string;
}

const ShortsReportPage = () => {
  const [shortForms, setShortForms] = useState<ShortFormReport[]>([]);
  const [platformFilter, setPlatformFilter] = useState<"all" | "tiktok" | "youtube">("all");
  const [sortBy, setSortBy] = useState<"views" | "uploaded" | "recentGrowth">("views");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [chartPeriod, setChartPeriod] = useState<"7" | "30" | "90">("30");
  const [chartPlatform, setChartPlatform] = useState<"all" | "tiktok" | "youtube">("all");

  // 업로드된 숏폼 데이터 로드
  useEffect(() => {
    loadShortFormReports();
  }, []);

  // 더미 데이터 생성 함수
  const generateDummyData = (): ShortFormReport[] => {
    const dummyTitles = [
      "새로운 브랜드 소개 영상",
      "제품 런칭 프로모션",
      "고객 후기 인터뷰",
      "이벤트 안내 영상",
      "브랜드 스토리텔링",
      "제품 사용법 튜토리얼",
      "시즌 컬렉션 소개",
      "특별 할인 이벤트",
      "브랜드 미션 영상",
      "신제품 출시 예고",
    ];

    const platforms: ("tiktok" | "youtube")[][] = [
      ["tiktok"],
      ["youtube"],
      ["tiktok", "youtube"],
      ["tiktok"],
      ["youtube"],
      ["tiktok", "youtube"],
      ["tiktok"],
      ["youtube"],
      ["tiktok", "youtube"],
      ["tiktok"],
    ];

    const baseDate = new Date();
    const dummyData: ShortFormReport[] = [];

    for (let i = 0; i < 8; i++) {
      const daysAgo = i * 2 + Math.floor(Math.random() * 3);
      const uploadDate = new Date(baseDate);
      uploadDate.setDate(uploadDate.getDate() - daysAgo);

      const views = Math.floor(Math.random() * 50000) + 1000;
      const likes = Math.floor(views * (0.02 + Math.random() * 0.05));
      const comments = Math.floor(likes * (0.1 + Math.random() * 0.2));

      dummyData.push({
        id: `dummy-${i + 1}`,
        title: dummyTitles[i],
        thumbnailUrl: `https://picsum.photos/seed/short-${i}/400/700`,
        videoUrl: `https://picsum.photos/seed/short-${i}/400/700`,
        platforms: platforms[i],
        uploadedAt: uploadDate.toISOString(),
        views,
        likes,
        comments,
      });
    }

    return dummyData;
  };

  const loadShortFormReports = () => {
    const projects = projectStorage.getProjects();
    const uploadStatuses = JSON.parse(localStorage.getItem('shortFormUploadStatuses') || '{}');
    const reports: ShortFormReport[] = [];

    // 모든 프로젝트에서 업로드된 숏폼 찾기
    projects.forEach((project: Project) => {
      if (project.savedItems) {
        project.savedItems.forEach((item: SavedItem) => {
          if (item.type === "short") {
            const uploadStatus = uploadStatuses[item.id] || { tiktok: false, youtube: false };
            const platforms: ("tiktok" | "youtube")[] = [];
            if (uploadStatus.tiktok) platforms.push("tiktok");
            if (uploadStatus.youtube) platforms.push("youtube");

            // 업로드된 플랫폼이 있는 경우만 리포트에 포함
            if (platforms.length > 0) {
              // 통계 데이터 가져오기
              const stats = JSON.parse(localStorage.getItem(`short_stats_${item.id}`) || '{}');
              
              reports.push({
                id: item.id,
                title: item.title || "제목 없음",
                thumbnailUrl: item.url,
                videoUrl: item.url,
                platforms,
                uploadedAt: item.createdAt || new Date().toISOString(),
                views: stats.views || Math.floor(Math.random() * 10000) + 100,
                likes: stats.likes || Math.floor(Math.random() * 500) + 10,
                comments: stats.comments || Math.floor(Math.random() * 100) + 1,
                projectId: project.id,
              });
            }
          }
        });
      }
    });

    // 실제 데이터가 없거나 적으면 더미 데이터 추가
    if (reports.length === 0) {
      const dummyData = generateDummyData();
      setShortForms(dummyData);
    } else {
      setShortForms(reports);
    }
    
    // 마지막 동기화 시간 설정 (현재는 현재 시간으로 설정, 실제로는 API에서 받아야 함)
    setLastSyncedAt(new Date());
  };

  // 필터링 및 정렬된 데이터
  const filteredAndSortedData = useMemo(() => {
    let filtered = shortForms;

    // 플랫폼 필터
    if (platformFilter !== "all") {
      filtered = filtered.filter(sf =>
        sf.platforms.includes(platformFilter)
      );
    }

    // 정렬
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "views":
          return b.views - a.views;
        case "uploaded":
          return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
        case "recentGrowth":
          // 최근 3일 증가율 (Mock 데이터, 실제로는 백엔드에서 계산)
          return Math.random() - 0.5; // 임시 랜덤 정렬
        default:
          return 0;
      }
    });

    return sorted;
  }, [shortForms, platformFilter, sortBy]);

  // 그래프 데이터 생성
  const chartData = useMemo(() => {
    const days = parseInt(chartPeriod);
    const data: { date: string; views: number }[] = [];
    const today = new Date();

    // 기간 필터링된 숏폼
    let filteredForChart = shortForms;
    if (chartPlatform !== "all") {
      filteredForChart = shortForms.filter(sf => sf.platforms.includes(chartPlatform));
    }

    // 각 날짜별 조회수 합계 계산 (더미 데이터)
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // 해당 날짜의 조회수 합계 (실제로는 백엔드에서 받아야 함)
      // 더미 데이터: 랜덤하게 생성하되, 최근일수록 높은 경향
      const baseViews = filteredForChart.reduce((sum, sf) => sum + sf.views, 0);
      const dailyViews = Math.floor(baseViews / days * (0.5 + Math.random() * 1.5) * (1 + (days - i) / days * 0.3));
      
      data.push({
        date: date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }),
        views: dailyViews,
      });
    }

    return data;
  }, [shortForms, chartPeriod, chartPlatform]);

  // 요약 통계 계산
  const summaryStats = useMemo(() => {
    const totalViews = shortForms.reduce((sum, sf) => sum + sf.views, 0);
    const totalLikes = shortForms.reduce((sum, sf) => sum + sf.likes, 0);
    const totalComments = shortForms.reduce((sum, sf) => sum + sf.comments, 0);
    const avgViews = shortForms.length > 0 ? Math.round(totalViews / shortForms.length) : 0;

    return {
      totalViews,
      avgViews,
      totalLikes,
      totalComments,
      count: shortForms.length,
    };
  }, [shortForms]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="pt-20">
        <div className="max-w-7xl mx-auto px-8 py-12">
          {/* 상단 헤더 */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              숏폼 리포트
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-4">
              업로드한 숏폼의 조회수와 반응 변화를 한눈에 확인하세요.
            </p>
            {lastSyncedAt && (
              <p className="text-sm text-muted-foreground">
                마지막 업데이트: {formatDateTime(lastSyncedAt)}
              </p>
            )}
          </div>

          {/* 핵심 지표 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">전체 조회수</span>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {summaryStats.totalViews.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  최근 30일 기준
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">평균 조회수 / 숏폼</span>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {summaryStats.avgViews.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {summaryStats.count}개 숏폼
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">전체 좋아요 수</span>
                  <Heart className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {summaryStats.totalLikes.toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">전체 댓글 수</span>
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {summaryStats.totalComments.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 조회수 추이 그래프 */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h2 className="text-xl font-bold text-foreground">조회수 추이</h2>
                <div className="flex gap-4">
                  <Tabs value={chartPeriod} onValueChange={(value) => setChartPeriod(value as "7" | "30" | "90")}>
                    <TabsList>
                      <TabsTrigger value="7">7일</TabsTrigger>
                      <TabsTrigger value="30">30일</TabsTrigger>
                      <TabsTrigger value="90">90일</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Select value={chartPlatform} onValueChange={(value: "all" | "tiktok" | "youtube") => setChartPlatform(value)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                      <SelectItem value="youtube">YouTube</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <ChartContainer
                config={{
                  views: {
                    label: "조회수",
                    color: "hsl(24, 100%, 62%)",
                  },
                }}
                className="h-[300px] w-full"
              >
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="text-xs text-muted-foreground"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="text-xs text-muted-foreground"
                    tickFormatter={(value) => {
                      if (value >= 1000) {
                        return `${(value / 1000).toFixed(1)}k`;
                      }
                      return value.toString();
                    }}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    cursor={{ stroke: "hsl(24, 100%, 62%)", strokeWidth: 2, strokeDasharray: "5 5", opacity: 0.5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="views"
                    stroke="hsl(24, 100%, 62%)"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "hsl(24, 100%, 62%)", strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ r: 7, fill: "hsl(24, 100%, 62%)", strokeWidth: 3, stroke: "#fff" }}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* 필터 및 정렬 */}
          <div className="mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <Select value={platformFilter} onValueChange={(value: "all" | "tiktok" | "youtube") => setPlatformFilter(value)}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 플랫폼</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(value: "views" | "uploaded" | "recentGrowth") => setSortBy(value)}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="views">조회수 높은 순</SelectItem>
                  <SelectItem value="uploaded">최근 업로드 순</SelectItem>
                  <SelectItem value="recentGrowth">최근 조회수 증가 순</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 숏폼 리스트 카드 그리드 */}
          {filteredAndSortedData.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <p className="text-center text-muted-foreground">
                  업로드된 숏폼이 없습니다.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredAndSortedData.map((shortForm) => (
                <Card key={shortForm.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardContent className="p-0">
                    {/* 썸네일 */}
                    <div className="relative w-full bg-muted rounded-t-lg overflow-hidden" style={{ aspectRatio: '9/16' }}>
                      {shortForm.videoUrl ? (
                        <video
                          src={shortForm.videoUrl}
                          className="w-full h-full object-cover"
                          muted
                          loop
                          playsInline
                        />
                      ) : (
                        <img
                          src={shortForm.thumbnailUrl || "/placeholder.svg"}
                          alt={shortForm.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                      {/* 플랫폼 배지 오버레이 */}
                      <div className="absolute top-2 right-2 flex flex-col gap-1">
                        {shortForm.platforms.includes("tiktok") && (
                          <Badge className="bg-black text-white border-0 gap-1 hover:bg-black/90">
                            <img src="/icon/tiktok-logo.png" alt="TikTok" className="h-3 w-3" />
                            TikTok
                          </Badge>
                        )}
                        {shortForm.platforms.includes("youtube") && (
                          <Badge className="bg-red-600 text-white border-0 gap-1">
                            <img src="/icon/youtube-logo.png" alt="YouTube" className="h-3 w-3" />
                            YouTube
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* 정보 영역 */}
                    <div className="p-4 space-y-3">
                      {/* 업로드 날짜 */}
                      <div className="text-sm text-muted-foreground">
                        {formatDate(shortForm.uploadedAt)}
                      </div>
                      
                      {/* 통계 */}
                      <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                        <div className="flex flex-col items-center gap-1">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-semibold text-foreground">
                            {shortForm.views.toLocaleString()}
                          </span>
                          <span className="text-xs text-muted-foreground">조회수</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <Heart className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-semibold text-foreground">
                            {shortForm.likes.toLocaleString()}
                          </span>
                          <span className="text-xs text-muted-foreground">좋아요</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <MessageCircle className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-semibold text-foreground">
                            {shortForm.comments.toLocaleString()}
                          </span>
                          <span className="text-xs text-muted-foreground">댓글</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ShortsReportPage;

