import ProductHubHeader from "./ProductHubHeader";

export default function PerformanceHeader({ onNavigate }: { onNavigate: (path: string) => void }) {
  return <ProductHubHeader active="speaking" onNavigate={onNavigate}
    onLogin={() => onNavigate("/quiz-strike/teacher/home")}
    onGetStarted={() => onNavigate("/quiz-strike/teacher/home?auth=signup")} />;
}
