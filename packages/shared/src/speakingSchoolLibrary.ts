import {
  DEFAULT_SPEAKING_RUBRIC,
  DEFAULT_SPEAKING_ASSESSMENT_SUPPORT_SETTINGS,
  type SpeakingCategory,
  type SpeakingCreateActivityInput,
  type SpeakingContext,
  type SpeakingScenarioResources,
  type SpeakingLibraryCategoryId,
  type SpeakingLibraryCollection
} from "./speaking.js";
import { speakingLibraryCategoryId } from "./speakingLibraryRegistry.js";

export type SpeakingCoreLibraryItem = SpeakingCreateActivityInput & {
  id: string;
  scenarioResources: SpeakingScenarioResources;
};

type CoreSeed = {
  id: string;
  title: string;
  category: SpeakingCategory;
  categoryId?: SpeakingLibraryCategoryId;
  libraryCollection?: SpeakingLibraryCollection;
  scenario: string;
  aiRole: string;
  studentRole: string;
  goal: string;
  aiContext: string;
  skills: string[];
  complication: string;
  conditions: string[];
  openingLine: string;
  steps: string[];
  vocabulary: string[];
  targetExpressions: string[];
  imageSrc: string;
  imageAlt: string;
  context?: SpeakingContext;
  durationSeconds?: number;
  referenceItems?: Array<{ label: string; detail?: string }>;
};

const INTRO = "/assets/speaking/scenario-introduction.webp";
const HOBBIES = "/assets/speaking/scenario-hobbies.webp";
const RESTAURANT = "/assets/speaking/scenario-restaurant.webp";
const SHOPPING = "/assets/speaking/scenario-shopping.webp";
const DIRECTIONS = "/assets/speaking/scenario-directions.webp";
const WEEKEND = "/assets/speaking/scenario-weekend.webp";
const TOURIST_MAP = "/assets/speaking/context-tourist-map.webp";
const LIBRARY_MAP = "/assets/speaking/context-library-map.webp";
const CAFE_MENU = "/assets/speaking/context-cafe-menu.webp";
const RESTAURANT_MENU = "/assets/speaking/context-restaurant-menu.webp";
const TRANSIT_MAP = "/assets/speaking/context-transit-map.webp";
const STATION_BOARD = "/assets/speaking/context-station-board.webp";
const CLOTHING_DISPLAY = "/assets/speaking/context-clothing-display.webp";
const SCHOOL_SUPPLIES = "/assets/speaking/context-school-supplies.webp";
const OUTING_OPTIONS = "/assets/speaking/context-outing-options.webp";

