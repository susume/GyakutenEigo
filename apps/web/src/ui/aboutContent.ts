import type { SiteLanguage } from "./siteLanguage";

type AboutSection = { id: string; label: string; title: string; paragraphs: string[]; quote?: string; items?: string[] };
type AboutContent = {
  pageTitle: string; eyebrow: string; title: string; introduction: string; location: string;
  experience: string; teacher: string; navigation: string; skip: string; qualifications: string;
  introParagraphs: string[]; introQuote: string; sections: AboutSection[];
  closingTitle: string; closingParagraphs: string[]; tools: string; speaking: string; footer: string;
};

export const aboutContent: Record<SiteLanguage, AboutContent> = {
  en: {
    pageTitle: "About Peter Hoang · GyakutenEigo",
    eyebrow: "About your teacher",
    title: "Helping students turn English knowledge into real communication.",
    introduction: "Hi, I’m Peter Hoang, an Australian English teacher based in Osaka, Japan.",
    location: "Osaka, Japan", experience: "Over a decade teaching in Japan", teacher: "Australian English teacher",
    navigation: "On this page", skip: "Skip to main content", qualifications: "Qualifications & certifications",
    introParagraphs: [
      "I have been teaching English in Japan for more than a decade, working with students of different ages, abilities and goals. During that time, I have taught in Japanese schools, worked with private students, coached speech and presentation competitors, and developed technology-based learning activities designed to make English more engaging and practical.",
      "For me, good English teaching is not simply about explaining grammar or working through a textbook."
    ],
    introQuote: "It is about helping students use English with confidence.",
    sections: [
      { id: "lessons", label: "Personalised lessons", title: "Teaching that adapts to the student", paragraphs: [
        "Every student learns differently. Some students want to improve their everyday conversation. Others are preparing for Eiken, school examinations, speeches, presentations or interviews. Some understand English well but struggle to speak. Others need help organising their ideas in writing.",
        "That is why I do not believe in giving every student exactly the same lesson. I adapt my teaching to the student’s level, personality and goals, while giving them plenty of opportunities to actually use English.",
        "The aim is always the same: to help students become more independent and confident users of English."
      ], items: ["English conversation and speaking confidence", "Pronunciation and natural expressions", "Eiken preparation", "School English and grammar support", "Writing and essay development", "Speech and presentation coaching", "Interview preparation", "Individualised study support"] },
      { id: "achievement", label: "Student achievement", title: "A strong record of student achievement", paragraphs: [
        "One of the most rewarding parts of my career has been coaching students for English speech, recitation and presentation competitions.",
        "Students I have worked with have achieved repeated wins and placements in competitions throughout Osaka, including multiple first-place finishes, runner-up awards, a judges’ special award and a Top 10 result at the Osaka Takamado Cup English Speech Contest.",
        "I am proud of those results, but I am even more proud of what happens behind them. A student who was once afraid to speak in front of others learns to stand on a stage with confidence. A student who struggled to express an idea learns how to make an audience listen.",
        "Those changes are what good teaching is really about."
      ] },
      { id: "technology", label: "Teaching & technology", title: "English teaching and technology", paragraphs: [
        "Technology has always been an important part of my teaching. I hold qualifications including Google for Education Level 1, Microsoft 21st Century Learning Design, a TESOL Certificate IV, and a BA in Politics.",
        "But I do not use technology simply because it is new. I use it when it helps students learn better.",
        "That may mean interactive activities, digital worksheets, personalised practice, tablet-based lessons, games, multimedia, or tools that allow students to practise and review outside the classroom.",
        "Over the years, I have also created my own educational resources and learning applications because I often found myself thinking:"
      ], quote: "There must be a better way to teach this.", items: undefined },
      { id: "philosophy", label: "Teaching philosophy", title: "Challenged, but not intimidated", paragraphs: [
        "That curiosity continues to influence the way I teach today. I believe students learn best when they are challenged, but not intimidated.",
        "Mistakes are a normal part of learning a language. My job is not simply to point them out—it is to help students understand why something is wrong and show them how to express the same idea more naturally.",
        "I want students to leave a lesson feeling that they have actually achieved something. Sometimes that means mastering a difficult grammar point. Sometimes it means writing a better essay. Sometimes it means finally being able to say something in English that they have wanted to say for years.",
        "And sometimes it is simply having a conversation and realising:"
      ], quote: "I can actually do this." },
      { id: "purpose", label: "English with a purpose", title: "Learning English should have a purpose", paragraphs: [
        "English can help you pass an examination, study overseas, communicate while travelling, succeed at work, enter a competition or make friends.",
        "But ultimately, English is a tool for connecting with other people. My role as a teacher is to help you develop the skills and confidence to use that tool."
      ] }
    ],
    closingTitle: "Let’s learn English together.",
    closingParagraphs: ["Whether you are a beginner taking your first steps, a student preparing for an important examination, or someone who simply wants to become a more confident English speaker, I would be happy to help."],
    tools: "Explore classroom tools", speaking: "Discover SpeakCheck", footer: "English knowledge. Real communication."
  },
  ja: {
    pageTitle: "講師紹介 · Peter Hoang · GyakutenEigo",
    eyebrow: "講師紹介",
    title: "英語を「知っている」から「使える」へ。",
    introduction: "こんにちは。オーストラリア出身の英語講師、Peter Hoang（ピーター・ホアング）です。",
    location: "大阪・日本", experience: "日本で10年以上の指導経験", teacher: "オーストラリア出身の英語講師",
    navigation: "このページの内容", skip: "本文へスキップ", qualifications: "資格・認定",
    introParagraphs: [
      "大阪で10年以上にわたり、子どもから大人まで、さまざまな年齢・英語レベルの生徒さんを指導してきました。",
      "学校での英語指導、マンツーマンレッスン、英検対策、スピーチ・プレゼンテーション指導など、これまで幅広い英語教育に携わってきました。",
      "私が大切にしているのは、ただ英語の知識を増やすことではありません。"
    ],
    introQuote: "「英語を知っている」から「実際に使える」ようになること。それが、私のレッスンの大きな目標です。",
    sections: [
      { id: "lessons", label: "一人ひとりのレッスン", title: "一人ひとりに合ったレッスン", paragraphs: [
        "英語を学ぶ目的は、人によって違います。「もっと自然に英会話ができるようになりたい」「英検に合格したい」「学校の英語をもっと理解したい」「英語で自分の考えをうまく伝えられるようになりたい」「スピーチやプレゼンテーションを上達させたい」。それぞれの生徒さんに、それぞれの目標があります。",
        "だから私は、すべての生徒さんに同じ内容を教えるのではなく、レベル・性格・目的・得意なこと・苦手なことに合わせてレッスンを調整することを大切にしています。",
        "「英語を勉強する時間」だけではなく、実際に英語を使う時間をできるだけ多くすることを心がけています。"
      ], items: ["日常英会話", "スピーキング・会話力アップ", "発音・自然な英語表現", "英検対策", "学校英語・文法", "ライティング", "スピーチ・暗唱", "プレゼンテーション", "面接対策", "個別学習サポート"] },
      { id: "achievement", label: "生徒の成長と実績", title: "多くの生徒を大会入賞へ", paragraphs: [
        "私が特に力を入れてきた分野の一つが、英語スピーチ・暗唱・プレゼンテーション指導です。",
        "これまで指導した生徒たちは、大阪府内の英語スピーチ、暗唱、プレゼンテーション大会などで、優勝・準優勝・特別賞・上位入賞などの成績を収めています。",
        "しかし、私が一番うれしいのは「賞を取ること」だけではありません。最初は人前で英語を話すことが苦手だった生徒が、自信を持ってステージに立てるようになる。自分の考えを英語で表現できなかった生徒が、自分の言葉で人に伝えられるようになる。",
        "そうした生徒自身の成長を見ることが、教師として何よりもうれしい瞬間です。"
      ] },
      { id: "technology", label: "英語教育とICT", title: "英語教育 × テクノロジー", paragraphs: [
        "私は以前から、教育にICTやデジタル教材を取り入れることにも力を入れてきました。TESOL Certificate IV、BA in Politicsのほか、Google for Education Level 1、Microsoft 21st Century Learning Designなどの資格・認定を取得しています。",
        "ただし、私は「新しいから」という理由だけでテクノロジーを使うことはありません。大切なのは、「それを使うことで、生徒がもっと分かりやすく、もっと楽しく、もっと効果的に学べるか」ということです。",
        "そのため、必要に応じて、タブレットやPCを使った学習、デジタル教材、インタラクティブな練習、オンライン教材、ゲーム形式の学習、個別練習用の教材なども取り入れています。",
        "また、自分自身で英語学習教材や教育用アプリを作ることもあります。そのきっかけになるのは、いつもこんな問いです。"
      ], quote: "もっと良い教え方があるのではないか？" },
      { id: "philosophy", label: "私の教え方", title: "間違いも、成長の一歩に", paragraphs: [
        "私は、英語を学ぶうえで間違えることは悪いことではないと考えています。むしろ、間違えることは学習の大切な一部です。",
        "間違いをただ「正しい・間違い」と判断するだけではなく、なぜ間違ったのか、どう言えばもっと自然なのかまで理解してもらうことを大切にしています。",
        "生徒さんには、レッスンが終わったときに、「今日はこれができるようになった」と感じてほしいと思っています。それは、難しい文法が分かったことかもしれません。英作文が上手に書けたことかもしれません。スピーチを自信を持って発表できたことかもしれません。あるいは、今まで言えなかったことを英語で自然に言えた瞬間かもしれません。",
        "そしていつか、そう感じてもらえたら、それが私にとって大きな成功です。"
      ], quote: "あれ？ 自分、英語でちゃんと話せている。" },
      { id: "purpose", label: "英語を学ぶ目的", title: "英語には「目的」がある", paragraphs: [
        "英語は、単なる学校の教科ではありません。英検に合格するため。受験のため。海外旅行のため。仕事のため。留学のため。世界中の人とコミュニケーションを取るため。人によって、その目的は違います。",
        "でも共通しているのは、英語は人と人をつなぐための道具だということです。私の仕事は、その道具を自信を持って使えるようになるまで、生徒さんをサポートすることだと思っています。"
      ] }
    ],
    closingTitle: "一緒に英語を学びませんか？",
    closingParagraphs: ["英語の第一歩を踏み出す初心者の方、大切な試験に向けて準備する生徒さん、もっと自信を持って英語を話したい方。一人ひとりの目標に合わせて、喜んでお手伝いします。"],
    tools: "学習ツールを見る", speaking: "SpeakCheckについて", footer: "英語の知識を、実際のコミュニケーションへ。"
  }
};

export const aboutQualifications = ["TESOL Certificate IV", "BA in Politics", "Google for Education Level 1", "Microsoft 21st Century Learning Design"];
