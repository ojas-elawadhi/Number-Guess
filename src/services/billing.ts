import type { BillingProductId } from "./billingCatalog";

export interface BillingOfferingSummary {
  availablePackages: string[];
  identifier: string;
}

export type BillingPriceMap = Partial<Record<BillingProductId, string>>;
export interface BillingCustomerSnapshot {
  activeEntitlementIds: string[];
  hasRemoveAds: boolean;
}

export interface BillingPurchaseSummary {
  customer: BillingCustomerSnapshot;
  productIdentifier: string;
  transactionIdentifier: string;
}

export const configureBilling = async (_appUserId: string | null) => {};

export const getShopOffering = async (): Promise<BillingOfferingSummary | null> => null;

export const getBillingCustomerSnapshot = async (): Promise<BillingCustomerSnapshot> => ({
  activeEntitlementIds: [],
  hasRemoveAds: false
});

export const getLocalizedBillingPrices = async (
  _productIds: BillingProductId[]
): Promise<BillingPriceMap> => ({});

export const purchaseBillingProduct = async (
  _productId: BillingProductId
): Promise<BillingPurchaseSummary> => {
  throw new Error("Store billing is only available in the native mobile app.");
};

export const restoreBillingPurchases = async () => null;
