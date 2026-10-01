import { ArrowLeft, ArrowRight, BookOpenText, Check, GraduationCap, Mail, MapPin, MessageCircle, Mic, Monitor, PencilLine, Trophy } from "lucide-react";
import { useEffect } from "react";
import ProductHubHeader from "./ProductHubHeader";
import { useSiteLanguage } from "./SiteLanguageProvider";
import { privateLessonDetails, privateLessonEnquiryHref, privateLessonsContent } from "./privateLessonsContent";
import "./private-lessons.css";

const focusIcons = [MessageCircle, BookOpenText, Mic, PencilLine];
const trustIcons = [GraduationCap, Check, MapPin, Monitor];

export default function PrivateLessonsPage() {
  const { language } = useSiteLanguage();
  const copy = privateLessonsContent[language];
  const enquiryHref = privateLessonEnquiryHref(language);
  const price = new Intl.NumberFormat(language === "ja" ? "ja-JP" : "en-GB", {
    style: "currency", currency: "JPY", currencyDisplay: "narrowSymbol", maximumFractionDigits: 0
  }).format(privateLessonDetails.price);
  const navigate = (path: string) => {
    window.history.pushState(null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const previousTitle = document.title;
    document.title = copy.pageTitle;
    const existingMeta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const meta = existingMeta ?? document.createElement("meta");
    const previousDescription = meta.getAttribute("content");
    if (!existingMeta) { meta.name = "description"; document.head.appendChild(meta); }
    meta.content = copy.description;
    return () => {
      document.title = previousTitle;
      if (!existingMeta) meta.remove();
      else if (previousDescription === null) meta.removeAttribute("content");
      else meta.content = previousDescription;
    };
  }, [copy.pageTitle, copy.description]);

  return <div className="ge-lessons-page" lang={language}>
    <a className="ge-lessons-skip" href="#lessons-main">{copy.skip}</a>
    <ProductHubHeader onNavigate={navigate}
      onLogin={() => navigate("/quiz-strike/teacher/home")}
      onGetStarted={() => navigate("/quiz-strike/teacher/home?auth=signup")} />
    <main id="lessons-main" className="ge-lessons-shell" tabIndex={-1}>
      <a className="ge-lessons-back" href="/about"><ArrowLeft size={16} aria-hidden="true" />{copy.back}</a>
      <section className="ge-lessons-hero" aria-labelledby="lessons-title">
        <div className="ge-lessons-hero-copy">
          <span className="ge-eyebrow">{copy.eyebrow}</span>
          <h1 id="lessons-title">{copy.title}</h1>
          <p className="ge-lessons-lead">{copy.introduction}</p>
          <div className="ge-lessons-hero-price"><strong>{price}</strong><span>{copy.duration}</span><p>{copy.oneToOne}</p></div>
          <div className="ge-lessons-actions">
            <a className="ge-lessons-button" href={enquiryHref}><Mail size={19} aria-hidden="true" />{copy.enquire}</a>
            <a className="ge-lessons-text-link" href="#lesson-focus">{copy.explore}<ArrowRight size={18} aria-hidden="true" /></a>
          </div>
        </div>
        <figure className="ge-lessons-portrait">
          <img src={`${import.meta.env.BASE_URL}assets/peter-hoang-headshot.png`} alt={copy.portraitAlt} width={1086} height={1448} fetchPriority="high" decoding="async" />
          <figcaption><strong lang="en">Peter Hoang</strong><span>{copy.teacher}</span></figcaption>
        </figure>
      </section>

      <ul className="ge-lessons-trust" aria-label={language === "ja" ? "講師とレッスンの特徴" : "Teacher and lesson highlights"}>
        {copy.trust.map((item, index) => {
          const Icon = trustIcons[index];
          return <li key={index}><Icon size={23} aria-hidden="true" /><div><strong>{item.title}</strong><span>{item.detail}</span></div></li>;
        })}
      </ul>

      <section id="lesson-focus" className="ge-lessons-section" aria-labelledby="lesson-focus-title">
        <div className="ge-lessons-section-heading"><span className="ge-eyebrow">{copy.focusEyebrow}</span><h2 id="lesson-focus-title">{copy.focusTitle}</h2><p>{copy.focusIntro}</p></div>
        <div className="ge-lessons-focus-grid">
          {copy.focuses.map((focus, index) => {
            const Icon = focusIcons[index];
            return <article className="ge-lessons-focus-card" key={focus.id}>
              <span className="ge-lessons-icon"><Icon size={25} aria-hidden="true" /></span>
              <h3>{focus.title}</h3><p>{focus.description}</p>
            </article>;
          })}
        </div>
      </section>

      <section className="ge-lessons-teacher ge-lessons-section" aria-labelledby="lesson-teacher-title">
        <div className="ge-lessons-teacher-copy">
          <span className="ge-eyebrow">{copy.teacherEyebrow}</span><h2 id="lesson-teacher-title">{copy.teacherTitle}</h2>
          {copy.teacherParagraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          <a className="ge-lessons-text-link" href="/about">{copy.about}<ArrowRight size={18} aria-hidden="true" /></a>
          <div className="ge-lessons-achievement"><Trophy size={22} aria-hidden="true" /><p>{copy.achievement}</p></div>
        </div>
        <div className="ge-lessons-approach"><h3>{copy.approachTitle}</h3><ul>
          {copy.approaches.map((approach, index) => <li key={index}><span aria-hidden="true">0{index + 1}</span><div><h4>{approach.title}</h4><p>{approach.description}</p></div></li>)}
        </ul></div>
      </section>

      <section id="lesson-pricing" className="ge-lessons-pricing" aria-labelledby="lesson-pricing-title">
        <div><span className="ge-eyebrow">{copy.priceEyebrow}</span><h2 id="lesson-pricing-title">{copy.priceTitle}</h2><p>{copy.priceIntro}</p><p className="ge-lessons-location"><MapPin size={21} aria-hidden="true" />{copy.priceNote}</p></div>
        <div className="ge-lessons-price-card">
          <h3>{copy.priceLabel}</h3><p className="ge-lessons-price"><strong>{price}</strong><span>{copy.duration}</span></p>
          <dl>{copy.priceFacts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
          <a className="ge-lessons-button" href={enquiryHref}>{copy.availability}<ArrowRight size={18} aria-hidden="true" /></a>
        </div>
      </section>

      <section className="ge-lessons-section" aria-labelledby="lesson-faq-title">
        <div className="ge-lessons-section-heading"><h2 id="lesson-faq-title">{copy.faqTitle}</h2></div>
        <div className="ge-lessons-faqs">{copy.faqs.map((faq) => <details key={faq.id}><summary>{faq.question}<span className="ge-lessons-faq-toggle" aria-hidden="true" /></summary><p>{faq.answer}</p></details>)}</div>
      </section>

      <section className="ge-lessons-contact" aria-labelledby="lesson-contact-title">
        <span className="ge-eyebrow">{copy.contactEyebrow}</span><h2 id="lesson-contact-title">{copy.contactTitle}</h2><p>{copy.contactIntro}</p>
        <a className="ge-lessons-button" href={enquiryHref}><Mail size={19} aria-hidden="true" />{copy.emailPeter}<ArrowRight size={18} aria-hidden="true" /></a>
        <a className="ge-lessons-email" href={enquiryHref}>{privateLessonDetails.email}</a>
        <p className="ge-lessons-email-note">{copy.emailNote}</p>
      </section>
      <footer className="ge-lessons-footer"><span>© {new Date().getFullYear()} GyakutenEigo · Peter Hoang</span><span>{copy.footer}</span></footer>
    </main>
  </div>;
}
