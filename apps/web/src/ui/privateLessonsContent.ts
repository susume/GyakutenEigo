import type { SiteLanguage } from "./siteLanguage";

export const privateLessonDetails = { price: 4000, minutes: 60, email: "hungbo82@gmail.com" } as const;

type LessonFocus = { id: string; title: string; description: string };
type LessonContent = {
  pageTitle: string; description: string; skip: string; back: string;
  eyebrow: string; title: string; introduction: string; enquire: string; explore: string;
  duration: string; oneToOne: string; portraitAlt: string; teacher: string;
  trust: { title: string; detail: string }[];
  focusEyebrow: string; focusTitle: string; focusIntro: string; focuses: LessonFocus[];
  teacherEyebrow: string; teacherTitle: string; teacherParagraphs: string[]; about: string;
  achievement: string; approachTitle: string; approaches: { title: string; description: string }[];
  priceEyebrow: string; priceTitle: string; priceIntro: string; priceNote: string;
  priceLabel: string; priceFacts: { label: string; value: string }[]; availability: string;
  faqTitle: string; faqs: { id: string; question: string; answer: string }[];
  contactEyebrow: string; contactTitle: string; contactIntro: string; emailPeter: string;
  emailNote: string; footer: string; emailSubject: string; emailBody: string;
};

