import { useSiteTranslation } from "../../ui/siteTranslation";
import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { ImageOff, Lightbulb, MessageCircle, X } from "lucide-react";
import { speakingContext, speakingScenarioResources, speakingSupportSettings, type SpeakingActivity, type SpeakingContext } from "@quizstrike/shared";

export type SpeakingSupportTab = "useful-english" | "context";

export interface SpeakingSupportPanelProps {
  activity: SpeakingActivity;
  activeTab: SpeakingSupportTab;
  onTabChange: (tab: SpeakingSupportTab) => void;
  onClose: () => void;
  onPhraseClick?: (phrase: string) => void;
  disabled?: boolean;
}

export const getSpeakingSupportTabs = (activity: SpeakingActivity): Array<{ id: SpeakingSupportTab; label: string }> => {
  const support = speakingSupportSettings(activity);
  const resources = speakingScenarioResources(activity.scenarioResources);
  return [
    ...(support.showTargetExpressions && (activity.targetExpressions.length || resources.usefulVocabulary.length) ? [{ id: "useful-english" as const, label: "Useful English" }] : []),
    ...(support.showContext && (speakingContext(activity) || resources.referenceItems.length) ? [{ id: "context" as const, label: "Context" }] : [])
  ];
};

const safeId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "");

export function SpeakingSupportPanel({
  activity,
  activeTab,
  onTabChange,
  onClose,
  onPhraseClick,
  disabled = false
}: SpeakingSupportPanelProps) {
  const { t } = useSiteTranslation();
  const generatedId = useId();
  const panelId = `speaking-support-${safeId(generatedId)}`;
  const context = speakingContext(activity);
  const resources = speakingScenarioResources(activity.scenarioResources);
  const tabs = getSpeakingSupportTabs(activity);
  const selectedTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : tabs[0]?.id;

  useEffect(() => {
    if (selectedTab && selectedTab !== activeTab) onTabChange(selectedTab);
  }, [activeTab, onTabChange, selectedTab]);

  if (!tabs.length || !selectedTab) return null;

  const focusTab = (tab: SpeakingSupportTab) => {
    onTabChange(tab);
    window.requestAnimationFrame(() => document.getElementById(`${panelId}-tab-${tab}`)?.focus());
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    if (currentIndex < 0) return;
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    focusTab(tabs[nextIndex]!.id);
  };

  return (
    <section className="speaking-support-panel" aria-label={t("Speaking support")}>
      <div className="speaking-support-header">
        <div className="speaking-support-tabs" role="tablist" aria-label={t("Speaking support modes")}>
          {tabs.map((tab) => {
            const selected = selectedTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`${panelId}-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${panelId}-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => onTabChange(tab.id)}
                onKeyDown={handleTabKeyDown}
              >
                <span>{t(tab.label)}</span>
              </button>
            );
          })}
        </div>
        <button className="speaking-support-close" type="button" onClick={onClose} aria-label={t("Close support panel")}>
          <X size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      <div className="speaking-support-content">
        {selectedTab === "useful-english" ? (
          <div id={`${panelId}-panel-useful-english`} role="tabpanel" aria-labelledby={`${panelId}-tab-useful-english`} tabIndex={0} className="speaking-support-tabpanel">
            <UsefulEnglishPanel activity={activity} onPhraseClick={onPhraseClick} disabled={disabled} />
          </div>
        ) : (
          <div id={`${panelId}-panel-context`} role="tabpanel" aria-labelledby={`${panelId}-tab-context`} tabIndex={0} className={`speaking-support-tabpanel speaking-support-tabpanel-context${resources.referenceItems.length ? " has-reference-sheet" : ""}`}>
            <SpeakingContextPanel context={context} referenceItems={resources.referenceItems} />
          </div>
        )}
      </div>
    </section>
  );
}

function UsefulEnglishPanel({ activity, onPhraseClick, disabled }: { activity: SpeakingActivity; onPhraseClick?: (phrase: string) => void; disabled: boolean }) {
  const { t } = useSiteTranslation();
  const resources = speakingScenarioResources(activity.scenarioResources);
  return (
    <div className="speaking-useful-panel-content">
      <div className="speaking-support-title-row">
        <div>
          <span className="speaking-support-kicker">{t("Language support")}</span>
          <h2>{t("Useful English")}</h2>
          <p>{t("Use these examples or your own words.")}</p>
        </div>
      </div>
      <div className="speaking-student-expression-list" role="list" aria-label={t("Target expressions")}>
        {activity.targetExpressions.map((expression) => (
          onPhraseClick ? (
            <button type="button" key={expression} onClick={() => onPhraseClick(expression)} disabled={disabled}>
              <MessageCircle size={19} strokeWidth={1.7} aria-hidden="true" />
              <span>{expression}</span>
            </button>
          ) : (
            <div className="speaking-expression-card" key={expression} role="listitem">
              <MessageCircle size={19} strokeWidth={1.7} aria-hidden="true" />
              <span>{expression}</span>
            </div>
          )
        ))}
      </div>
      <SpeakingKeywords words={resources.usefulVocabulary} />
      <div className="speaking-useful-callout">
        <Lightbulb size={27} strokeWidth={1.7} aria-hidden="true" />
        <span>{t("Focus on your message. You do not need to use every expression or keyword.")}</span>
      </div>
    </div>
  );
}

type ReferenceItems = NonNullable<SpeakingActivity["scenarioResources"]>["referenceItems"];

export function SpeakingKeywords({ words }: { words: string[] }) {
  const { t } = useSiteTranslation();
  if (!words.length) return null;
  return <section className="speaking-keywords" aria-label={t("Useful keywords")}>
    <h3>{t("Useful keywords")}</h3>
    <ul>{words.map((word, index) => <li key={`${index}-${word}`}>{word}</li>)}</ul>
  </section>;
}

export function SpeakingReferenceSheet({ items = [] }: { items?: ReferenceItems }) {
  const { t } = useSiteTranslation();
  if (!items.length) return null;
  return <section className="speaking-reference-sheet" aria-label={t("Task information")}>
    <h3>{t("Task information")}</h3>
    <dl lang="en">{items.map((item, index) => <div key={`${index}-${item.label}`}><dt>{item.label}</dt>{item.detail && <dd>{item.detail}</dd>}</div>)}</dl>
  </section>;
}

export function SpeakingContextPanel({ context, referenceItems = [] }: { context?: SpeakingContext; referenceItems?: ReferenceItems }) {
  const { t } = useSiteTranslation();
  const [imageError, setImageError] = useState(false);
  const imageUrl = context?.imageUrl;

  useEffect(() => {
    setImageError(false);
  }, [imageUrl]);

  if (!context && !referenceItems.length) {
    return <ContextEmptyState message={t("No context available for this activity.")} />;
  }

  const alt = context?.alt ?? "Visual context for this speaking activity";

  return (
    <div className="speaking-context-panel-content">
      {imageUrl && !imageError ? (
        <figure className={`speaking-context-visual context-type-${context?.type ?? "photo"}`}>
          <img src={imageUrl} alt={alt} onError={() => setImageError(true)} decoding="async" />
        </figure>
      ) : context ? (
        <ContextEmptyState message={imageUrl ? t("Unable to load context image.") : t("No context image available for this activity.")} />
      ) : null}
      <SpeakingReferenceSheet items={referenceItems} />
    </div>
  );
}

function ContextEmptyState({ message }: { message: string }) {
  const { t } = useSiteTranslation();
  return (
    <div className="speaking-context-empty" role="status">
      <span className="speaking-context-empty-icon"><ImageOff size={28} strokeWidth={1.7} aria-hidden="true" /></span>
      <strong>{t(message)}</strong>
      <p>{t("The speaking conversation is still ready whenever you are.")}</p>
    </div>
  );
}