const CORE_CONTEXTS: Record<string, SpeakingContext> = {
  "introducing-yourself": {
    title: "Student profile",
    description: "Use the profile scene to introduce yourself and share a few details.",
    imageUrl: INTRO,
    alt: "Two students sharing a simple student profile at school",
    type: "photo"
  },
  "meeting-someone-new": {
    title: "Exchange meetup",
    description: "Use the meetup scene to find a shared interest and keep the conversation going.",
    imageUrl: INTRO,
    alt: "Two students meeting for the first time at an exchange activity",
    type: "photo"
  },
  "talking-about-hobbies": {
    title: "After-school hobbies",
    description: "Use the activity scene to describe what you enjoy and when you do it.",
    imageUrl: HOBBIES,
    alt: "Students talking about music and sports after school",
    type: "photo"
  },
  "talking-about-school-life": {
    title: "School day",
    description: "Use the school scene to talk about classes, clubs, and routines.",
    imageUrl: INTRO,
    alt: "Students talking together in a school setting",
    type: "photo"
  },
  "talking-about-daily-life": {
    title: "Weekday routine",
    description: "Use the everyday scene to compare before-school and after-school routines.",
    imageUrl: HOBBIES,
    alt: "Students comparing their weekday routines",
    type: "photo"
  },
  "talking-about-a-past-experience": {
    title: "Memory snapshot",
    description: "Use the scene to organize a short story about a past experience.",
    imageUrl: WEEKEND,
    alt: "Students sharing a memorable weekend experience",
    type: "photo"
  },
  "talking-about-future-plans": {
    title: "Holiday planner",
    description: "Use the planning scene to discuss a future activity and a backup idea.",
    imageUrl: WEEKEND,
    alt: "Friends discussing plans for an upcoming holiday",
    type: "photo"
  },
  "making-plans-with-a-friend": {
    title: "Weekend planner",
    description: "Use the weekend scene to agree on an activity and a time to meet.",
    imageUrl: WEEKEND,
    alt: "Two friends making plans for the weekend",
    type: "photo"
  },
  "making-and-responding-to-invitations": {
    title: "School event",
    description: "Use the event scene to discuss an invitation, time, place, and details.",
    imageUrl: WEEKEND,
    alt: "Students discussing an invitation to a school event",
    type: "photo"
  },
  "buying-clothes": {
    title: "Clothing display",
    description: "Use the shop display to compare size, color, price, and availability.",
    imageUrl: CLOTHING_DISPLAY,
    alt: "Illustrated shop display with a blue T-shirt, black hoodie, and green jacket",
    type: "other"
  },
  "shopping-for-everyday-items": {
    title: "School supply shelf",
    description: "Use the product display to choose supplies and check the total.",
    imageUrl: SCHOOL_SUPPLIES,
    alt: "Illustrated store display with notebooks, colored pens, and tape",
    type: "other"
  },
  "ordering-food": {
    title: "Café menu",
    description: "Use the menu to choose a meal, ask about an ingredient, and confirm.",
    imageUrl: CAFE_MENU,
    alt: "Illustrated café menu with a sandwich, soup containing milk, and orange juice",
    type: "menu"
  },
  "at-a-restaurant": {
    title: "Lunch menu",
    description: "Use the menu to choose lunch, handle an unavailable side, and check the bill.",
    imageUrl: RESTAURANT_MENU,
    alt: "Illustrated lunch menu with a curry set, pasta set, and unavailable fruit side",
    type: "menu"
  },
  "asking-for-street-directions": {
    title: "Neighborhood map",
    description: "Use the local map to ask about landmarks, distance, and a detour.",
    imageUrl: LIBRARY_MAP,
    alt: "Illustrated neighborhood map with a library, park, station, and location marker",
    type: "map"
  },
  "giving-street-directions": {
    title: "Neighborhood route",
    description: "Use the local map to give a visitor clear steps from the station to a destination.",
    imageUrl: TOURIST_MAP,
    alt: "Illustrated local area map showing streets, landmarks, a station, and a park",
    type: "map"
  },
  "asking-for-train-directions": {
    title: "City transit map",
    description: "Use the line map to ask about a platform, route, and transfer.",
    imageUrl: TRANSIT_MAP,
    alt: "Simple city transit map with Central, Park, East, Museum, Market, and Station stops",
    type: "subway"
  },
  "giving-train-directions": {
    title: "Train route map",
    description: "Use the line map to explain the route, transfer, and arrival stop.",
    imageUrl: TRANSIT_MAP,
    alt: "Simple city transit map with colored lines and labeled transfer stops",
    type: "subway"
  },
  "using-public-transportation": {
    title: "Transit route choices",
    description: "Use the transit map to compare routes, travel time, and connections.",
    imageUrl: TRANSIT_MAP,
    alt: "Simple city transit map showing several routes between a station and local destinations",
    type: "subway"
  },
  "at-a-train-station": {
    title: "Station information board",
    description: "Use the departures board to compare times, platforms, and transfers.",
    imageUrl: STATION_BOARD,
    alt: "Illustrated station departures board with train times, destinations, and platforms",
    type: "timetable"
  },
  "helping-a-tourist": {
    title: "Local highlights",
    description: "Use the nearby landmarks to recommend a place and explain how to reach it.",
    imageUrl: TOURIST_MAP,
    alt: "Illustrated local area map with a museum, park, shopping street, station, and your location",
    type: "map"
  },
  "introducing-your-hometown": {
    title: "Hometown highlights",
    description: "Use the local map to choose places, activities, and a rainy-day idea.",
    imageUrl: TOURIST_MAP,
    alt: "Illustrated local area map with places a visitor can explore in a hometown",
    type: "map"
  },
  "introducing-japanese-culture": {
    title: "Culture snapshot",
    description: "Use the cultural scene to explain a custom, celebration, or everyday practice.",
    imageUrl: INTRO,
    alt: "Students discussing Japanese culture during an exchange activity",
    type: "photo"
  },
  "asking-for-help": {
    title: "School help desk",
    description: "Use the school scene to explain a problem and identify the help you need.",
    imageUrl: INTRO,
    alt: "A student asking a helpful school staff member for assistance",
    type: "photo"
  },
  "lost-property": {
    title: "Lost and found desk",
    description: "Use the office scene to describe an item and where you last saw it.",
    imageUrl: INTRO,
    alt: "A student reporting a lost item at a school office",
    type: "photo"
  },
  "feeling-sick": {
    title: "School health room",
    description: "Use the health-room scene to describe symptoms and decide on a next step.",
    imageUrl: INTRO,
    alt: "A student speaking with a school nurse in a health room",
    type: "photo"
  },
  "making-requests-and-asking-permission": {
    title: "Project request",
    description: "Use the classroom scene to explain what your group needs and why.",
    imageUrl: INTRO,
    alt: "A student discussing a group project request with a teacher",
    type: "photo"
  },
  "giving-advice": {
    title: "Busy week planner",
    description: "Use the planning scene to sort priorities and compare practical choices.",
    imageUrl: WEEKEND,
    alt: "Friends discussing how to manage a busy week",
    type: "photo"
  },
  "giving-an-opinion": {
    title: "Class discussion",
    description: "Use the discussion scene to consider different views and examples.",
    imageUrl: HOBBIES,
    alt: "Students sharing different opinions in a class discussion",
    type: "photo"
  },
  "choosing-between-options": {
    title: "Outing options",
    description: "Use the comparison board to weigh price, travel time, and activities.",
    imageUrl: OUTING_OPTIONS,
    alt: "Illustrated comparison board showing museum, park, and aquarium outing options",
    type: "chart"
  },
  "solving-an-everyday-problem": {
    title: "Project problem board",
    description: "Use the group-work scene to identify the missing item and compare solutions.",
    imageUrl: INTRO,
    alt: "Students working together to solve a group project problem",
    type: "photo"
  }
};

const contextForCoreSeed = (seed: CoreSeed): SpeakingContext =>
  seed.context ?? CORE_CONTEXTS[seed.id] ?? {
    title: "Activity context",
    description: "Use this visual to help your answer.",
    imageUrl: seed.imageSrc,
    alt: seed.imageAlt,
    type: "photo"
  };

const core = (seed: CoreSeed): SpeakingCoreLibraryItem => {
  const libraryCollection = seed.libraryCollection ?? "school-english";
  const sourceTemplateId = `core-${seed.id}`;
  const categoryId = seed.categoryId ?? speakingLibraryCategoryId(libraryCollection, seed.category);
  return {
  id: sourceTemplateId,
  title: seed.title,
  scenario: seed.scenario,
  aiRole: seed.aiRole,
  studentRole: seed.studentRole,
  // Retained only for compatibility with the existing persistence schema. The
  // teacher UI and the speaking prompts do not expose or use these concepts.
  level: "elementary",
  difficulty: "normal",
  nativeLanguage: "ja",
  durationSeconds: seed.durationSeconds ?? 180,
  identifierMode: "nickname",
  mode: "assessment",
  supportSettings: { ...DEFAULT_SPEAKING_ASSESSMENT_SUPPORT_SETTINGS },
  targetExpressions: [...seed.targetExpressions],
  rubric: DEFAULT_SPEAKING_RUBRIC.map((criterion) => ({ ...criterion })),
  context: { ...contextForCoreSeed(seed) },
  scenarioResources: {
    libraryCollection,
    ...(categoryId ? { categoryId } : {}),
    category: seed.category,
    communicationSkills: [...seed.skills],
    aiContext: seed.aiContext,
    possibleComplication: seed.complication,
    successConditions: [...seed.conditions],
    openingLine: seed.openingLine,
    studentGoal: seed.goal,
    suggestedSteps: [...seed.steps],
    usefulVocabulary: [...seed.vocabulary],
    referenceItems: seed.referenceItems?.map((item) => ({ ...item })) ?? [],
    builtIn: true,
    sourceTemplateId,
    imageSrc: seed.imageSrc,
    imageAlt: seed.imageAlt,
    context: { ...contextForCoreSeed(seed) }
  }
  };
};

