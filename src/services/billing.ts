export interface BillingOfferingSummary {
  availablePackages: string[];
  identifier: string;
}

export const configureBilling = async (_appUserId: string | null) => {};

export const getShopOffering = async (): Promise<BillingOfferingSummary | null> => null;

export const restoreBillingPurchases = async () => null;