export const privateLessonsContent: Record<SiteLanguage, LessonContent> = {
  en: {
    pageTitle: "Private English Lessons with Peter · GyakutenEigo",
    description: "Personalised English lessons with Peter Hoang in Nakamozu, Sakai, Osaka or online. Conversation, Eiken, school English and presentation coaching. ¥4,000 for 60 minutes.",
    skip: "Skip to main content", back: "About Peter",
    eyebrow: "Private English lessons",
    title: "English lessons built around you.",
    introduction: "Build confidence, prepare for an exam, or find the words you want to say. Learn one-to-one with Peter, an Australian English teacher with over a decade of experience in Japan.",
    enquire: "Ask about lessons", explore: "Explore lesson options", duration: " / 60 minutes",
    oneToOne: "Personalised, one-to-one learning", portraitAlt: "Peter Hoang, smiling in a white shirt", teacher: "Your Australian English teacher",
    trust: [
      { title: "10+ years", detail: "Teaching in Japan" },
      { title: "TESOL qualified", detail: "Certificate IV" },
      { title: "Nakamozu", detail: "Sakai, Osaka · In person" },
      { title: "Online lessons", detail: "Learn wherever you are" }
    ],
    focusEyebrow: "Your goals come first", focusTitle: "What would you like to work on?",
    focusIntro: "Choose a focus, or combine a few. Each lesson adapts to your level, interests and goals.",
    focuses: [
      { id: "conversation", title: "Conversation & speaking", description: "Practise everyday communication, build fluency, and feel more confident expressing your ideas naturally." },
      { id: "eiken", title: "Eiken & exam preparation", description: "Work on speaking, writing, vocabulary and interview skills, with support tailored to your exam goals." },
      { id: "presentation", title: "Speeches & presentations", description: "Develop your structure, pronunciation and delivery for school speeches, competitions or presentations." },
      { id: "writing", title: "School English & writing", description: "Make sense of grammar, improve your writing, and get focused help with homework or areas you find difficult." }
    ],
    teacherEyebrow: "Meet your teacher", teacherTitle: "Hi, I’m Peter.",
    teacherParagraphs: [
      "I’m an Australian English teacher based in Nakamozu, Sakai, Osaka. For more than a decade, I’ve worked with students in Japan across different ages, levels and goals.",
      "My lessons give you plenty of opportunities to use English, understand your mistakes and notice your progress. I use technology when it makes learning clearer or more engaging."
    ],
    about: "More about my teaching", achievement: "Students I have coached have earned multiple wins and placements in English speech, recitation and presentation competitions across Osaka.",
    approachTitle: "How we’ll learn together",
    approaches: [
      { title: "A lesson that fits you", description: "We start with your goals and focus on what will help you move forward." },
      { title: "English you actually use", description: "Put what you know into practice through meaningful communication." },
      { title: "Feedback that makes sense", description: "Understand why something needs changing and how to say it more naturally." },
      { title: "Space to build confidence", description: "Ask questions, try things out and learn from mistakes in a supportive setting." }
    ],
    priceEyebrow: "Simple lesson pricing", priceTitle: "One lesson. Your goals.",
    priceIntro: "Personalised teaching without complicated plans. Start with a single lesson to see how the teaching style suits you, then decide on your next focus together.",
    priceNote: "In-person lessons are available in the Nakamozu area of Sakai, Osaka. Online lessons are also available.",
    priceLabel: "Private English lesson",
    priceFacts: [{ label: "Format", value: "One-to-one" }, { label: "Location", value: "Nakamozu or online" }, { label: "Level", value: "Beginner to advanced" }],
    availability: "Ask about availability",
    faqTitle: "A few things you might be wondering",
    faqs: [
      { id: "level", question: "Do I need to be good at English already?", answer: "No. Lessons are adapted to your level, from beginner to advanced. We’ll work at a pace that helps you learn and build confidence." },
      { id: "exam", question: "Can you help me prepare for Eiken?", answer: "Yes. Lessons can focus on speaking, writing, interview practice and the language skills you need for Eiken." },
      { id: "age", question: "Do you teach children and adults?", answer: "Yes. I have experience teaching students across a wide range of ages and proficiency levels. Tell me who the lessons are for and what you’d like to work on." },
      { id: "online", question: "Can I take lessons online?", answer: "Yes. Online lessons are available alongside in-person lessons in Nakamozu, Sakai, Osaka. Mention your preferred format when you get in touch." }
    ],
    contactEyebrow: "Let’s take the next step", contactTitle: "What would you like to achieve in English?",
    contactIntro: "Tell me about your current level, what you find difficult and what you’d like to achieve. Include your preferred lesson format and times, and we can discuss a lesson that suits you.",
    emailPeter: "Email Peter", emailNote: "Your email app will open. We’ll discuss availability and lesson details by email.",
    footer: "Private English lessons · Nakamozu, Sakai & online",
    emailSubject: "Private English Lesson Enquiry",
    emailBody: "Hi Peter,\n\nI’m interested in private English lessons.\n\nMy English level:\nWhat I’d like to work on:\nPreferred format (Nakamozu / online):\nPreferred days and times:\n\nThank you!"
  },
  ja: {
    pageTitle: "Peterのプライベート英語レッスン · GyakutenEigo",
    description: "大阪府堺市・中百舌鳥（なかもず）またはオンラインで、Peter Hoangによるマンツーマン英語レッスン。英会話、英検対策、学校英語、スピーチなど。60分4,000円。",
    skip: "本文へ移動", back: "Peterについて",
    eyebrow: "プライベート英語レッスン", title: "あなたに合わせた、英語レッスン。",
    introduction: "自信を持って話したい。試験に向けて準備したい。伝えたいことを英語で表現したい。日本で10年以上の指導経験を持つオーストラリア人講師Peterが、マンツーマンでお手伝いします。",
    enquire: "レッスンについて相談する", explore: "レッスン内容を見る", duration: " ／ 60分",
    oneToOne: "一人ひとりに合わせたマンツーマン指導", portraitAlt: "白いシャツを着て笑顔を見せる講師Peter Hoang", teacher: "オーストラリア出身の英語講師",
    trust: [
      { title: "日本で10年以上", detail: "豊富な英語指導経験" },
      { title: "TESOL資格取得", detail: "Certificate IV" },
      { title: "中百舌鳥（なかもず）", detail: "大阪府堺市での対面レッスン" },
      { title: "オンライン対応", detail: "ご自宅からも受講できます" }
    ],
    focusEyebrow: "あなたの目標に合わせて", focusTitle: "どんな英語を伸ばしたいですか？",
    focusIntro: "一つのテーマに集中しても、いくつかを組み合わせても大丈夫。レベルや興味、目標に合わせて内容を調整します。",
    focuses: [
      { id: "conversation", title: "英会話・スピーキング", description: "日常で使う英語を練習しながら、流暢さと自信を育てます。自分の考えを自然に伝えられるようサポートします。" },
      { id: "eiken", title: "英検・試験対策", description: "スピーキング、ライティング、語彙、面接練習など、受験の目標に合わせて必要な力を伸ばします。" },
      { id: "presentation", title: "スピーチ・プレゼン", description: "学校のスピーチやコンテスト、プレゼンに向けて、構成・発音・伝え方を磨き、自信のある発表を目指します。" },
      { id: "writing", title: "学校英語・ライティング", description: "文法の理解や英作文の上達をサポート。宿題や苦手な分野にも、一人ひとりに合わせて丁寧に取り組みます。" }
    ],
    teacherEyebrow: "講師紹介", teacherTitle: "こんにちは、Peterです。",
    teacherParagraphs: [
      "大阪府堺市・中百舌鳥を拠点に英語を教えている、オーストラリア出身のPeter Hoangです。日本で10年以上、さまざまな年齢・レベル・目標の生徒さんを指導してきました。",
      "レッスンでは、実際に英語を使い、間違いを理解し、成長を実感することを大切にしています。学びを分かりやすく、楽しくするために役立つ場合は、テクノロジーも取り入れます。"
    ],
    about: "講師・指導方針について", achievement: "指導した生徒たちは、大阪の英語スピーチ・暗唱・プレゼンテーションコンテストで、複数の優勝や入賞を果たしています。",
    approachTitle: "大切にしている教え方",
    approaches: [
      { title: "あなたに合った内容", description: "目標を一緒に確認し、次の一歩につながる練習に取り組みます。" },
      { title: "実際に使える英語", description: "知っている英語を、意味のあるコミュニケーションの中で使ってみます。" },
      { title: "納得できるフィードバック", description: "なぜ直す必要があるのか、どう言えば自然なのかまで丁寧に説明します。" },
      { title: "安心して挑戦できる環境", description: "質問も、挑戦も、間違いも大歓迎。自信を持って学べるようサポートします。" }
    ],
    priceEyebrow: "分かりやすいレッスン料金", priceTitle: "一回のレッスンから、あなたの目標へ。",
    priceIntro: "複雑なプランではなく、一人ひとりに合わせた指導を。まずは一回のレッスンで教え方が自分に合うかを確かめ、次に取り組みたい内容を一緒に決めましょう。",
    priceNote: "対面レッスンは大阪府堺市・中百舌鳥（なかもず）エリアで実施します。オンラインでも受講できます。",
    priceLabel: "プライベート英語レッスン",
    priceFacts: [{ label: "形式", value: "マンツーマン" }, { label: "場所", value: "中百舌鳥またはオンライン" }, { label: "レベル", value: "初心者から上級者まで" }],
    availability: "空き状況を問い合わせる",
    faqTitle: "よくあるご質問",
    faqs: [
      { id: "level", question: "英語が苦手でも大丈夫ですか？", answer: "はい、初心者から上級者まで、レベルに合わせて内容を調整します。無理のないペースで学び、自信を育てていきましょう。" },
      { id: "exam", question: "英検対策もできますか？", answer: "はい。スピーキング、ライティング、面接練習など、英検に必要な英語力を伸ばすレッスンができます。" },
      { id: "age", question: "子どもも大人も受講できますか？", answer: "はい。幅広い年齢や英語力の生徒さんを指導してきました。どなたが受講するのか、どんな内容を希望されるのかをお知らせください。" },
      { id: "online", question: "オンラインで受講できますか？", answer: "はい。大阪府堺市・中百舌鳥での対面レッスンに加えて、オンラインにも対応しています。お問い合わせの際に、ご希望の受講形式をお知らせください。" }
    ],
    contactEyebrow: "まずは、お気軽にご相談ください", contactTitle: "英語で、どんなことができるようになりたいですか？",
    contactIntro: "今の英語のレベル、苦手なこと、目指していることを教えてください。ご希望の受講形式や曜日・時間も添えていただければ、あなたに合ったレッスンを一緒に考えます。",
    emailPeter: "Peterにメールする", emailNote: "メールアプリが開きます。空き状況やレッスンの詳細はメールでご相談いただけます。",
    footer: "プライベート英語レッスン · 堺市・中百舌鳥／オンライン",
    emailSubject: "プライベート英語レッスンのお問い合わせ",
    emailBody: "Peter先生\n\nプライベート英語レッスンについて相談したいです。\n\n現在の英語レベル：\n学びたいこと・目標：\n希望の受講形式（中百舌鳥／オンライン）：\n希望の曜日・時間：\n\nよろしくお願いいたします。"
  }
};

export function privateLessonEnquiryHref(language: SiteLanguage) {
  const copy = privateLessonsContent[language];
  return `mailto:${privateLessonDetails.email}?subject=${encodeURIComponent(copy.emailSubject)}&body=${encodeURIComponent(copy.emailBody)}`;
}
