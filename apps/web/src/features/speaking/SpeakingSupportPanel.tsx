import { useSiteTranslation } from "../../ui/siteTranslation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { BookOpenText, ImageOff, Lightbulb, MessageCircle, X, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { speakingContext, speakingScenarioResources, speakingSupportSettings, type SpeakingActivity, type SpeakingContext } from "@quizstrike/shared";
import { SpeakingTextbookSupport } from "./SpeakingTextbookSupport";

export type SpeakingSupportTab = "useful-english" | "context";

export interface SpeakingSupportPanelProps {
  activity: SpeakingActivity;
  activeTab: SpeakingSupportTab;
  onTabChange: (tab: SpeakingSupportTab) => void;
  onClose: () => void;
}

export const getSpeakingSupportTabs = (activity: SpeakingActivity): Array<{ id: SpeakingSupportTab; label: string }> => {
  const support = speakingSupportSettings(activity);
  const resources = speakingScenarioResources(activity.scenarioResources);
  return [
    ...(support.showTargetExpressions && (activity.targetExpressions.length || resources.usefulVocabulary.length || resources.exampleDialogue || resources.textbookReferences?.length) ? [{ id: "useful-english" as const, label: "Useful English" }] : []),
    ...(support.showContext && (speakingContext(activity) || resources.referenceItems.length) ? [{ id: "context" as const, label: "Context" }] : [])
  ];
};

const safeId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "");

export function SpeakingSupportPanel({
  activity,
  activeTab,
  onTabChange,
  onClose
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
        <h2 className="speaking-support-heading"><BookOpenText size={28} strokeWidth={1.8} aria-hidden="true" />{t("Language Support")}</h2>
        <button className="speaking-support-close" type="button" onClick={onClose} aria-label={t("Close support panel")}>
          <X size={20} strokeWidth={2} aria-hidden="true" />
        </button>
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
      </div>
      <div className="speaking-support-content">
        {selectedTab === "useful-english" ? (
          <div id={`${panelId}-panel-useful-english`} role="tabpanel" aria-labelledby={`${panelId}-tab-useful-english`} tabIndex={0} data-keyboard-input className="speaking-support-tabpanel">
            <UsefulEnglishPanel activity={activity} />
          </div>
        ) : (
          <div id={`${panelId}-panel-context`} role="tabpanel" aria-labelledby={`${panelId}-tab-context`} tabIndex={0} data-keyboard-input className={`speaking-support-tabpanel speaking-support-tabpanel-context${!context?.imageUrl && resources.referenceItems.length ? " has-reference-sheet" : ""}`}>
            <SpeakingContextPanel context={context} referenceItems={resources.referenceItems} />
          </div>
        )}
      </div>
    </section>
  );
}

function UsefulEnglishPanel({ activity }: { activity: SpeakingActivity }) {
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
          <div className="speaking-expression-card" key={expression} role="listitem">
            <MessageCircle size={19} strokeWidth={1.7} aria-hidden="true" />
            <span>{expression}</span>
          </div>
        ))}
      </div>
      <SpeakingTextbookSupport resources={resources} />
      <SpeakingKeywords words={resources.usefulVocabulary} />
      <div className="speaking-useful-callout">
        <Lightbulb size={27} strokeWidth={1.7} aria-hidden="true" />
        <span><strong>{t("Focus on your message.")}</strong>{" "}{t("You do not need to use every expression or keyword.")}</span>
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
  const viewer = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState(1);
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
          <button type="button" className="speaking-context-enlarge" aria-label={t("Enlarge image")} onClick={() => { setZoom(1); viewer.current?.showModal(); }}>
            <Maximize2 size={24} aria-hidden="true" />
          </button>
          <dialog ref={viewer} className="speaking-image-viewer" aria-label={t("Context image")} onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }}>
            <div className="speaking-image-viewer-controls">
              <button type="button" aria-label={t("Zoom out")} disabled={zoom <= 1} onClick={() => setZoom((value) => Math.max(1, value - .5))}><ZoomOut size={24} aria-hidden="true" /></button>
              <button type="button" aria-label={t("Zoom in")} disabled={zoom >= 3} onClick={() => setZoom((value) => Math.min(3, value + .5))}><ZoomIn size={24} aria-hidden="true" /></button>
              <button type="button" aria-label={t("Close image")} onClick={() => viewer.current?.close()}><X size={24} aria-hidden="true" /></button>
            </div>
            <div className="speaking-image-viewer-scroll" tabIndex={0} data-keyboard-input>
              <img src={imageUrl} alt={alt} style={{ width: `${zoom * 100}%`, minWidth: `${zoom * 707}px` }} />
            </div>
          </dialog>
        </figure>
      ) : context ? (
        <ContextEmptyState message={imageUrl ? t("Unable to load context image.") : t("No context image available for this activity.")} />
      ) : null}
      {!imageUrl && <SpeakingReferenceSheet items={referenceItems} />}
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