/**
 * The built-in junior-high library. Each item is a complete, editable
 * speaking task: situation, goal, partner context, complication, success
 * conditions, optional support, and the default evidence rubric.
 */
export const SCHOOL_ENGLISH_LIBRARY: SpeakingCoreLibraryItem[] = [
  core({
    id: "introducing-yourself",
    title: "Introducing Yourself",
    category: "Everyday Communication",
    scenario: "You meet a new student at school and have a few minutes to introduce yourself.",
    aiRole: "New student",
    studentRole: "Student",
    goal: "Share your name, school life, and one interest, then ask your partner a question.",
    aiContext: "The AI is friendly and curious but does not know anything about you yet.",
    skills: ["Sharing information", "Describing", "Asking questions", "Follow-up questions"],
    complication: "Your partner asks one unexpected follow-up question about your interest.",
    conditions: ["Introduce yourself clearly.", "Share at least two personal details.", "Ask and respond to a question."],
    openingLine: "Hi! Nice to meet you. What is your name?",
    steps: ["Say hello and your name.", "Share two details about yourself.", "Ask your partner a question.", "Respond and close naturally."],
    vocabulary: ["name", "school", "from", "free time"],
    targetExpressions: ["My name is…", "I am from…", "I like…", "Nice to meet you."],
    imageSrc: INTRO,
    imageAlt: "Two students introducing themselves at school",
    durationSeconds: 120
  }),
  core({
    id: "meeting-someone-new",
    title: "Meeting Someone New",
    category: "Everyday Communication",
    scenario: "You are paired with a student you have never spoken with during an international exchange activity.",
    aiRole: "Exchange student",
    studentRole: "Student",
    goal: "Start a friendly conversation, find one shared interest, and keep it going with follow-up questions.",
    aiContext: "The AI has just arrived and wants to learn about your school and interests.",
    skills: ["Asking questions", "Sharing information", "Follow-up questions", "Clarifying"],
    complication: "You discover that your first interest is different, so you need to ask about another topic.",
    conditions: ["Open the conversation politely.", "Find one shared or interesting topic.", "Ask at least two relevant questions."],
    openingLine: "Hello! I do not think we have met before. What do you like to do?",
    steps: ["Greet your partner.", "Ask about an interest.", "Share your own answer.", "Find another question and respond."],
    vocabulary: ["meet", "interest", "same", "different"],
    targetExpressions: ["Have we met before?", "What do you think about…?", "Me too.", "That sounds interesting."],
    imageSrc: INTRO,
    imageAlt: "Students meeting for the first time"
  }),
  core({
    id: "talking-about-hobbies",
    title: "Talking About Hobbies",
    category: "Everyday Communication",
    scenario: "You meet a new classmate and talk about what you do after school and on weekends.",
    aiRole: "New classmate",
    studentRole: "Student",
    goal: "Describe one hobby with a detail and ask your classmate about their hobby.",
    aiContext: "The AI enjoys music and sports but is happy to hear about a different activity.",
    skills: ["Describing", "Asking questions", "Giving reasons", "Follow-up questions"],
    complication: "Your partner does not know your hobby, so you need to explain it in another way.",
    conditions: ["Name a hobby.", "Give a detail or reason.", "Ask about and respond to your partner's hobby."],
    openingLine: "Hi! What do you like to do in your free time?",
    steps: ["Name your hobby.", "Describe when or where you do it.", "Say why you like it.", "Ask a related question."],
    vocabulary: ["free time", "usually", "practice", "favorite"],
    targetExpressions: ["I like…", "I enjoy…", "How about you?", "Because…"],
    imageSrc: HOBBIES,
    imageAlt: "Two classmates talking about hobbies"
  }),
  core({
    id: "talking-about-school-life",
    title: "Talking About School Life",
    category: "School & Social Life",
    scenario: "A visiting student asks you about your school day, classes, and a club or activity.",
    aiRole: "Visiting student",
    studentRole: "Student guide",
    goal: "Explain a normal school day and recommend one class, club, or school activity.",
    aiContext: "The AI is visiting your school and wants to understand what students do there.",
    skills: ["Explaining", "Describing", "Recommending", "Asking questions"],
    complication: "The visitor asks why you recommend that activity.",
    conditions: ["Describe a school routine.", "Explain one class or activity.", "Give a recommendation with a reason."],
    openingLine: "What is your school day like?",
    steps: ["Describe the start of the day.", "Talk about a class or club.", "Recommend one activity.", "Answer a follow-up question."],
    vocabulary: ["class", "club", "lunch", "after school"],
    targetExpressions: ["We usually…", "My favorite class is…", "You should try…", "because…"],
    imageSrc: INTRO,
    imageAlt: "Students talking about school life"
  }),
  core({
    id: "talking-about-daily-life",
    title: "Talking About Daily Life",
    category: "Everyday Communication",
    scenario: "You and a partner compare what you usually do before and after school.",
    aiRole: "Classmate",
    studentRole: "Student",
    goal: "Describe your weekday routine and compare one part of it with your partner's routine.",
    aiContext: "The AI has a different morning schedule and wants to learn what is similar or different.",
    skills: ["Describing", "Comparing", "Asking questions", "Giving reasons"],
    complication: "Your partner's schedule is different, so you need to ask when or why they do something.",
    conditions: ["Describe at least three routine actions.", "Ask about your partner's routine.", "Identify one similarity or difference."],
    openingLine: "What do you usually do before school?",
    steps: ["Describe your morning.", "Talk about after-school time.", "Ask about your partner.", "Compare one routine."],
    vocabulary: ["usually", "first", "then", "after school"],
    targetExpressions: ["I usually…", "Before that…", "How about you?", "It is similar because…"],
    imageSrc: HOBBIES,
    imageAlt: "Students comparing their daily routines"
  }),
  core({
    id: "talking-about-a-past-experience",
    title: "Talking About a Past Experience",
    category: "Everyday Communication",
    scenario: "You tell a classmate about a memorable day, trip, event, or activity from the past.",
    aiRole: "Interested classmate",
    studentRole: "Student storyteller",
    goal: "Tell what happened, add one detail about how you felt, and answer a follow-up question.",
    aiContext: "The AI wants to hear a short personal story and will ask one natural question.",
    skills: ["Sharing information", "Describing", "Explaining", "Follow-up questions"],
    complication: "Your partner asks what happened next or why the experience was memorable.",
    conditions: ["Set the time or place.", "Describe two events in order.", "Explain a feeling or reason."],
    openingLine: "What is a memorable experience you had recently?",
    steps: ["Say when or where it happened.", "Tell what happened first.", "Add what happened next.", "Explain why it was memorable."],
    vocabulary: ["last year", "then", "suddenly", "memorable"],
    targetExpressions: ["I remember when…", "After that…", "It was exciting because…", "What happened was…"],
    imageSrc: WEEKEND,
    imageAlt: "Students sharing a past experience"
  }),
  core({
    id: "talking-about-future-plans",
    title: "Talking About Future Plans",
    category: "Everyday Communication",
    scenario: "You talk with a classmate about plans for the next holiday or school break.",
    aiRole: "Classmate",
    studentRole: "Student",
    goal: "Share a future plan, explain why you chose it, and ask about your partner's plan.",
    aiContext: "The AI has one possible plan but may change it depending on the weather or family schedule.",
    skills: ["Sharing information", "Giving reasons", "Asking questions", "Clarifying"],
    complication: "The AI says the plan may change and asks what your second choice is.",
    conditions: ["State a future plan.", "Give a reason.", "Ask about timing and respond to a change."],
    openingLine: "Do you have any plans for the next holiday?",
    steps: ["Say what you plan to do.", "Explain why.", "Ask about your partner's plan.", "Offer another idea if needed."],
    vocabulary: ["plan", "holiday", "maybe", "available"],
    targetExpressions: ["I am going to…", "I would like to…", "Why don't we…?", "If that does not work…"],
    imageSrc: WEEKEND,
    imageAlt: "Friends discussing future plans"
  }),
  core({
    id: "making-plans-with-a-friend",
    title: "Making Plans With a Friend",
    category: "School & Social Life",
    scenario: "You and a friend want to choose an activity and a time to meet this weekend.",
    aiRole: "Friend",
    studentRole: "Student",
    goal: "Suggest an activity, negotiate a time, and confirm the plan.",
    aiContext: "The AI is interested but is busy on Saturday afternoon.",
    skills: ["Making suggestions", "Negotiating", "Clarifying", "Sharing information"],
    complication: "Your first proposed time is not convenient for your friend.",
    conditions: ["Suggest an activity.", "Ask about availability.", "Find a time that works for both people.", "Confirm the plan."],
    openingLine: "Are you free this weekend? What should we do?",
    steps: ["Suggest an activity.", "Ask about a day and time.", "Offer another option if needed.", "Repeat the final plan."],
    vocabulary: ["free", "Saturday", "morning", "meet"],
    targetExpressions: ["Would you like to…?", "How about…?", "What time works for you?", "That works for me."],
    imageSrc: WEEKEND,
    imageAlt: "Two friends making weekend plans"
  }),
  core({
    id: "making-and-responding-to-invitations",
    title: "Making and Responding to Invitations",
    category: "School & Social Life",
    scenario: "You invite a friend to a school event, then respond when your friend asks for more details.",
    aiRole: "Friend",
    studentRole: "Student",
    goal: "Invite your friend, explain the event, and respond politely to acceptance or refusal.",
    aiContext: "The AI wants to join but needs to know the place, time, and what to bring.",
    skills: ["Making suggestions", "Sharing information", "Clarifying", "Negotiating"],
    complication: "Your friend cannot attend at the original time and suggests another time.",
    conditions: ["Make a clear invitation.", "Share key event details.", "Respond appropriately and agree on a next step."],
    openingLine: "There is a school event next week. Would you like to come?",
    steps: ["Say what the event is.", "Give the time and place.", "Answer a question.", "Accept, decline, or negotiate politely."],
    vocabulary: ["event", "invite", "bring", "another time"],
    targetExpressions: ["Would you like to come?", "It starts at…", "I would love to.", "Maybe another time."],
    imageSrc: WEEKEND,
    imageAlt: "Students discussing a school invitation"
  }),
  core({
    id: "buying-clothes",
    title: "Buying Clothes",
    category: "Shopping & Services",
    scenario: "You need clothes for a school event and visit a shop to find an item in the right size and color.",
    aiRole: "Shop assistant",
    studentRole: "Customer",
    goal: "Explain what you need, ask about size, color, and price, and decide what to buy.",
    aiContext: "The shop has a blue T-shirt, a black hoodie, and a green jacket. One requested size is unavailable.",
    skills: ["Requesting", "Asking questions", "Describing", "Comparing", "Problem solving"],
    complication: "The first choice is unavailable in your size, so you need to compare another option.",
    conditions: ["Describe the item you need.", "Ask at least two useful questions.", "Respond to availability and make a decision."],
    openingLine: "Hi! Can I help you find something today?",
    steps: ["Explain the event and item you need.", "Ask about size or color.", "Ask the price or try-on option.", "Choose an item or another option."],
    vocabulary: ["size", "color", "fitting room", "price"],
    targetExpressions: ["I am looking for…", "Do you have it in…?", "Can I try it on?", "I will take it."],
    imageSrc: SHOPPING,
    imageAlt: "A student choosing clothes with a shop assistant",
    durationSeconds: 300,
    referenceItems: [{ label: "Blue T-shirt", detail: "$18 · S/M" }, { label: "Black hoodie", detail: "$35 · M/L" }, { label: "Green jacket", detail: "$42 · L" }]
  }),
  core({
    id: "shopping-for-everyday-items",
    title: "Shopping for Everyday Items",
    category: "Shopping & Services",
    scenario: "You are in a store looking for several everyday items for a class project.",
    aiRole: "Store assistant",
    studentRole: "Customer",
    goal: "Ask where items are, compare two choices, and check the total before paying.",
    aiContext: "The store has notebooks, colored pens, and tape. One pen color is sold out.",
    skills: ["Asking questions", "Requesting", "Comparing", "Problem solving"],
    complication: "One item is sold out and the assistant suggests a substitute.",
    conditions: ["Name the items you need.", "Ask for locations or prices.", "Choose a substitute when needed.", "Confirm the total."],
    openingLine: "Hello. What are you looking for today?",
    steps: ["List the items.", "Ask where to find them.", "Compare options.", "Confirm your choice and total."],
    vocabulary: ["notebook", "pen", "tape", "sold out"],
    targetExpressions: ["Where can I find…?", "Which one is cheaper?", "Do you have another…?", "How much is the total?"],
    imageSrc: SHOPPING,
    imageAlt: "A student shopping for school supplies",
    durationSeconds: 240,
    referenceItems: [{ label: "Notebook", detail: "$3" }, { label: "Colored pens", detail: "$6" }, { label: "Tape", detail: "$2" }]
  }),
  core({
    id: "ordering-food",
    title: "Ordering Food",
    category: "Food & Restaurants",
    scenario: "You order a simple meal and drink at a busy café.",
    aiRole: "Café worker",
    studentRole: "Customer",
    goal: "Order a meal, ask about one ingredient, and confirm the order politely.",
    aiContext: "The café menu has sandwiches, soup, and juice. The soup contains an ingredient the customer asks about.",
    skills: ["Requesting", "Asking questions", "Clarifying", "Describing"],
    complication: "The worker explains that one item contains an ingredient you did not expect.",
    conditions: ["Choose food and a drink.", "Ask a question about the menu.", "Confirm the final order."],
    openingLine: "Hello! What can I get for you?",
    steps: ["Choose a meal.", "Ask about an ingredient.", "Change the order if needed.", "Confirm and thank the worker."],
    vocabulary: ["menu", "sandwich", "soup", "ingredient"],
    targetExpressions: ["I would like…", "Does it have…?", "Could I change…?", "That is all, thank you."],
    imageSrc: RESTAURANT,
    imageAlt: "A student ordering food at a café",
    durationSeconds: 180,
    referenceItems: [{ label: "Sandwich", detail: "$8" }, { label: "Soup", detail: "$5 · contains milk" }, { label: "Orange juice", detail: "$3" }]
  }),
  core({
    id: "at-a-restaurant",
    title: "At a Restaurant",
    category: "Food & Restaurants",
    scenario: "You are having lunch at a restaurant and need to choose a meal, ask for a change, and pay.",
    aiRole: "Restaurant worker",
    studentRole: "Customer",
    goal: "Order lunch, make one reasonable request, and check the bill before leaving.",
    aiContext: "The restaurant is busy. The menu has curry, pasta, and a set lunch; one side dish is unavailable.",
    skills: ["Requesting", "Clarifying", "Problem solving", "Giving reasons"],
    complication: "Your preferred side dish is unavailable and the worker offers another choice.",
    conditions: ["Place a complete order.", "Make or respond to a request.", "Check the bill and close politely."],
    openingLine: "Welcome. Are you ready to order?",
    steps: ["Choose a meal.", "Ask about or change a side dish.", "Confirm the order.", "Ask for the bill and thank the worker."],
    vocabulary: ["set lunch", "side dish", "bill", "instead"],
    targetExpressions: ["Could I have…?", "Is it possible to…?", "What do you recommend?", "Could I have the bill?"],
    imageSrc: RESTAURANT,
    imageAlt: "Students ordering lunch at a restaurant",
    durationSeconds: 300,
    referenceItems: [{ label: "Curry set", detail: "$10" }, { label: "Pasta set", detail: "$12" }, { label: "Fruit side", detail: "sold out" }]
  }),
  core({
    id: "asking-for-street-directions",
    title: "Asking for Street Directions",
    category: "Travel & Transportation",
    scenario: "You are visiting a neighborhood and ask someone how to walk to the library.",
    aiRole: "Helpful local",
    studentRole: "Visitor",
    goal: "Ask for a destination, check the route, and repeat the key direction before thanking the local.",
    aiContext: "The library is near a park, but the first street has construction, so the local suggests a small detour.",
    skills: ["Asking questions", "Clarifying", "Sharing information", "Follow-up questions"],
    complication: "The direct street is closed and the local gives an alternative route.",
    conditions: ["Name the destination.", "Ask at least one route question.", "Check your understanding of the detour."],
    openingLine: "Excuse me. Are you looking for somewhere?",
    steps: ["Ask for the library.", "Listen to the route.", "Check one turn or landmark.", "Repeat the route and thank the local."],
    vocabulary: ["library", "corner", "across from", "construction"],
    targetExpressions: ["How can I get to…?", "Is it far from here?", "Do I turn left?", "Thank you for your help."],
    imageSrc: DIRECTIONS,
    imageAlt: "A local giving walking directions"
  }),
  core({
    id: "giving-street-directions",
    title: "Giving Street Directions",
    category: "Travel & Transportation",
    scenario: "A visitor asks you how to walk from the station to a museum in your town.",
    aiRole: "Visitor",
    studentRole: "Local helper",
    goal: "Give clear step-by-step directions using landmarks and check that the visitor understands.",
    aiContext: "The visitor is unfamiliar with the area and may confuse left and right.",
    skills: ["Explaining", "Describing", "Clarifying", "Follow-up questions"],
    complication: "The visitor asks whether the route is accessible or whether there is another landmark.",
    conditions: ["Start from the station.", "Give at least three route steps.", "Use a landmark and check understanding."],
    openingLine: "Excuse me. Could you tell me how to get to the museum?",
    steps: ["Ask the starting point if needed.", "Give the first turn.", "Add landmarks and distance.", "Invite a check question."],
    vocabulary: ["go straight", "turn", "next to", "landmark"],
    targetExpressions: ["Go straight for…", "Turn left at…", "It is next to…", "Does that make sense?"],
    imageSrc: DIRECTIONS,
    imageAlt: "A student giving directions to a visitor"
  }),
  core({
    id: "asking-for-train-directions",
    title: "Asking for Train Directions",
    category: "Travel & Transportation",
    scenario: "You are at a train station and need help finding the correct platform for a day trip.",
    aiRole: "Station staff",
    studentRole: "Traveler",
    goal: "Ask which train to take, check the platform and time, and confirm where to change trains.",
    aiContext: "The fastest train requires one transfer; a direct train leaves later from another platform.",
    skills: ["Requesting", "Asking questions", "Comparing", "Clarifying"],
    complication: "The fastest route and the simplest route are different, so you must choose.",
    conditions: ["Name your destination.", "Ask about platform and departure time.", "Compare the routes and confirm your choice."],
    openingLine: "Good morning. Can I help you find a train?",
    steps: ["Say your destination.", "Ask for the platform.", "Ask about time or transfers.", "Repeat your chosen route."],
    vocabulary: ["platform", "transfer", "direct", "departure"],
    targetExpressions: ["Which platform is it?", "Does this train go to…?", "Where do I change?", "I will take the… train."],
    imageSrc: DIRECTIONS,
    imageAlt: "A traveler asking for train directions",
    durationSeconds: 240,
    referenceItems: [{ label: "Express", detail: "Platform 3 · 10:20 · 1 transfer" }, { label: "Local", detail: "Platform 1 · 10:35 · direct" }]
  }),
  core({
    id: "giving-train-directions",
    title: "Giving Train Directions",
    category: "Travel & Transportation",
    scenario: "A visitor asks you how to reach a popular place by train from the station information desk.",
    aiRole: "Visitor",
    studentRole: "Station helper",
    goal: "Explain the line, platform, transfer, and arrival stop in a way the visitor can repeat.",
    aiContext: "The visitor has a ticket for the wrong platform and needs a clear correction.",
    skills: ["Explaining", "Describing", "Clarifying", "Follow-up questions"],
    complication: "The visitor asks if they can use the same ticket after changing trains.",
    conditions: ["Identify the right line and platform.", "Explain any transfer.", "Check the visitor can repeat the plan."],
    openingLine: "Excuse me. Which train should I take for the city museum?",
    steps: ["Ask what the visitor already knows.", "Give line and platform information.", "Explain the transfer.", "Check understanding and answer one question."],
    vocabulary: ["line", "platform", "change trains", "stop"],
    targetExpressions: ["Take the… line.", "Change at…", "Get off at…", "Let me check that for you."],
    imageSrc: DIRECTIONS,
    imageAlt: "A station helper explaining a train route",
    durationSeconds: 240
  }),
  core({
    id: "using-public-transportation",
    title: "Using Public Transportation",
    category: "Travel & Transportation",
    scenario: "You need to use a bus or train to reach an unfamiliar place before an appointment.",
    aiRole: "Transit information worker",
    studentRole: "Traveler",
    goal: "Ask about the best route, fare, and travel time, then choose a practical option.",
    aiContext: "There is a cheaper route with more walking and a faster route with a higher fare.",
    skills: ["Asking questions", "Comparing", "Giving reasons", "Making suggestions"],
    complication: "The cheapest route may not arrive before your appointment.",
    conditions: ["Explain your destination and time limit.", "Ask about fare and duration.", "Choose a route and explain why."],
    openingLine: "Where do you need to go today?",
    steps: ["Give your destination and deadline.", "Ask about two route options.", "Compare time and cost.", "Choose and confirm."],
    vocabulary: ["fare", "arrive", "fastest", "cheapest"],
    targetExpressions: ["How long does it take?", "How much is the fare?", "Which is better for me?", "I would prefer… because…"],
    imageSrc: DIRECTIONS,
    imageAlt: "A traveler comparing public transportation options",
    durationSeconds: 300
  }),
  core({
    id: "at-a-train-station",
    title: "At a Train Station",
    category: "Travel & Transportation",
    scenario: "You arrive at a busy station and need to buy or change a ticket for your trip.",
    aiRole: "Station staff",
    studentRole: "Passenger",
    goal: "Explain your destination, ask about a ticket change, and confirm the departure details.",
    aiContext: "The passenger's original train is full, but another train leaves 30 minutes later.",
    skills: ["Requesting", "Clarifying", "Negotiating", "Problem solving"],
    complication: "The preferred train is full and the staff member offers a later option.",
    conditions: ["Explain the ticket problem.", "Ask about an alternative.", "Decide and repeat the final departure details."],
    openingLine: "Hello. What can I help you with?",
    steps: ["Explain your ticket or destination.", "Ask what options are available.", "Compare the options.", "Confirm the new ticket details."],
    vocabulary: ["ticket", "full", "later", "departure"],
    targetExpressions: ["I need to change…", "Is there another train?", "What time does it leave?", "That option is fine."],
    imageSrc: DIRECTIONS,
    imageAlt: "A passenger speaking with station staff",
    durationSeconds: 300
  }),
  core({
    id: "helping-a-tourist",
    title: "Helping a Tourist",
    category: "Japan & Cultural Exchange",
    scenario: "A tourist asks you for help finding a local place and wants one recommendation for the area.",
    aiRole: "Tourist",
    studentRole: "Local helper",
    goal: "Give directions, recommend a place, and explain one useful local custom or tip.",
    aiContext: "The tourist has limited time and wants something easy to reach from the station.",
    skills: ["Explaining", "Recommending", "Describing", "Asking questions"],
    complication: "The tourist has only one hour and asks for a closer alternative.",
    conditions: ["Ask what the tourist likes or needs.", "Give a practical recommendation.", "Explain how to reach it and one tip."],
    openingLine: "Hello. Could you recommend somewhere interesting nearby?",
    steps: ["Ask about interests or time.", "Recommend a place.", "Give directions.", "Add a useful local tip."],
    vocabulary: ["nearby", "recommend", "traditional", "entrance"],
    targetExpressions: ["You should visit…", "It is about… minutes away.", "If you like…, you can…", "One thing to remember is…"],
    imageSrc: DIRECTIONS,
    imageAlt: "A student helping a tourist",
    durationSeconds: 300
  }),
  core({
    id: "introducing-your-hometown",
    title: "Introducing Your Hometown",
    category: "Japan & Cultural Exchange",
    scenario: "You introduce your hometown to a visiting student who wants to understand what makes it special.",
    aiRole: "Visiting student",
    studentRole: "Local student",
    goal: "Describe two places or activities, explain what makes them special, and recommend one.",
    aiContext: "The visitor enjoys food and outdoor activities and asks what they can do in one day.",
    skills: ["Describing", "Explaining", "Recommending", "Giving reasons"],
    complication: "The visitor asks for an option on a rainy day.",
    conditions: ["Name two local features.", "Explain why one is special.", "Make a recommendation that fits the visitor."],
    openingLine: "What is your hometown like?",
    steps: ["Give a short overview.", "Describe a place or food.", "Recommend one activity.", "Answer the visitor's question."],
    vocabulary: ["famous", "local", "special", "rainy day"],
    targetExpressions: ["It is known for…", "You can see…", "I recommend… because…", "If it rains…"],
    imageSrc: DIRECTIONS,
    imageAlt: "A student introducing a hometown to a visitor",
    durationSeconds: 300
  }),
  core({
    id: "introducing-japanese-culture",
    title: "Introducing Japanese Culture",
    category: "Japan & Cultural Exchange",
    scenario: "An exchange student asks about a Japanese custom, celebration, food, or everyday practice.",
    aiRole: "Exchange student",
    studentRole: "Student guide",
    goal: "Explain the custom in simple English, give an example, and answer a respectful question.",
    aiContext: "The AI is interested but may have an incorrect idea about the custom.",
    skills: ["Explaining", "Describing", "Clarifying", "Sharing information"],
    complication: "The AI compares the custom with a different practice and asks if it is always done.",
    conditions: ["Name the custom.", "Explain when or how it happens.", "Correct or clarify one misunderstanding respectfully."],
    openingLine: "Could you tell me about a Japanese custom?",
    steps: ["Introduce the custom.", "Explain when and how it is practiced.", "Give a concrete example.", "Answer a comparison question."],
    vocabulary: ["custom", "celebration", "usually", "respect"],
    targetExpressions: ["It is common to…", "People do this when…", "That is similar, but…", "It depends on…"],
    imageSrc: INTRO,
    imageAlt: "Students discussing Japanese culture",
    durationSeconds: 300
  }),
  core({
    id: "asking-for-help",
    title: "Asking for Help",
    category: "Help & Problem Solving",
    scenario: "You have a problem at school and ask a teacher, staff member, or classmate for help.",
    aiRole: "Helpful school staff member",
    studentRole: "Student",
    goal: "Explain the problem clearly, ask for a specific kind of help, and confirm the next step.",
    aiContext: "The staff member can help, but needs one more detail before suggesting a solution.",
    skills: ["Requesting", "Explaining", "Clarifying", "Problem solving"],
    complication: "The first solution is not possible, so you need to ask about another option.",
    conditions: ["State what happened.", "Ask for specific help.", "Respond to a question and confirm what you will do next."],
    openingLine: "You look worried. What happened?",
    steps: ["Explain the situation.", "Say what help you need.", "Answer a clarifying question.", "Confirm the next action."],
    vocabulary: ["problem", "lost", "forgot", "solution"],
    targetExpressions: ["Could you help me with…?", "I am not sure how to…", "What should I do?", "I will try that."],
    imageSrc: INTRO,
    imageAlt: "A student asking a teacher for help"
  }),
  core({
    id: "lost-property",
    title: "Lost Property",
    category: "Help & Problem Solving",
    scenario: "You cannot find an important item after school and report it to the school office.",
    aiRole: "Office staff",
    studentRole: "Student",
    goal: "Describe the lost item and where you last saw it, then understand what to do next.",
    aiContext: "The office has a similar item but needs identifying details before handing it over.",
    skills: ["Describing", "Explaining", "Asking questions", "Clarifying"],
    complication: "The staff member found a similar item and asks you to describe yours more precisely.",
    conditions: ["Name and describe the item.", "Give a likely time and place.", "Answer identifying questions and follow the process."],
    openingLine: "Hello. How can I help you?",
    steps: ["Say what is missing.", "Describe its color or contents.", "Explain when you last had it.", "Ask what happens next."],
    vocabulary: ["lost", "wallet", "desk", "description"],
    targetExpressions: ["I lost my…", "It looks like…", "I last saw it…", "Where should I check?"],
    imageSrc: INTRO,
    imageAlt: "A student reporting a lost item",
    durationSeconds: 240
  }),
  core({
    id: "feeling-sick",
    title: "Feeling Sick",
    category: "Help & Problem Solving",
    scenario: "You feel unwell at school and explain your symptoms to a teacher or nurse.",
    aiRole: "School nurse",
    studentRole: "Student",
    goal: "Describe how you feel, answer safety questions, and decide on a sensible next step.",
    aiContext: "The nurse wants to know when the symptoms started and whether you can contact a family member.",
    skills: ["Describing", "Explaining", "Asking questions", "Problem solving"],
    complication: "The nurse asks whether you can continue class or need to call home.",
    conditions: ["Describe at least two symptoms.", "Say when they started.", "Answer a safety question and agree on a next step."],
    openingLine: "You do not look well. How are you feeling?",
    steps: ["Describe your symptoms.", "Say when they began.", "Answer questions about class or home.", "Confirm what you will do."],
    vocabulary: ["headache", "stomachache", "fever", "rest"],
    targetExpressions: ["I do not feel well.", "I have a…", "It started this morning.", "Could I rest?"],
    imageSrc: INTRO,
    imageAlt: "A student speaking with a school nurse",
    durationSeconds: 240
  }),
  core({
    id: "making-requests-and-asking-permission",
    title: "Making Requests and Asking Permission",
    category: "School & Social Life",
    scenario: "You need permission to use a school room or borrow equipment for a group project.",
    aiRole: "Teacher",
    studentRole: "Student representative",
    goal: "Explain what your group needs, make a polite request, and respond to conditions.",
    aiContext: "The teacher may agree if the room is left clean and the equipment is returned on time.",
    skills: ["Requesting", "Giving reasons", "Negotiating", "Clarifying"],
    complication: "The teacher cannot approve the original time and offers another time with a condition.",
    conditions: ["Explain the project need.", "Ask for permission politely.", "Negotiate time or conditions and confirm the agreement."],
    openingLine: "What do you need to ask me about?",
    steps: ["Explain the group project.", "Say exactly what you need.", "Respond to the condition.", "Repeat the final agreement."],
    vocabulary: ["permission", "borrow", "project", "return"],
    targetExpressions: ["May we…?", "Could we possibly…?", "We need it because…", "We will make sure to…"],
    imageSrc: INTRO,
    imageAlt: "A student asking a teacher for permission",
    durationSeconds: 300
  }),
  core({
    id: "giving-advice",
    title: "Giving Advice",
    category: "Opinions & Decisions",
    scenario: "A friend asks what they should do about a busy week with homework, a club, and a family event.",
    aiRole: "Friend",
    studentRole: "Advice giver",
    goal: "Listen to the situation, suggest two possible actions, and explain which you recommend.",
    aiContext: "The friend wants practical advice but has already promised to attend one event.",
    skills: ["Asking questions", "Making suggestions", "Giving reasons", "Problem solving"],
    complication: "The friend cannot use your first suggestion and asks for a simpler option.",
    conditions: ["Show you understand the problem.", "Offer at least two options.", "Recommend one option with a reason."],
    openingLine: "I have too much to do this week. What should I do?",
    steps: ["Ask one question.", "Suggest a practical action.", "Offer another option.", "Explain your recommendation."],
    vocabulary: ["busy", "schedule", "prioritize", "suggestion"],
    targetExpressions: ["You should…", "Why don't you…?", "Another idea is…", "I think… would be best because…"],
    imageSrc: HOBBIES,
    imageAlt: "Friends discussing advice",
    durationSeconds: 300
  }),
  core({
    id: "giving-an-opinion",
    title: "Giving an Opinion",
    category: "Opinions & Decisions",
    scenario: "Your class discusses whether students should have a short no-phone time during the school day.",
    aiRole: "Classmate with a different view",
    studentRole: "Student speaker",
    goal: "State your opinion, give two reasons, and respond respectfully to another view.",
    aiContext: "The AI thinks phones can be useful for translation and emergencies.",
    skills: ["Giving opinions", "Giving reasons", "Clarifying", "Negotiating"],
    complication: "Your partner raises a useful counterexample that you need to address.",
    conditions: ["State a clear opinion.", "Give two connected reasons.", "Acknowledge or answer the other view respectfully."],
    openingLine: "What do you think about a short no-phone time at school?",
    steps: ["Say your opinion.", "Give a reason and example.", "Listen to the other view.", "Respond and summarize your position."],
    vocabulary: ["opinion", "reason", "useful", "emergency"],
    targetExpressions: ["In my opinion…", "I think this because…", "I understand your point, but…", "For example…"],
    imageSrc: HOBBIES,
    imageAlt: "Students sharing opinions in class",
    durationSeconds: 300
  }),
  core({
    id: "choosing-between-options",
    title: "Choosing Between Options",
    category: "Opinions & Decisions",
    scenario: "Your group must choose one place for a class outing from three possible options.",
    aiRole: "Group member",
    studentRole: "Decision maker",
    goal: "Compare the options, ask about priorities, and agree on a choice with reasons.",
    aiContext: "The options differ in price, travel time, and activities. Group members have different priorities.",
    skills: ["Comparing", "Giving reasons", "Asking questions", "Negotiating"],
    complication: "The most popular option is more expensive than the group budget.",
    conditions: ["Compare at least two options.", "Ask what matters to the group.", "Agree on one option or a fair next step."],
    openingLine: "We need to choose one place for our class outing. Which option do you prefer?",
    steps: ["Ask about priorities.", "Compare price, time, or activities.", "Explain your preference.", "Reach an agreement."],
    vocabulary: ["option", "price", "distance", "budget"],
    targetExpressions: ["Which do you prefer?", "Compared with…, this is…", "The advantage is…", "How about meeting halfway?"],
    imageSrc: WEEKEND,
    imageAlt: "Students choosing between class outing options",
    durationSeconds: 300,
    referenceItems: [{ label: "Museum", detail: "$12 · 30 minutes" }, { label: "Park", detail: "$4 · 50 minutes" }, { label: "Aquarium", detail: "$18 · 25 minutes" }]
  }),
  core({
    id: "solving-an-everyday-problem",
    title: "Solving an Everyday Problem",
    category: "Help & Problem Solving",
    scenario: "Your group project cannot start because one important item is missing and the deadline is today.",
    aiRole: "Group member",
    studentRole: "Problem-solving partner",
    goal: "Clarify what happened, suggest practical solutions, and agree on who will do what next.",
    aiContext: "The missing item may be at school, at home, or available as a digital substitute.",
    skills: ["Clarifying", "Problem solving", "Making suggestions", "Negotiating"],
    complication: "The first solution will take too long, so the group must combine two smaller solutions.",
    conditions: ["Explain or confirm the problem.", "Suggest at least two solutions.", "Agree on roles and a next step."],
    openingLine: "We have a problem. How can we start the project?",
    steps: ["Clarify the missing item.", "Suggest one solution.", "Ask what is possible.", "Agree on roles and timing."],
    vocabulary: ["missing", "deadline", "replace", "solution"],
    targetExpressions: ["What exactly happened?", "We could…", "That may take too long.", "I can… if you…"],
    imageSrc: INTRO,
    imageAlt: "Students solving a group project problem",
    durationSeconds: 300
  })
];
