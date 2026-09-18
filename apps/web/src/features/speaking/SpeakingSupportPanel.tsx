import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { ImageOff, Lightbulb, MessageCircle, X } from "lucide-react";
import { speakingContext, speakingSupportSettings, type SpeakingActivity, type SpeakingContext } from "@quizstrike/shared";

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
  return [
    ...(support.showTargetExpressions && activity.targetExpressions.length ? [{ id: "useful-english" as const, label: "Useful English" }] : []),
    ...(support.showContext && speakingContext(activity) ? [{ id: "context" as const, label: "Context" }] : [])
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
  const generatedId = useId();
  const panelId = `speaking-support-${safeId(generatedId)}`;
  const context = speakingContext(activity);
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
    <section className="speaking-support-panel" aria-label="Speaking support">
      <div className="speaking-support-header">
        <div className="speaking-support-tabs" role="tablist" aria-label="Speaking support modes">
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
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        <button className="speaking-support-close" type="button" onClick={onClose} aria-label="Close support panel">
          <X size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      <div className="speaking-support-content">
        {selectedTab === "useful-english" ? (
          <div id={`${panelId}-panel-useful-english`} role="tabpanel" aria-labelledby={`${panelId}-tab-useful-english`} tabIndex={0} className="speaking-support-tabpanel">
            <UsefulEnglishPanel activity={activity} onPhraseClick={onPhraseClick} disabled={disabled} />
          </div>
        ) : (
          <div id={`${panelId}-panel-context`} role="tabpanel" aria-labelledby={`${panelId}-tab-context`} tabIndex={0} className="speaking-support-tabpanel speaking-support-tabpanel-context">
            <SpeakingContextPanel context={context} />
          </div>
        )}
      </div>
    </section>
  );
}

function UsefulEnglishPanel({ activity, onPhraseClick, disabled }: { activity: SpeakingActivity; onPhraseClick?: (phrase: string) => void; disabled: boolean }) {
  return (
    <div className="speaking-useful-panel-content">
      <div className="speaking-support-title-row">
        <div>
          <span className="speaking-support-kicker">Language support</span>
          <h2>Useful English</h2>
          <p>Target expressions</p>
        </div>
      </div>
      <div className="speaking-student-expression-list" role="list" aria-label="Target expressions">
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
      <div className="speaking-useful-callout">
        <Lightbulb size={27} strokeWidth={1.7} aria-hidden="true" />
        <span>Try using these expressions in your conversation!</span>
      </div>
    </div>
  );
}

export function SpeakingContextPanel({ context }: { context?: SpeakingContext }) {
  const [imageError, setImageError] = useState(false);
  const imageUrl = context?.imageUrl;

  useEffect(() => {
    setImageError(false);
  }, [imageUrl]);

  if (!context) {
    return <ContextEmptyState message="No context available for this activity." />;
  }

  const alt = context.alt ?? "Visual context for this speaking activity";

  return (
    <div className="speaking-context-panel-content">
      {imageUrl && !imageError ? (
        <figure className={`speaking-context-visual context-type-${context.type ?? "photo"}`}>
          <img src={imageUrl} alt={alt} onError={() => setImageError(true)} decoding="async" />
        </figure>
      ) : (
        <ContextEmptyState message={imageUrl ? "Unable to load context image." : "No context image available for this activity."} />
      )}
    </div>
  );
}

function ContextEmptyState({ message }: { message: string }) {
  return (
    <div className="speaking-context-empty" role="status">
      <span className="speaking-context-empty-icon"><ImageOff size={28} strokeWidth={1.7} aria-hidden="true" /></span>
      <strong>{message}</strong>
      <p>The speaking conversation is still ready whenever you are.</p>
    </div>
  );
}
