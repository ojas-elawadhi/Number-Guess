import { Platform } from "react-native";
import Purchases, { LOG_LEVEL, type CustomerInfo, type PurchasesOffering } from "react-native-purchases";

import { BILLING_OFFERING_ID } from "./billingCatalog";

export interface BillingOfferingSummary {
  availablePackages: string[];
  identifier: string;
}

let configuredAppUserId: string | null = null;
let configuredOnce = false;

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

export const restoreBillingPurchases = async (): Promise<CustomerInfo> => Purchases.restorePurchases();
