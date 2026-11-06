import { normalizeRoutePath } from "../navigation";
import type { SiteLanguage } from "../ui/siteLanguage";

export const siteOrigin = "https://gyakuteneigo.com";
export const siteName = "GyakutenEigo";
export const defaultTitle = "GyakutenEigo · English classroom tools";
export const publicLanguages = ["en", "ja"] as const;

const pages = {
  "/": {
    en: {
      title: "GyakutenEigo | English classroom tools for teachers",
      description: "Use SpeakCheck for English speaking assessment and QuizStrike for live multiplayer classroom review. Teachers host and students join with a code."
    },
    ja: {
      title: "英語授業ツール・スピーキング評価とクイズゲーム | GyakutenEigo",
      description: "SpeakCheckで英語のスピーキングを評価し、QuizStrikeで語彙や文法をクイズゲームで復習できます。先生が進行し、生徒はコードで参加します。"
    },
    image: "/assets/gyakuteneigo-logo-exact-hires.png"
  },
  "/speak": {
    en: {
      title: "SpeakCheck | Classroom English speaking assessment",
      description: "Set a classroom English speaking task and rubric. Students join with a code and practise with an AI conversation partner. Teachers review the evidence and results."
    },
    ja: {
      title: "SpeakCheck | 授業で使える英語スピーキングテスト・評価",
      description: "先生が英語のスピーキング課題と評価基準を設定。生徒はコードで参加し、AIの会話相手と練習できます。先生は生徒の発話や評価結果を確認できます。"
    },
    image: "/assets/speaking/performance-teacher.png"
  },
  "/quiz-strike": {
    en: {
      title: "QuizStrike | Live multiplayer quiz games for classrooms",
      description: "Host a classroom quiz game with a Study Set and let students join with a code. Review vocabulary and grammar in teams or explore official QuizStrike competitions."
    },
    ja: {
      title: "QuizStrike | 授業で使える対戦型英語クイズゲーム",
      description: "先生が学習セットを選び、生徒はコードで参加。語彙や文法をチーム対戦で復習できます。QuizStrikeの公式大会も探せます。"
    },
    image: "/assets/quizstrike-classroom-cover.webp"
  },
  "/about": {
    en: {
      title: "About Peter Hoang | English Teacher in Osaka | GyakutenEigo",
      description: "Meet Peter Hoang, an Australian English teacher based in Osaka, Japan. Read about his teaching experience, classroom tools and approach to English lessons."
    },
    ja: {
      title: "講師紹介・大阪の英語講師 Peter Hoang | GyakutenEigo",
      description: "大阪を拠点とするオーストラリア出身の英語講師Peter Hoang（ピーター・ホアング）の指導経験、英語授業ツール、レッスンの方針をご紹介します。"
    },
    image: "/assets/peter-hoang-headshot.png"
  },
  "/private-lessons": {
    en: {
      title: "Private English Lessons in Sakai and Online | GyakutenEigo",
      description: "One-to-one English lessons with Peter Hoang in Nakamozu, Sakai, Osaka or online. Practise conversation, prepare for Eiken, or get help with school English."
    },
    ja: {
      title: "堺市・中百舌鳥のマンツーマン英会話・英検対策 | GyakutenEigo",
      description: "大阪府堺市・中百舌鳥（なかもず）またはオンラインで、Peter Hoangによるマンツーマン英語レッスン。英会話、英検対策、学校英語、スピーチを学べます。"
    },
    image: "/assets/peter-hoang-headshot.png"
  }
};

export type PublicRoute = keyof typeof pages;
export type PublicPage = { route: PublicRoute; language: SiteLanguage };
export const publicRoutes = Object.keys(pages) as PublicRoute[];

export function getPublicPage(pathname: string): PublicPage | undefined {
  const path = normalizeRoutePath(pathname.replace(/\/index\.html$/u, "/"));
  const language = path === "/ja" || path.startsWith("/ja/") ? "ja" : "en";
  const route = language === "ja" ? path.slice(3) || "/" : path;
  if (Object.hasOwn(pages, route)) return { route: route as PublicRoute, language };
}

export function publicPagePath(route: PublicRoute, language: SiteLanguage): string {
  const path = route === "/" ? "/" : `${route}/`;
  return language === "ja" ? `/ja${path}` : path;
}

export function publicPageUrl(route: PublicRoute, language: SiteLanguage): string {
  return `${siteOrigin}${publicPagePath(route, language)}`;
}

export function appRoute(pathname: string): string {
  return getPublicPage(pathname)?.route ?? normalizeRoutePath(pathname);
}

export function publicPageMetadata({ route, language }: PublicPage) {
  return { ...pages[route][language], image: `${siteOrigin}${pages[route].image}` };
}
