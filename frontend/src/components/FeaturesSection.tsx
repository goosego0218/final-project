import { Sparkles, Video, Upload } from "lucide-react";

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard = ({ icon, title, description }: FeatureCardProps) => {
  return (
    <div className="bg-card rounded-2xl p-10 shadow-sm hover:shadow-lg transition-all duration-300 group">
      <div className="mb-6 inline-flex p-4 rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
        {icon}
      </div>
      <h3 className="text-2xl font-semibold text-foreground mb-4">{title}</h3>
      <p className="text-lg text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
};

const FeaturesSection = () => {
  const features = [
    {
      icon: <Sparkles className="w-8 h-8" />,
      title: "텍스트 기반 로고 자동 생성",
      description: "몇 줄의 설명만으로 트렌드에 맞는 로고 이미지를 생성합니다. AI가 브랜드의 정체성을 이해하고 최적의 디자인을 제안합니다."
    },
    {
      icon: <Video className="w-8 h-8" />,
      title: "숏폼 영상 자동 생성",
      description: "로고와 콘셉트를 바탕으로 9:16 비율의 숏폼 영상을 자동으로 생성합니다. 트렌디한 편집과 효과가 자동으로 적용됩니다."
    },
    {
      icon: <Upload className="w-8 h-8" />,
      title: "플랫폼 자동 업로드",
      description: "완성된 영상을 인스타그램, 틱톡 등 연결된 계정으로 자동 업로드합니다. 설정 이후 원클릭 업로드로 시간을 절약하세요."
    }
  ];

  return (
    <section id="features" className="py-32 bg-section-bg px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-section-title text-foreground mb-6">
            MAKERY가 하는 일
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <FeatureCard 
              key={index}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
