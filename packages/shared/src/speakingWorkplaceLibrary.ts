import { LUXURY_CAR_SALES_LIBRARY } from "./speakingLuxuryCarSales.js";
import { HOTELS_HOSPITALITY_LIBRARY } from "./speakingHotelsHospitality.js";
import { RESTAURANTS_CAFES_LIBRARY } from "./speakingRestaurantsCafes.js";
import { RETAIL_CUSTOMER_SERVICE_LIBRARY } from "./speakingRetailCustomerService.js";
import { TOURISM_VISITOR_SUPPORT_LIBRARY } from "./speakingTourismVisitorSupport.js";
import { OFFICE_BUSINESS_LIBRARY } from "./speakingOfficeBusiness.js";
import type { SpeakingCoreLibraryItem } from "./speakingSchoolLibrary.js";

/** The complete workplace collection, ordered by the canonical category registry. */
export const WORKPLACE_ENGLISH_LIBRARY: SpeakingCoreLibraryItem[] = [
  ...LUXURY_CAR_SALES_LIBRARY,
  ...HOTELS_HOSPITALITY_LIBRARY,
  ...RESTAURANTS_CAFES_LIBRARY,
  ...RETAIL_CUSTOMER_SERVICE_LIBRARY,
  ...TOURISM_VISITOR_SUPPORT_LIBRARY,
  ...OFFICE_BUSINESS_LIBRARY
];

