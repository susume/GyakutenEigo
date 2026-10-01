import { useSiteTranslation } from "../../../ui/siteTranslation";
export default function ArenaLoading({ label = "Loading the game" }: { label?: string }) {
  const { t } = useSiteTranslation();
  return (
    <div className="arena-frame arena-loading" role="status" aria-live="polite">
      <div className="arena-canvas">
        <strong>{t(label)}</strong>
        <span>{t("Getting the game ready...")}</span>
      </div>
    </div>
  );
}
