type QuizStrikeLogoProps = {
  alt?: string;
  className?: string;
  size?: "header" | "auth" | "dashboard" | "lobby";
};

export default function QuizStrikeLogo({
  alt = "QuizStrike",
  className,
  size = "header"
}: QuizStrikeLogoProps) {
  return (
    <span className={["quizstrike-logo", `quizstrike-logo-${size}`, className].filter(Boolean).join(" ")}>
      <img
        src="/assets/quizstrike-classroom-logo.png"
        alt={alt}
        width={1536}
        height={1024}
        decoding="async"
      />
    </span>
  );
}
