import { create } from "zustand";

interface MonetizationStore {
  hasNoAdsEntitlement: boolean;
  setHasNoAdsEntitlement: (value: boolean) => void;
}

export const useMonetizationStore = create<MonetizationStore>((set) => ({
  hasNoAdsEntitlement: false,
  setHasNoAdsEntitlement: (value) => {
    set({
      hasNoAdsEntitlement: value
    });
  }
}));
