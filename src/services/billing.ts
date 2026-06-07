import type { BillingProductId } from "./billingCatalog";

export interface BillingOfferingSummary {
  availablePackages: string[];
  identifier: string;
}

export type BillingPriceMap = Partial<Record<BillingProductId, string>>;

export const configureBilling = async (_appUserId: string | null) => {};

export const getShopOffering = async (): Promise<BillingOfferingSummary | null> => null;

export const getLocalizedBillingPrices = async (
  _productIds: BillingProductId[]
): Promise<BillingPriceMap> => ({});

export const restoreBillingPurchases = async () => null;
