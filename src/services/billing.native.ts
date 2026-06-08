import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type MakePurchaseResult,
  type PurchasesOffering
} from "react-native-purchases";

import { BILLING_OFFERING_ID, type BillingProductId } from "./billingCatalog";

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

let configuredAppUserId: string | null = null;
let configuredOnce = false;
const REMOVE_ADS_ENTITLEMENT_ID = "remove_ads";

const getRevenueCatApiKey = () => {
  const apiKey =
    Platform.OS === "android"
      ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;

  return apiKey?.trim() ? apiKey.trim() : null;
};

const summarizeOffering = (offering: PurchasesOffering): BillingOfferingSummary => ({
  availablePackages: offering.availablePackages.map((pkg) => pkg.identifier),
  identifier: offering.identifier
});

const summarizeCustomer = (customerInfo: CustomerInfo): BillingCustomerSnapshot => {
  const activeEntitlementIds = Object.keys(customerInfo.entitlements.active);

  return {
    activeEntitlementIds,
    hasRemoveAds: Boolean(customerInfo.entitlements.active[REMOVE_ADS_ENTITLEMENT_ID]?.isActive)
  };
};

const summarizePurchase = (purchase: MakePurchaseResult): BillingPurchaseSummary => ({
  customer: summarizeCustomer(purchase.customerInfo),
  productIdentifier: purchase.productIdentifier,
  transactionIdentifier: purchase.transaction.transactionIdentifier
});

export const configureBilling = async (appUserId: string | null) => {
  if (!appUserId) {
    return;
  }

  const apiKey = getRevenueCatApiKey();

  if (!apiKey) {
    if (__DEV__) {
      console.warn("[billing] RevenueCat API key is missing. Set EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY / IOS key.");
    }
    return;
  }

  await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);

  if (!configuredOnce) {
    Purchases.configure({
      apiKey,
      appUserID: appUserId
    });
    configuredOnce = true;
    configuredAppUserId = appUserId;
    return;
  }

  if (configuredAppUserId !== appUserId) {
    await Purchases.logIn(appUserId);
    configuredAppUserId = appUserId;
  }
};

export const getShopOffering = async (): Promise<BillingOfferingSummary | null> => {
  const offerings = await Purchases.getOfferings();
  const offering = offerings.all[BILLING_OFFERING_ID] ?? offerings.current ?? null;

  return offering ? summarizeOffering(offering) : null;
};

export const getBillingCustomerSnapshot = async (): Promise<BillingCustomerSnapshot> => {
  const customerInfo = await Purchases.getCustomerInfo();
  return summarizeCustomer(customerInfo);
};

export const getLocalizedBillingPrices = async (
  productIds: BillingProductId[]
): Promise<BillingPriceMap> => {
  const uniqueIds = Array.from(new Set(productIds));

  if (uniqueIds.length === 0) {
    return {};
  }

  const products = await Purchases.getProducts(
    uniqueIds,
    Purchases.PRODUCT_CATEGORY.NON_SUBSCRIPTION
  );

  return products.reduce<BillingPriceMap>((map, product) => {
    map[product.identifier as BillingProductId] = product.priceString;
    return map;
  }, {});
};

export const purchaseBillingProduct = async (
  productId: BillingProductId
): Promise<BillingPurchaseSummary> => {
  const offerings = await Purchases.getOfferings();
  const offering = offerings.all[BILLING_OFFERING_ID] ?? offerings.current ?? null;
  const matchingPackage =
    offering?.availablePackages.find(
      (pkg) => pkg.product.identifier === productId || pkg.identifier === productId
    ) ?? null;

  if (matchingPackage) {
    return summarizePurchase(await Purchases.purchasePackage(matchingPackage));
  }

  const products = await Purchases.getProducts([productId], Purchases.PRODUCT_CATEGORY.NON_SUBSCRIPTION);
  const product = products.find((candidate) => candidate.identifier === productId);

  if (!product) {
    throw new Error("This shop item is not available in the store right now.");
  }

  return summarizePurchase(await Purchases.purchaseStoreProduct(product));
};

export const restoreBillingPurchases = async (): Promise<CustomerInfo> => Purchases.restorePurchases();
