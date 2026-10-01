import { ArrowRight, BookOpenText, Check, GraduationCap, MapPin, MessageCircle, Monitor, Target, Trophy } from "lucide-react";
import { useEffect } from "react";
import ProductHubHeader from "./ProductHubHeader";
import { useSiteLanguage } from "./SiteLanguageProvider";
import { aboutContent, aboutQualifications } from "./aboutContent";
import "./about.css";

const sectionIcons = [BookOpenText, Trophy, Monitor, MessageCircle, Target];

export default function AboutPage() {
  const { language } = useSiteLanguage();
  const copy = aboutContent[language];
  const navigate = (path: string) => {
    window.history.pushState(null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const previousTitle = document.title;
    document.title = copy.pageTitle;
    return () => { document.title = previousTitle; };
  }, [copy.pageTitle]);

  return <div className="ge-about-page" lang={language}>
    <a className="ge-about-skip" href="#about-main">{copy.skip}</a>
    <ProductHubHeader active="about" onNavigate={navigate}
      onLogin={() => navigate("/quiz-strike/teacher/home")}
      onGetStarted={() => navigate("/quiz-strike/teacher/home?auth=signup")} />
    <main id="about-main" className="ge-about-shell" tabIndex={-1}>
      <section className="ge-about-hero" aria-labelledby="about-title">
        <div className="ge-about-hero-copy">
          <span className="ge-eyebrow">{copy.eyebrow}</span>
          <h1 id="about-title">{copy.title}</h1>
          <p className="ge-about-lead">{copy.introduction}</p>
        </div>
        <aside className="ge-about-profile" aria-label={language === "ja" ? "講師プロフィール" : "Teacher profile"}>
          <span className="ge-about-profile-label"><MapPin size={16} aria-hidden="true" />{copy.location}</span>
          <p className="ge-about-name" lang="en">Peter<br />Hoang<span aria-hidden="true">.</span></p>
          <p className="ge-about-role">{copy.teacher}</p>
          <div className="ge-about-experience"><GraduationCap size={21} aria-hidden="true" /><span>{copy.experience}</span></div>
        </aside>
      </section>

      <section className="ge-about-intro" aria-label={language === "ja" ? "講師からのメッセージ" : "A note from Peter"}>
        <div>{copy.introParagraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
        <blockquote>{copy.introQuote}</blockquote>
      </section>

      <div className="ge-about-reading-layout">
        <aside className="ge-about-contents">
          <nav aria-label={copy.navigation}>
            <p>{copy.navigation}</p>
            {copy.sections.map((section, index) => <a href={`#about-${section.id}`} key={section.id}><span aria-hidden="true">0{index + 1}</span>{section.label}</a>)}
          </nav>
          <div className="ge-about-credentials">
            <GraduationCap size={22} aria-hidden="true" />
            <h2>{copy.qualifications}</h2>
            <ul>{aboutQualifications.map((qualification) => <li key={qualification} lang="en">{qualification}</li>)}</ul>
          </div>
        </aside>
        <div className="ge-about-sections">
          {copy.sections.map((section, index) => {
            const Icon = sectionIcons[index];
            return <section id={`about-${section.id}`} className={`ge-about-section ge-about-section-${section.id}`} key={section.id} aria-labelledby={`about-${section.id}-title`}>
              <div className="ge-about-section-label"><Icon size={18} aria-hidden="true" /><span>0{index + 1} / {section.label}</span></div>
              <h2 id={`about-${section.id}-title`}>{section.title}</h2>
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.items && <ul className="ge-about-lesson-list">{section.items.map((item) => <li key={item}><Check size={17} aria-hidden="true" /><span>{item}</span></li>)}</ul>}
              {section.quote && <blockquote>{section.quote}</blockquote>}
            </section>;
          })}
        </div>
      </div>

      <section className="ge-about-closing" aria-labelledby="about-closing-title">
        <span className="ge-eyebrow">GyakutenEigo</span>
        <h2 id="about-closing-title">{copy.closingTitle}</h2>
        {copy.closingParagraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        <div className="ge-about-actions">
          <a href="/" className="ge-about-primary">{copy.tools}<ArrowRight size={18} aria-hidden="true" /></a>
          <a href="/speak">{copy.speaking}<ArrowRight size={18} aria-hidden="true" /></a>
        </div>
      </section>
      <footer className="ge-about-footer"><span>GyakutenEigo · Peter Hoang</span><span>{copy.footer}</span></footer>
    </main>
  </div>;
}
