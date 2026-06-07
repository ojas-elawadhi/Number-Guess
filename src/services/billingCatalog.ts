export const BILLING_OFFERING_ID = "Shop";

export const BILLING_PRODUCT_IDS = {
  bundleOffer1: "bundle_offer_1",
  coins1400: "coins_1400",
  coins26000: "coins_26000",
  coins3200: "coins_3200",
  coins800: "coins_800",
  coins8600: "coins_8600",
  noAds: "no_ads"
} as const;

export type BillingProductId = (typeof BILLING_PRODUCT_IDS)[keyof typeof BILLING_PRODUCT_IDS];
