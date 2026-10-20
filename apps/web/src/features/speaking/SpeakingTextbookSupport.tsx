import type { SpeakingScenarioResources } from "@quizstrike/shared";
import { useSiteTranslation } from "../../ui/siteTranslation";

export function SpeakingTextbookSupport({ resources }: { resources: Pick<SpeakingScenarioResources, "exampleDialogue" | "textbookReferences"> }) {
  const { t } = useSiteTranslation();
  if (!resources.exampleDialogue && !resources.textbookReferences?.length) return null;
  return <section className="speaking-textbook-support" aria-label={t("Textbook language support")}>
    {resources.exampleDialogue && <details className="speaking-example-dialogue">
      <summary>{t("Example dialogue")}</summary>
      <p>{t("An adapted example, not a required script. Replace bracketed details with information for your task. You can use your own words.")}</p>
      <p className="speaking-example-dialogue-lines" lang="en">{resources.exampleDialogue}</p>
    </details>}
    {Boolean(resources.textbookReferences?.length) && <details className="speaking-textbook-references">
      <summary>{t("Textbook connections")}</summary>
      <p>{t("The language is adapted to this speaking task. Some connections transfer language to a new situation or from writing to speaking.")}</p>
      <ul>{resources.textbookReferences!.map((reference, index) => <li key={`${reference.book}-${index}`}>
        <strong>NEW HORIZON {reference.book}</strong>: {reference.section}; {/^[0-9]+$/u.test(reference.pages) ? "p." : "pp."} {reference.pages}
      </li>)}</ul>
    </details>}
  </section>;
}
