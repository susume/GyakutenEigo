/**
 * Canonical browsing metadata for the built-in Speaking Task library.
 *
 * Category labels remain the persisted/display value used by existing school
 * activities. Stable ids are provided alongside them so the UI does not need
 * to infer hierarchy from activity order or translated labels.
 */

export const SPEAKING_LIBRARY_COLLECTIONS = [
  "school-english",
  "workplace-english"
] as const;

export type SpeakingLibraryCollection = (typeof SPEAKING_LIBRARY_COLLECTIONS)[number];

export const SPEAKING_LIBRARY_COLLECTION_LABELS: Record<SpeakingLibraryCollection, string> = {
  "school-english": "School English",
  "workplace-english": "Workplace English"
};

export const SPEAKING_LIBRARY_CATEGORY_DEFINITIONS = [
  {
    id: "everyday-communication",
    collectionId: "school-english",
    name: "Everyday Communication",
    description: "Friendly conversations about everyday life, routines and plans.",
    displayOrder: 1
  },
  {
    id: "shopping-services",
    collectionId: "school-english",
    name: "Shopping & Services",
    description: "Useful English for choosing items, asking for help and paying.",
    displayOrder: 2
  },
  {
    id: "food-restaurants",
    collectionId: "school-english",
    name: "Food & Restaurants",
    description: "Practice ordering, describing food and handling simple problems.",
    displayOrder: 3
  },
  {
    id: "travel-transportation",
    collectionId: "school-english",
    name: "Travel & Transportation",
    description: "Ask for directions, compare routes and help visitors get around.",
    displayOrder: 4
  },
  {
    id: "school-social-life",
    collectionId: "school-english",
    name: "School & Social Life",
    description: "Talk about school life, friends, invitations and shared activities.",
    displayOrder: 5
  },
  {
    id: "help-problem-solving",
    collectionId: "school-english",
    name: "Help & Problem Solving",
    description: "Explain a problem, ask for help and agree on a practical next step.",
    displayOrder: 6
  },
  {
    id: "opinions-decisions",
    collectionId: "school-english",
    name: "Opinions & Decisions",
    description: "Share views, give advice and make decisions with other people.",
    displayOrder: 7
  },
  {
    id: "japan-cultural-exchange",
    collectionId: "school-english",
    name: "Japan & Cultural Exchange",
    description: "Introduce local places, culture and customs to a visitor.",
    displayOrder: 8
  },
  {
    id: "luxury-car-sales",
    collectionId: "workplace-english",
    name: "Luxury Car Sales",
    description: "Help customers buy, sell, compare and discuss premium vehicles.",
    displayOrder: 1
  },
  {
    id: "hotels-hospitality",
    collectionId: "workplace-english",
    name: "Hotels & Hospitality",
    description: "Support hotel guests at reception and throughout their stay.",
    displayOrder: 2
  },
  {
    id: "restaurants-cafes",
    collectionId: "workplace-english",
    name: "Restaurants & Cafés",
    description: "Serve international customers clearly and professionally.",
    displayOrder: 3
  },
  {
    id: "retail-customer-service",
    collectionId: "workplace-english",
    name: "Retail & Customer Service",
    description: "Help customers choose products, solve problems and complete purchases.",
    displayOrder: 4
  },
  {
    id: "tourism-visitor-support",
    collectionId: "workplace-english",
    name: "Tourism & Visitor Support",
    description: "Help international visitors navigate, plan and enjoy their stay in Japan.",
    displayOrder: 5
  },
  {
    id: "office-business",
    collectionId: "workplace-english",
    name: "Office & Business",
    description: "Communicate with colleagues, clients and business visitors.",
    displayOrder: 6
  }
] as const;

export type SpeakingLibraryCategoryId = (typeof SPEAKING_LIBRARY_CATEGORY_DEFINITIONS)[number]["id"];
export type SpeakingLibraryCategoryDefinition = (typeof SPEAKING_LIBRARY_CATEGORY_DEFINITIONS)[number];

export const SPEAKING_LIBRARY_CATEGORY_IDS = [
  "everyday-communication",
  "shopping-services",
  "food-restaurants",
  "travel-transportation",
  "school-social-life",
  "help-problem-solving",
  "opinions-decisions",
  "japan-cultural-exchange",
  "luxury-car-sales",
  "hotels-hospitality",
  "restaurants-cafes",
  "retail-customer-service",
  "tourism-visitor-support",
  "office-business"
] as const satisfies readonly SpeakingLibraryCategoryId[];
export const SPEAKING_CATEGORIES = SPEAKING_LIBRARY_CATEGORY_DEFINITIONS.map((category) => category.name) as string[];
export type SpeakingCategory = (typeof SPEAKING_LIBRARY_CATEGORY_DEFINITIONS)[number]["name"];

export const SPEAKING_LIBRARY_COLLECTION_DEFINITIONS = [
  {
    id: "school-english",
    name: "School English",
    description: "Real-world speaking tasks for junior-high English classes.",
    audience: "Junior-high students",
    categories: SPEAKING_LIBRARY_CATEGORY_DEFINITIONS.filter((category) => category.collectionId === "school-english")
  },
  {
    id: "workplace-english",
    name: "Workplace English",
    description: "Practical English for real customer, service and business situations.",
    audience: "Adults and workplace learners",
    categories: SPEAKING_LIBRARY_CATEGORY_DEFINITIONS.filter((category) => category.collectionId === "workplace-english")
  }
] as const;

export const SPEAKING_LIBRARY_COLLECTION_IDS = new Set<SpeakingLibraryCollection>(SPEAKING_LIBRARY_COLLECTIONS);
export const SPEAKING_LIBRARY_CATEGORY_ID_SET = new Set<SpeakingLibraryCategoryId>(SPEAKING_LIBRARY_CATEGORY_IDS);

export const speakingLibraryCategoryDefinition = (
  collectionId: SpeakingLibraryCollection,
  categoryName: string
): SpeakingLibraryCategoryDefinition | undefined => SPEAKING_LIBRARY_CATEGORY_DEFINITIONS.find(
  (category) => category.collectionId === collectionId && category.name === categoryName
);

export const speakingLibraryCategoryId = (
  collectionId: SpeakingLibraryCollection,
  categoryName: string
): SpeakingLibraryCategoryId | undefined => speakingLibraryCategoryDefinition(collectionId, categoryName)?.id;
