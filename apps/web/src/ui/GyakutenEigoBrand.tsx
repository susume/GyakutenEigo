import "./gyakuteneigo-brand.css";

type GyakutenEigoBrandProps = {
  compact?: boolean;
  className?: string;
  alt?: string;
};

export default function GyakutenEigoBrand({ compact = false, className, alt = "GyakutenEigo" }: GyakutenEigoBrandProps) {
  return (
    <span className={["gyakuteneigo-brand", compact ? "gyakuteneigo-brand-compact" : "", className].filter(Boolean).join(" ")}>
      <img
        className="gyakuteneigo-logo-image"
        src="/assets/gyakuteneigo-logo-exact-hires.png"
        alt={alt}
        width={4096}
        height={1248}
        decoding="async"
      />
    </span>
  );
}
