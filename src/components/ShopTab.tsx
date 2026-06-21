import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ImageSourcePropType } from "react-native";

import {
  getBillingCustomerSnapshot,
  getLocalizedBillingPrices,
  purchaseBillingProduct,
  type BillingPriceMap
} from "../services/billing";
import { BILLING_PRODUCT_IDS, type BillingProductId } from "../services/billingCatalog";
import { isRewardedReviveSupported, showRewardedReviveAd } from "../services/rewardedReviveAd";
import { useMonetizationStore } from "../store/useMonetizationStore";
import { playSound } from "../services/soundEffects";
import { usePlayerProgressStore } from "../store/usePlayerProgressStore";
import { colors, radii, shadows, spacing } from "../utils/theme";
import { AppBannerAd } from "./AppBannerAd";
import { BoosterIcon, type BoosterIconKind } from "./BoosterIcon";
import { CoinIcon } from "./CoinIcon";

type IconName = ComponentProps<typeof Ionicons>["name"];
const billingEnabled = process.env.EXPO_PUBLIC_ENABLE_BILLING === "true";

type StoreCurrency = "cash" | "coins" | "ad";

interface PurchaseDraft {
  id: string;
  title: string;
  description: string;
  priceLabel: string;
  currency: StoreCurrency;
  billingProductId?: BillingProductId;
  coinsReward?: number;
  extraGuessReward?: number;
  skipReward?: number;
  removesAds?: boolean;
}

interface PurchaseSuccessReward {
  icon: "coins" | "extra-guess" | "skip" | "no-ads";
  label: string;
  value: string;
}

interface PurchaseSuccess {
  eyebrow: string;
  title: string;
  subtitle: string;
  rewards: PurchaseSuccessReward[];
}

interface CoinPackOffer extends PurchaseDraft {
  amountLabel: string;
  badge?: string;
  art: "small-stack" | "medium-stack" | "large-stack" | "bag" | "chest" | "treasure";
}

interface BoosterShopOffer {
  id: string;
  title: string;
  icon: BoosterIconKind;
  accent: string;
  singleCost: number;
  tripleCost: number;
  rewardKind: "extra-guess" | "skip";
}

const featuredOffer: PurchaseDraft = {
  id: "starter-bundle",
  title: "STARTER PACK",
  description: "Starter bundle for quick runs and skip saves.",
  priceLabel: "₹480.00",
  currency: "cash",
  billingProductId: BILLING_PRODUCT_IDS.bundleOffer1,
  coinsReward: 1000,
  extraGuessReward: 3,
  skipReward: 2
};

const noAdsOffer: PurchaseDraft = {
  id: "no-ads",
  title: "NO ADS",
  description: "Removes banner and interstitial ads. Rewarded bonus ads stay available.",
  priceLabel: "₹990.00",
  currency: "cash",
  billingProductId: BILLING_PRODUCT_IDS.noAds,
  removesAds: true
};

const coinPackOffers: CoinPackOffer[] = [
  {
    id: "coins-50",
    title: "50",
    amountLabel: "50",
    description: "Watch a rewarded ad to claim.",
    priceLabel: "FREE",
    currency: "ad",
    coinsReward: 50,
    art: "small-stack"
  },
  {
    id: "coins-800",
    title: "800",
    amountLabel: "800",
    description: "Quick top-up.",
    priceLabel: "₹290.00",
    currency: "cash",
    billingProductId: BILLING_PRODUCT_IDS.coins800,
    coinsReward: 800,
    art: "medium-stack"
  },
  {
    id: "coins-1400",
    title: "1400",
    amountLabel: "1400",
    description: "Solid refill.",
    priceLabel: "₹480.00",
    currency: "cash",
    billingProductId: BILLING_PRODUCT_IDS.coins1400,
    coinsReward: 1400,
    art: "large-stack"
  },
  {
    id: "coins-3200",
    title: "3200",
    amountLabel: "3200",
    description: "Steady stash.",
    priceLabel: "₹950.00",
    currency: "cash",
    billingProductId: BILLING_PRODUCT_IDS.coins3200,
    coinsReward: 3200,
    badge: "Most\nPopular!",
    art: "bag"
  },
  {
    id: "coins-8600",
    title: "8600",
    amountLabel: "8600",
    description: "Long session chest.",
    priceLabel: "₹1,950.00",
    currency: "cash",
    billingProductId: BILLING_PRODUCT_IDS.coins8600,
    coinsReward: 8600,
    art: "chest"
  },
  {
    id: "coins-26000",
    title: "26000",
    amountLabel: "26000",
    description: "Big vault drop.",
    priceLabel: "₹4,850.00",
    currency: "cash",
    billingProductId: BILLING_PRODUCT_IDS.coins26000,
    coinsReward: 26000,
    badge: "Best\nValue!",
    art: "treasure"
  }
];

const boosterOffers: BoosterShopOffer[] = [
  {
    id: "extra-guess-booster",
    title: "EXTRA GUESS BOOSTER",
    icon: "flash",
    accent: "#b55cff",
    singleCost: 150,
    tripleCost: 425,
    rewardKind: "extra-guess"
  },
  {
    id: "skip-booster",
    title: "SKIP BOOSTER",
    icon: "play-skip-forward",
    accent: "#6bbdff",
    singleCost: 200,
    tripleCost: 550,
    rewardKind: "skip"
  }
];

const coinPackArtSources: Record<CoinPackOffer["art"], ImageSourcePropType> = {
  "small-stack": require("../../assets/shop/coin-pack-small.png"),
  "medium-stack": require("../../assets/shop/coin-pack-medium.png"),
  "large-stack": require("../../assets/shop/coin-pack-large.png"),
  bag: require("../../assets/shop/coin-pack-bag.png"),
  chest: require("../../assets/shop/coin-pack-chest.png"),
  treasure: require("../../assets/shop/coin-pack-treasure.png")
};
const noAdsButtonImage = require("../../assets/ui/no-ads-button.png") as ImageSourcePropType;

function NoAdsIcon({ size }: { size: number }) {
  return (
    <Image
      accessibilityIgnoresInvertColors
      resizeMode="contain"
      source={noAdsButtonImage}
      style={{ height: size, width: size }}
    />
  );
}

function CoinToken({ size = 30, style }: { size?: number; style?: object }) {
  return <CoinIcon size={size} style={style} />;
}

function CoinWatermark({ size = 16 }: { size?: number }) {
  return (
    <View style={styles.coinWatermark}>
      <CoinToken size={size} />
    </View>
  );
}

function BoosterGlyph({ accent, icon, size = 52 }: { accent: string; icon: BoosterIconKind; size?: number }) {
  void accent;

  return <BoosterIcon kind={icon} size={size} />;
}

function CoinArt({ variant }: { variant: CoinPackOffer["art"] }) {
  return <Image resizeMode="contain" source={coinPackArtSources[variant]} style={styles.coinPackImage} />;
}

function CoinPricePill({ label, style, textStyle }: { label: string; style?: object; textStyle?: object }) {
  return (
    <View style={[styles.shopPricePill, style]}>
      <Text adjustsFontSizeToFit minimumFontScale={0.68} numberOfLines={1} style={[styles.shopPricePillText, textStyle]}>
        {label}
      </Text>
    </View>
  );
}

const getDisplayPriceLabel = (draft: PurchaseDraft, localizedPrices: BillingPriceMap) => {
  if (draft.currency !== "cash" || !draft.billingProductId) {
    return draft.priceLabel;
  }

  return localizedPrices[draft.billingProductId] ?? draft.priceLabel;
};

const withDisplayPrice = (draft: PurchaseDraft, localizedPrices: BillingPriceMap): PurchaseDraft => ({
  ...draft,
  priceLabel: getDisplayPriceLabel(draft, localizedPrices)
});

const getPurchaseSuccess = (purchase: PurchaseDraft): PurchaseSuccess => {
  if (purchase.removesAds) {
    return {
      eyebrow: "PAYMENT SECURED",
      title: "Purchase complete",
      subtitle: "NO ADS is now active on this account.",
      rewards: [
        {
          icon: "no-ads",
          label: "ENTITLEMENT",
          value: "Ads removed"
        }
      ]
    };
  }

  const rewards: PurchaseSuccessReward[] = [];
  const isCoinOnlyReward = Boolean(purchase.coinsReward && !purchase.extraGuessReward && !purchase.skipReward);

  if (purchase.coinsReward) {
    rewards.push({
      icon: "coins",
      label: "COINS",
      value: `+${purchase.coinsReward.toLocaleString("en-US")}`
    });
  }

  if (purchase.extraGuessReward) {
    rewards.push({
      icon: "extra-guess",
      label: "EXTRA GUESS",
      value: `+${purchase.extraGuessReward}`
    });
  }

  if (purchase.skipReward) {
    rewards.push({
      icon: "skip",
      label: "SKIPS",
      value: `+${purchase.skipReward}`
    });
  }

  return {
    eyebrow: purchase.currency === "cash" ? "PAYMENT SECURED" : "REWARD SECURED",
    title: "Purchase complete",
    subtitle: isCoinOnlyReward
      ? `${purchase.coinsReward?.toLocaleString("en-US")} coins were added to your profile.`
      : `${purchase.title} was added to your profile.`,
    rewards
  };
};

function ShopStatusStrip() {
  const { width } = useWindowDimensions();
  const isCompact = width <= 380;
  const isMediumPhone = width > 380 && width <= 410;
  const statusIconSize = isCompact ? 22 : isMediumPhone ? 23 : 25;
  const statusBoosterIconSize = isCompact ? 26 : isMediumPhone ? 27 : 30;
  const extraGuessPowerUps = usePlayerProgressStore((state) => state.profile.extraGuessPowerUps);
  const skipBoosters = usePlayerProgressStore((state) => state.profile.skipBoosters);
  const coins = usePlayerProgressStore((state) => state.profile.coins);

  return (
    <View style={styles.statusStrip}>
      <View style={[styles.statusPill, isCompact && styles.statusPillCompact, isMediumPhone && styles.statusPillMedium]}>
        <Text style={[styles.statusPillValue, isCompact && styles.statusPillValueCompact, isMediumPhone && styles.statusPillValueMedium]}>{extraGuessPowerUps}</Text>
        <BoosterGlyph accent="#b55cff" icon="flash" size={statusBoosterIconSize} />
      </View>
      <View style={[styles.statusPill, isCompact && styles.statusPillCompact, isMediumPhone && styles.statusPillMedium]}>
        <Text style={[styles.statusPillValue, isCompact && styles.statusPillValueCompact, isMediumPhone && styles.statusPillValueMedium]}>{skipBoosters}</Text>
        <BoosterGlyph accent="#6bbdff" icon="play-skip-forward" size={statusBoosterIconSize} />
      </View>
      <View style={[styles.statusCoinPill, isCompact && styles.statusCoinPillCompact, isMediumPhone && styles.statusCoinPillMedium]}>
        <Text numberOfLines={1} style={[styles.statusCoinValue, isCompact && styles.statusCoinValueCompact, isMediumPhone && styles.statusCoinValueMedium]}>
          {coins.toLocaleString("en-US")}
        </Text>
        <CoinToken size={statusIconSize} />
      </View>
    </View>
  );
}

function SuccessRewardIcon({ reward }: { reward: PurchaseSuccessReward }) {
  if (reward.icon === "coins") {
    return <CoinToken size={34} />;
  }

  if (reward.icon === "extra-guess") {
    return <BoosterGlyph accent="#b55cff" icon="flash" size={36} />;
  }

  if (reward.icon === "skip") {
    return <BoosterGlyph accent="#6bbdff" icon="play-skip-forward" size={36} />;
  }

  return <NoAdsIcon size={38} />;
}

function PurchaseSuccessModal({
  onClose,
  success
}: {
  onClose: () => void;
  success: PurchaseSuccess | null;
}) {
  if (!success) {
    return null;
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} statusBarTranslucent transparent visible>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, styles.successModalCard]}>
          <View style={styles.successHeader}>
            <View style={styles.successSealOuter}>
              <View style={styles.successSealInner}>
                <Ionicons color="#ffffff" name="checkmark" size={34} />
              </View>
            </View>
            <Text style={styles.successEyebrow}>{success.eyebrow}</Text>
            <Text style={styles.successTitle}>{success.title}</Text>
            <Text style={styles.successSubtitle}>{success.subtitle}</Text>
          </View>

          {success.rewards.length > 0 ? (
            <View style={styles.successRewardsPanel}>
              <View style={styles.successRewardsHeader}>
                <Text style={styles.successRewardsTitle}>Added to profile</Text>
                <Ionicons color={colors.accent} name="sparkles" size={18} />
              </View>
              {success.rewards.map((reward) => (
                <View key={`${reward.icon}-${reward.label}`} style={styles.successRewardRow}>
                  <View style={styles.successRewardIcon}>
                    <SuccessRewardIcon reward={reward} />
                  </View>
                  <View style={styles.successRewardCopy}>
                    <Text style={styles.successRewardLabel}>{reward.label}</Text>
                    <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.successRewardValue}>
                      {reward.value}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.successDoneButton, pressed && styles.pressed]}
          >
            <Text style={styles.successDoneButtonText}>DONE</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function NoAdsCheckoutModal({
  busy,
  onCancel,
  onConfirm,
  purchase
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  purchase: PurchaseDraft;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onCancel} statusBarTranslucent transparent visible>
      <View style={[styles.modalBackdrop, styles.noAdsModalBackdrop]}>
        <View style={styles.noAdsPurchaseCardShadow}>
          <View pointerEvents="none" style={styles.noAdsPurchaseCardDepth} />
          <View style={styles.noAdsPurchaseCard}>
            <View pointerEvents="none" style={styles.noAdsPurchaseStripes}>
              {Array.from({ length: 7 }).map((_, index) => (
                <View key={`stripe-${index}`} style={[styles.noAdsPurchaseStripe, { left: -40 + index * 70 }]} />
              ))}
            </View>

            <Pressable
              accessibilityLabel="Close No Ads purchase"
              disabled={busy}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.noAdsPurchaseClose,
                pressed && !busy && styles.pressed,
                busy && styles.checkoutDisabled
              ]}
            >
              <Ionicons color="#9a6500" name="close" size={26} />
            </Pressable>

            <View style={styles.noAdsPurchaseIconStage}>
              <NoAdsIcon size={176} />
            </View>

            <Text style={styles.noAdsPurchaseTitle}>REMOVE ADS</Text>
            <Text style={styles.noAdsPurchaseSubtitle}>PLAY WITHOUT INTERRUPTIONS</Text>

            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.noAdsPurchaseButton,
                pressed && !busy && styles.noAdsPurchaseButtonPressed,
                busy && styles.checkoutDisabled
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.noAdsPurchasePrice}>
                  {purchase.priceLabel}
                </Text>
              )}
            </Pressable>

            <Text style={styles.noAdsPurchaseNote}>REMOVES BANNER AND FULL-SCREEN POP-UP ADS</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CheckoutModal({
  busy,
  onCancel,
  onConfirm,
  purchase
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  purchase: PurchaseDraft | null;
}) {
  if (!purchase) {
    return null;
  }

  if (purchase.removesAds) {
    return (
      <NoAdsCheckoutModal
        busy={busy}
        onCancel={onCancel}
        onConfirm={onConfirm}
        purchase={purchase}
      />
    );
  }

  const actionLabel =
    purchase.currency === "cash"
      ? "COMPLETE PAYMENT"
      : purchase.currency === "ad"
        ? "WATCH AD"
        : "BUY WITH COINS";
  const hasMultipleRewards =
    [purchase.coinsReward, purchase.extraGuessReward, purchase.skipReward, purchase.removesAds].filter(Boolean).length > 1;
  const checkoutIcon =
    purchase.removesAds ? (
      <NoAdsIcon size={44} />
    ) : hasMultipleRewards ? (
      <Ionicons color={colors.accent} name="bag-handle" size={24} />
    ) : purchase.extraGuessReward ? (
      <BoosterIcon kind="extra-guess" size={36} />
    ) : purchase.skipReward ? (
      <BoosterIcon kind="skip" size={36} />
    ) : purchase.currency === "ad" ? (
      <Ionicons color={colors.accent} name="play" size={22} />
    ) : (
      <CoinIcon size={38} />
    );

  return (
    <Modal animationType="fade" statusBarTranslucent transparent visible>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, styles.checkoutModalCard]}>
          <View style={styles.checkoutHeader}>
            <View style={styles.checkoutHeaderCopy}>
              <Text style={styles.checkoutEyebrow}>SECURE CHECKOUT</Text>
              <Text style={styles.modalTitle}>Confirm purchase</Text>
            </View>
            <Pressable
              accessibilityLabel="Close checkout"
              disabled={busy}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.checkoutCloseButton,
                pressed && !busy && styles.pressed,
                busy && styles.checkoutDisabled
              ]}
            >
              <Ionicons color={colors.textMuted} name="close" size={20} />
            </Pressable>
          </View>

          <View style={styles.checkoutProduct}>
            <View style={styles.checkoutProductIcon}>{checkoutIcon}</View>
            <View style={styles.checkoutProductCopy}>
              <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1} style={styles.checkoutName}>
                {purchase.title}
              </Text>
              <Text numberOfLines={2} style={styles.checkoutText}>{purchase.description}</Text>
            </View>
            <View style={styles.checkoutPriceWrap}>
              <Text style={styles.checkoutPriceLabel}>TOTAL</Text>
              <Text adjustsFontSizeToFit minimumFontScale={0.68} numberOfLines={1} style={styles.checkoutPrice}>
                {purchase.priceLabel}
              </Text>
            </View>
          </View>

          <View style={styles.checkoutRewards}>
            <Text style={styles.checkoutRewardsTitle}>YOU RECEIVE</Text>
            {purchase.coinsReward ? (
              <View style={styles.checkoutRewardRow}>
                <CoinIcon size={24} />
                <Text style={styles.checkoutRewardLabel}>Coins</Text>
                <Text style={styles.checkoutRewardValue}>+{purchase.coinsReward.toLocaleString("en-US")}</Text>
              </View>
            ) : null}
            {purchase.extraGuessReward ? (
              <View style={styles.checkoutRewardRow}>
                <BoosterIcon kind="extra-guess" size={24} />
                <Text style={styles.checkoutRewardLabel}>Extra guesses</Text>
                <Text style={styles.checkoutRewardValue}>+{purchase.extraGuessReward}</Text>
              </View>
            ) : null}
            {purchase.skipReward ? (
              <View style={styles.checkoutRewardRow}>
                <BoosterIcon kind="skip" size={24} />
                <Text style={styles.checkoutRewardLabel}>Skips</Text>
                <Text style={styles.checkoutRewardValue}>+{purchase.skipReward}</Text>
              </View>
            ) : null}
            {purchase.removesAds ? (
              <View style={styles.checkoutRewardRow}>
                <NoAdsIcon size={26} />
                <Text style={styles.checkoutRewardLabel}>No Ads</Text>
                <Text style={styles.checkoutRewardValue}>ACTIVE</Text>
              </View>
            ) : null}
          </View>

          <Pressable
            disabled={busy}
            onPress={onConfirm}
            style={({ pressed }) => [
              styles.checkoutConfirmButton,
              pressed && !busy && styles.pressed,
              busy && styles.checkoutDisabled
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons
                  color="#ffffff"
                  name={purchase.currency === "ad" ? "play" : purchase.currency === "coins" ? "wallet" : "lock-closed"}
                  size={17}
                />
                <Text numberOfLines={1} style={styles.checkoutConfirmText}>{actionLabel}</Text>
              </>
            )}
          </Pressable>

          <Pressable
            disabled={busy}
            onPress={onCancel}
            style={({ pressed }) => [
              styles.checkoutCancelButton,
              pressed && !busy && styles.pressed,
              busy && styles.checkoutDisabled
            ]}
          >
            <Text style={styles.checkoutCancelText}>CANCEL</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

interface NoAdsPurchasePromptProps {
  onClose: () => void;
  visible: boolean;
}

export function NoAdsPurchasePrompt({ onClose, visible }: NoAdsPurchasePromptProps) {
  const setHasNoAdsEntitlement = useMonetizationStore((state) => state.setHasNoAdsEntitlement);
  const [processingPurchase, setProcessingPurchase] = useState(false);
  const [priceLabel, setPriceLabel] = useState(noAdsOffer.priceLabel);
  const [purchaseSuccess, setPurchaseSuccess] = useState<PurchaseSuccess | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }

    let cancelled = false;

    const loadNoAdsPrice = async () => {
      try {
        const prices = await getLocalizedBillingPrices([BILLING_PRODUCT_IDS.noAds]);

        if (!cancelled) {
          setPriceLabel(prices[BILLING_PRODUCT_IDS.noAds] ?? noAdsOffer.priceLabel);
        }
      } catch {
        if (!cancelled) {
          setPriceLabel(noAdsOffer.priceLabel);
        }
      }
    };

    void loadNoAdsPrice();

    return () => {
      cancelled = true;
    };
  }, [visible]);

  const closePrompt = () => {
    if (processingPurchase) {
      return;
    }

    setPurchaseSuccess(null);
    onClose();
  };

  const confirmPurchase = async () => {
    try {
      setProcessingPurchase(true);

      if (!billingEnabled) {
        throw new Error("Billing is not enabled in this build yet.");
      }

      const purchase = await purchaseBillingProduct(BILLING_PRODUCT_IDS.noAds);
      setHasNoAdsEntitlement(purchase.customer.hasRemoveAds);
      setPurchaseSuccess(getPurchaseSuccess(noAdsOffer));
      playSound("purchaseSuccess");
    } catch (error) {
      const billingError = error as { userCancelled?: boolean | null };

      if (billingError?.userCancelled) {
        onClose();
        return;
      }

      playSound("purchaseFail");
      Alert.alert(
        "Purchase unavailable",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setProcessingPurchase(false);
    }
  };

  if (purchaseSuccess) {
    return <PurchaseSuccessModal onClose={closePrompt} success={purchaseSuccess} />;
  }

  if (!visible) {
    return null;
  }

  return (
    <NoAdsCheckoutModal
      busy={processingPurchase}
      onCancel={closePrompt}
      onConfirm={() => void confirmPurchase()}
      purchase={{ ...noAdsOffer, priceLabel }}
    />
  );
}

export function ShopTabHeader() {
  return <ShopStatusStrip />;
}

export function ShopTab() {
  const { width } = useWindowDimensions();
  const isCompact = width <= 380;
  const isMediumPhone = width > 380 && width <= 410;
  const isLargePhone = width >= 410;
  const awardCoins = usePlayerProgressStore((state) => state.awardCoins);
  const awardExtraGuessPowerUps = usePlayerProgressStore((state) => state.awardExtraGuessPowerUps);
  const awardSkipBoosters = usePlayerProgressStore((state) => state.awardSkipBoosters);
  const spendCoins = usePlayerProgressStore((state) => state.spendCoins);
  const hasNoAdsEntitlement = useMonetizationStore((state) => state.hasNoAdsEntitlement);
  const setHasNoAdsEntitlement = useMonetizationStore((state) => state.setHasNoAdsEntitlement);
  const canShowRewardedAds = isRewardedReviveSupported();

  const [showBoosters, setShowBoosters] = useState(false);
  const [purchaseDraft, setPurchaseDraft] = useState<PurchaseDraft | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<PurchaseSuccess | null>(null);
  const [processingPurchase, setProcessingPurchase] = useState(false);
  const [localizedPrices, setLocalizedPrices] = useState<BillingPriceMap>({});

  useEffect(() => {
    let cancelled = false;

    const loadBillingContext = async () => {
      try {
        const [prices, customer] = await Promise.all([
          getLocalizedBillingPrices([
            BILLING_PRODUCT_IDS.bundleOffer1,
            BILLING_PRODUCT_IDS.noAds,
            BILLING_PRODUCT_IDS.coins800,
            BILLING_PRODUCT_IDS.coins1400,
            BILLING_PRODUCT_IDS.coins3200,
            BILLING_PRODUCT_IDS.coins8600,
            BILLING_PRODUCT_IDS.coins26000
          ]),
          billingEnabled ? getBillingCustomerSnapshot() : Promise.resolve(null)
        ]);

        if (!cancelled) {
          setLocalizedPrices(prices);
          setHasNoAdsEntitlement(customer?.hasRemoveAds ?? false);
        }
      } catch {
        if (!cancelled) {
          setLocalizedPrices({});
          setHasNoAdsEntitlement(false);
        }
      }
    };

    void loadBillingContext();

    return () => {
      cancelled = true;
    };
  }, []);

  const openPurchase = (draft: PurchaseDraft) => {
    if (draft.currency === "cash" && draft.removesAds && hasNoAdsEntitlement) {
      Alert.alert("Already unlocked", "Ads are already removed for this account.");
      return;
    }

    if (draft.currency === "ad" && !canShowRewardedAds) {
      playSound("purchaseFail");
      Alert.alert("Rewarded ad unavailable", "Rewarded ads are not available in this build yet.");
      return;
    }

    playSound("modalOpen");
    setPurchaseDraft(withDisplayPrice(draft, localizedPrices));
  };

  const handleConfirmPurchase = async () => {
    if (!purchaseDraft) {
      return;
    }

    try {
      setProcessingPurchase(true);

      if (purchaseDraft.currency === "coins") {
        const spent = await spendCoins(Number(purchaseDraft.priceLabel));

        if (!spent) {
          playSound("purchaseFail");
          Alert.alert("Not enough coins", "Play a few more rounds or buy a larger coin pack first.");
          return;
        }
      }

      if (purchaseDraft.currency === "cash") {
        if (!billingEnabled) {
          throw new Error("Billing is not enabled in this build yet.");
        }

        if (!purchaseDraft.billingProductId) {
          throw new Error("This shop item is not linked to a store product yet.");
        }

        const purchase = await purchaseBillingProduct(purchaseDraft.billingProductId);

        if (purchaseDraft.removesAds) {
          setHasNoAdsEntitlement(purchase.customer.hasRemoveAds);
          setPurchaseSuccess(getPurchaseSuccess(purchaseDraft));
          setPurchaseDraft(null);
          playSound("purchaseSuccess");
          return;
        }
      }

      if (purchaseDraft.currency === "ad") {
        const rewarded = await showRewardedReviveAd();

        if (!rewarded) {
          playSound("purchaseFail");
          Alert.alert("Reward unavailable", "Ad was skipped or unavailable. Try again.");
          return;
        }
      }

      const grantResults: boolean[] = [];

      if (purchaseDraft.coinsReward) {
        grantResults.push(await awardCoins(purchaseDraft.coinsReward));
      }

      if (purchaseDraft.extraGuessReward) {
        grantResults.push(await awardExtraGuessPowerUps(purchaseDraft.extraGuessReward));
      }

      if (purchaseDraft.skipReward) {
        grantResults.push(await awardSkipBoosters(purchaseDraft.skipReward));
      }

      if (grantResults.some((result) => !result)) {
        throw new Error("The purchase went through, but we couldn't update your profile. Please reopen the app and check again.");
      }

      setPurchaseSuccess(getPurchaseSuccess(purchaseDraft));
      setPurchaseDraft(null);
      playSound("purchaseSuccess");
    } catch (error) {
      const billingError = error as { message?: string; userCancelled?: boolean | null };

      if (billingError?.userCancelled) {
        setPurchaseDraft(null);
        return;
      }

      playSound("purchaseFail");
      Alert.alert(
        "Purchase unavailable",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setProcessingPurchase(false);
    }
  };

  const handleBoosterPurchase = (offer: BoosterShopOffer, packSize: 1 | 3) => {
    playSound("powerup");
    const isExtraGuess = offer.rewardKind === "extra-guess";
    const count = packSize === 1 ? 1 : 3;
    const cost = packSize === 1 ? offer.singleCost : offer.tripleCost;

    openPurchase({
      id: `${offer.id}-${packSize}`,
      title: `${offer.title} x${count}`,
      description: `Spend coins to add ${count} ${isExtraGuess ? "extra guess" : "skip"} booster${count > 1 ? "s" : ""}.`,
      priceLabel: `${cost}`,
      currency: "coins",
      extraGuessReward: isExtraGuess ? count : 0,
      skipReward: isExtraGuess ? 0 : count
    });
  };

  const featuredOfferDisplay = withDisplayPrice(featuredOffer, localizedPrices);
  const noAdsOfferDisplay = withDisplayPrice(noAdsOffer, localizedPrices);

  return (
    <View style={styles.shopShell}>
      <View pointerEvents="none" style={styles.shopBackdrop}>
        {Array.from({ length: 7 }).map((_, index) => (
          <View
            key={`stripe-${index}`}
            style={[
              styles.shopBackdropStripe,
              {
                left: -120 + index * 96,
                top: -40 + index * 148
              }
            ]}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.shopScrollContent,
          !hasNoAdsEntitlement && styles.shopScrollContentWithBanner,
          isMediumPhone && styles.shopScrollContentMedium
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => openPurchase(featuredOffer)}
          style={({ pressed }) => [
            styles.featuredCard,
            isCompact ? styles.featuredCardCompact : isMediumPhone ? styles.featuredCardMedium : isLargePhone ? styles.featuredCardLarge : null,
            pressed && styles.pressed
          ]}
        >
          <View style={styles.featuredGlow} />
          <View style={styles.featuredHeaderRow}>
            <View style={styles.featuredCopy}>
              <Text style={[styles.featuredTitle, isCompact && styles.featuredTitleCompact]}>{featuredOffer.title}</Text>
            </View>
            <View style={[styles.featuredBadge, isCompact && styles.featuredBadgeCompact]}>
              <Text style={[styles.featuredBadgeText, isCompact && styles.featuredBadgeTextCompact]}>BEST VALUE</Text>
            </View>
          </View>

          <View style={[styles.featuredRewardGrid, isCompact && styles.featuredRewardGridCompact]}>
            <View style={[styles.featuredRewardChip, isCompact && styles.featuredRewardChipCompact]}>
              <CoinToken size={isCompact ? 28 : 31} />
              <View style={styles.featuredRewardTextBlock}>
                <Text style={[styles.featuredRewardValue, isCompact && styles.featuredRewardValueCompact]}>
                  {featuredOffer.coinsReward?.toLocaleString("en-US")}
                </Text>
                <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={[styles.featuredRewardLabel, isCompact && styles.featuredRewardLabelCompact]}>COINS</Text>
              </View>
            </View>

            <View style={[styles.featuredRewardChip, isCompact && styles.featuredRewardChipCompact]}>
              <BoosterGlyph accent="#b55cff" icon="flash" size={isCompact ? 26 : 30} />
              <View style={styles.featuredRewardTextBlock}>
                <Text style={[styles.featuredRewardValue, isCompact && styles.featuredRewardValueCompact]}>{featuredOffer.extraGuessReward}</Text>
                <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={[styles.featuredRewardLabel, isCompact && styles.featuredRewardLabelCompact]}>
                  GUESS
                </Text>
              </View>
            </View>

            <View style={[styles.featuredRewardChip, isCompact && styles.featuredRewardChipCompact]}>
              <BoosterGlyph accent="#6bbdff" icon="play-skip-forward" size={isCompact ? 26 : 30} />
              <View style={styles.featuredRewardTextBlock}>
                <Text style={[styles.featuredRewardValue, isCompact && styles.featuredRewardValueCompact]}>{featuredOffer.skipReward}</Text>
                <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={[styles.featuredRewardLabel, isCompact && styles.featuredRewardLabelCompact]}>SKIPS</Text>
              </View>
            </View>
          </View>

          <View style={[styles.featuredPriceButton, isCompact && styles.featuredPriceButtonCompact]}>
            <Text style={[styles.featuredPriceButtonLabel, isCompact && styles.featuredPriceButtonLabelCompact]}>BUY BUNDLE</Text>
            <Text style={[styles.featuredPriceButtonText, isCompact && styles.featuredPriceButtonTextCompact]}>
              {featuredOfferDisplay.priceLabel}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => openPurchase(noAdsOffer)}
          style={({ pressed }) => [styles.noAdsCard, isCompact && styles.noAdsCardCompact, isMediumPhone && styles.noAdsCardMedium, pressed && styles.pressed]}
        >
          <NoAdsIcon size={isCompact ? 38 : 42} />
          <Text style={[styles.noAdsTitle, isCompact && styles.noAdsTitleCompact, isMediumPhone && styles.noAdsTitleMedium]}>{noAdsOffer.title}</Text>
          <CoinPricePill
            label={noAdsOfferDisplay.priceLabel}
            style={[styles.noAdsPricePill, isCompact && styles.noAdsPricePillCompact, isMediumPhone && styles.noAdsPricePillMedium]}
            textStyle={isCompact ? styles.shopPricePillTextCompact : isMediumPhone ? styles.shopPricePillTextMedium : undefined}
          />
        </Pressable>
        <Text style={[styles.noAdsHint, isCompact && styles.noAdsHintCompact, isMediumPhone && styles.noAdsHintMedium]}>
          PURCHASE REMOVES BANNER AND FULL-SCREEN POP-UP ADS!
        </Text>

        <View style={[styles.coinGrid, isMediumPhone && styles.coinGridMedium]}>
          {coinPackOffers.map((offer) => (
            <Pressable
              key={offer.id}
              onPress={() => openPurchase(offer)}
              style={({ pressed }) => [
                styles.coinCard,
                isMediumPhone && styles.coinCardMedium,
                styles.coinCardThreeUp,
                pressed && styles.pressed
              ]}
            >
              <Text style={[styles.coinCardAmount, isCompact && styles.coinCardAmountCompact, isMediumPhone && styles.coinCardAmountMedium]}>{offer.amountLabel}</Text>
              <CoinArt variant={offer.art} />
              {offer.badge ? (
                <View
                  style={[
                    styles.coinCardBadgeShell,
                    isCompact && styles.coinCardBadgeCompact,
                    isMediumPhone && styles.coinCardBadgeMedium
                  ]}
                >
                  <View
                    style={[
                      styles.coinCardBadgeFace,
                      isCompact && styles.coinCardBadgeFaceCompact,
                      isMediumPhone && styles.coinCardBadgeFaceMedium,
                      offer.badge.includes("Best") ? styles.bestValueBadge : styles.popularBadge
                    ]}
                  >
                    <View style={styles.coinCardBadgeShine} />
                    <Text style={[styles.coinCardBadgeText, isCompact && styles.coinCardBadgeTextCompact, isMediumPhone && styles.coinCardBadgeTextMedium]}>
                      {offer.badge.includes("Best") ? "Best\nValue" : "Most\nPopular"}
                    </Text>
                  </View>
                </View>
              ) : null}
              <View style={[styles.coinCardFooter, isMediumPhone && styles.coinCardFooterMedium]}>
                {offer.currency === "ad" ? (
                  <View style={styles.freeOfferWrap}>
                    <CoinPricePill
                      label={offer.priceLabel}
                      style={styles.freePill}
                      textStyle={
                        isCompact
                          ? styles.coinCardPriceTextCompact
                          : isMediumPhone
                            ? styles.coinCardPriceTextMedium
                            : undefined
                      }
                    />
                    <View style={styles.adBubble}><Text style={styles.adBubbleText}>AD</Text></View>
                  </View>
                ) : (
                  <CoinPricePill
                    label={getDisplayPriceLabel(offer, localizedPrices)}
                    textStyle={
                      isCompact
                        ? styles.coinCardPriceTextCompact
                        : isMediumPhone
                          ? styles.coinCardPriceTextMedium
                          : undefined
                    }
                  />
                )}
              </View>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => {
            playSound("tabSwitch");
            setShowBoosters((current) => !current);
          }}
          style={({ pressed }) => [styles.boostersToggle, isCompact && styles.boostersToggleCompact, pressed && styles.pressed]}
        >
          <Text style={[styles.boostersToggleText, isCompact && styles.boostersToggleTextCompact]}>BUY BOOSTERS</Text>
          <View style={[styles.boostersToggleAction, isCompact && styles.boostersToggleActionCompact]}>
            <Ionicons color="#ffffff" name={showBoosters ? "chevron-up" : "chevron-down"} size={isCompact ? 28 : 34} />
          </View>
        </Pressable>

        {showBoosters ? (
          <View style={styles.boosterSections}>
            {boosterOffers.map((offer) => (
              <View key={offer.id} style={styles.boosterPanel}>
                <View style={styles.boosterPanelHeader}>
                  <View style={styles.boosterPanelIcon}>
                    <BoosterGlyph accent={offer.accent} icon={offer.icon} size={32} />
                  </View>
                  <Text style={styles.boosterPanelTitle}>{offer.title}</Text>
                  <View style={styles.boosterInfoBadge}>
                    <Ionicons color="#ffffff" name="information" size={15} />
                  </View>
                </View>

                <View style={styles.boosterCardsRow}>
                  <Pressable
                    onPress={() => handleBoosterPurchase(offer, 1)}
                    style={({ pressed }) => [
                      styles.boosterCard,
                      styles.boosterCardTwoUp,
                      pressed && styles.pressed
                    ]}
                  >
                    <Text style={[styles.boosterGetLabel, { color: offer.accent }]}>GET 1</Text>
                    <View style={styles.boosterIconStage}>
                      <BoosterGlyph accent={offer.accent} icon={offer.icon} size={78} />
                    </View>
                    <View style={styles.boosterCostPill}>
                      <CoinToken size={23} />
                      <Text style={styles.boosterCostText}>{offer.singleCost}</Text>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() => handleBoosterPurchase(offer, 3)}
                    style={({ pressed }) => [
                      styles.boosterCard,
                      styles.boosterCardTwoUp,
                      pressed && styles.pressed
                    ]}
                  >
                    <View style={styles.boosterValueBadge}>
                      <View style={styles.boosterValueBadgeShine} />
                      <Text style={styles.boosterValueBadgeText}>Best Value</Text>
                    </View>
                    <Text style={[styles.boosterGetLabel, { color: offer.accent }]}>GET 3</Text>
                    <View style={styles.boosterIconStage}>
                      <View style={styles.boosterTripleIcons}>
                        <View style={[styles.boosterTripleIconSlot, styles.boosterTripleIconTop]}>
                          <BoosterGlyph accent={offer.accent} icon={offer.icon} size={50} />
                        </View>
                        <View style={[styles.boosterTripleIconSlot, styles.boosterTripleIconLeft]}>
                          <BoosterGlyph accent={offer.accent} icon={offer.icon} size={45} />
                        </View>
                        <View style={[styles.boosterTripleIconSlot, styles.boosterTripleIconRight]}>
                          <BoosterGlyph accent={offer.accent} icon={offer.icon} size={45} />
                        </View>
                      </View>
                    </View>
                    <View style={styles.boosterCostPill}>
                      <CoinToken size={23} />
                      <Text style={styles.boosterCostText}>{offer.tripleCost}</Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {hasNoAdsEntitlement ? null : (
        <View style={styles.adBannerDock}>
          <AppBannerAd style={styles.adBanner} />
        </View>
      )}

      <CheckoutModal
        busy={processingPurchase}
        onCancel={() => setPurchaseDraft(null)}
        onConfirm={() => void handleConfirmPurchase()}
        purchase={purchaseDraft}
      />
      <PurchaseSuccessModal
        onClose={() => {
          playSound("tabSwitch");
          setPurchaseSuccess(null);
        }}
        success={purchaseSuccess}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shopShell: {
    backgroundColor: "transparent",
    flex: 1,
    overflow: "hidden",
    position: "relative"
  },
  shopBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  shopBackdropStripe: {
    backgroundColor: "transparent",
    height: 64,
    position: "absolute",
    transform: [{ rotate: "-35deg" }],
    width: 420
  },
  shopScrollContent: {
    gap: 10,
    paddingBottom: spacing.md,
    paddingHorizontal: 8,
    paddingTop: 8
  },
  shopScrollContentWithBanner: {
    paddingBottom: 92
  },
  shopScrollContentMedium: {
    gap: 8
  },
  shopTopActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  shopBackButton: {
    alignItems: "center",
    height: 42,
    justifyContent: "center",
    width: 42
  },
  statusStrip: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
    width: "100%"
  },
  statusPill: {
    alignSelf: "center",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.surfaceMuted,
    borderWidth: 1,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 6,
    justifyContent: "flex-end",
    height: 40,
    minWidth: 58,
    paddingHorizontal: 6
  },
  statusPillCompact: {
    height: 36,
    minWidth: 52,
    paddingHorizontal: 4
  },
  statusPillMedium: {
    height: 30,
    minWidth: 70,
    paddingHorizontal: 4
  },
  statusPillValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  statusPillValueCompact: {
    fontSize: 13
  },
  statusPillValueMedium: {
    fontSize: 14
  },
  statusCoinPill: {
    alignSelf: "center",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.surfaceMuted,
    borderWidth: 1,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 3,
    justifyContent: "flex-end",
    height: 40,
    minWidth: 88,
    paddingHorizontal: 5
  },
  statusCoinPillCompact: {
    height: 36,
    minWidth: 80,
    paddingHorizontal: 4
  },
  statusCoinPillMedium: {
    height: 30,
    minWidth: 90,
    paddingHorizontal: 4
  },
  statusCoinValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
    maxWidth: 72
  },
  statusCoinValueCompact: {
    fontSize: 13,
    maxWidth: 62
  },
  statusCoinValueMedium: {
    fontSize: 14,
    maxWidth: 68
  },
  featuredCard: {
    backgroundColor: "#f4fbff",
    borderBottomColor: "rgba(0,0,0,0.08)",
    borderBottomWidth: 3,
    borderColor: "#bfe4ff",
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    overflow: "hidden",
    padding: 10,
    position: "relative",
    ...shadows.card
  },
  featuredCardCompact: {
    borderRadius: 16,
    gap: 8,
    padding: 8
  },
  featuredCardMedium: {
    borderRadius: 16
  },
  featuredCardLarge: {
    padding: 10
  },
  featuredGlow: {
    backgroundColor: "rgba(92,184,253,0.12)",
    borderRadius: 120,
    height: 120,
    position: "absolute",
    right: -38,
    top: -42,
    width: 120
  },
  featuredHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  featuredCopy: {
    flex: 1,
    minWidth: 0
  },
  featuredEyebrow: {
    color: "#397493",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8
  },
  featuredEyebrowCompact: {
    fontSize: 9
  },
  featuredTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 26
  },
  featuredTitleCompact: {
    fontSize: 19,
    lineHeight: 22
  },
  featuredBadge: {
    alignItems: "center",
    backgroundColor: "#fff1a8",
    borderColor: "#f3b22f",
    borderBottomWidth: 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 30,
    paddingHorizontal: 10,
    transform: [{ rotate: "-2deg" }],
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 2
  },
  featuredBadgeCompact: {
    minHeight: 28,
    paddingHorizontal: 8
  },
  featuredBadgeText: {
    color: "#7a4a00",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7
  },
  featuredBadgeTextCompact: {
    fontSize: 9
  },
  featuredRewardGrid: {
    flexDirection: "row",
    gap: 8
  },
  featuredRewardGridCompact: {
    gap: 6
  },
  featuredRewardChip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#dce7ec",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 54,
    paddingHorizontal: 8
  },
  featuredRewardChipCompact: {
    borderRadius: 12,
    gap: 6,
    minHeight: 48,
    paddingHorizontal: 6
  },
  featuredRewardTextBlock: {
    flex: 1,
    minWidth: 0
  },
  featuredRewardValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 20
  },
  featuredRewardValueCompact: {
    fontSize: 15,
    lineHeight: 18
  },
  featuredRewardLabel: {
    color: "#58656b",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5
  },
  featuredRewardLabelCompact: {
    fontSize: 8
  },
  featuredPriceButton: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: colors.accent,
    borderBottomColor: colors.accentDark,
    borderBottomWidth: 2,
    borderRadius: 13,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: 14
  },
  featuredPriceButtonCompact: {
    minHeight: 40,
    paddingHorizontal: 12
  },
  featuredPriceButtonLabel: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7
  },
  featuredPriceButtonLabelCompact: {
    fontSize: 10
  },
  featuredPriceButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900"
  },
  featuredPriceButtonTextCompact: {
    fontSize: 15
  },
  noAdsCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.surfaceMuted,
    borderWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.08)",
    borderBottomWidth: 2,
    borderRadius: 16,
    flexDirection: "row",
    gap: 8,
    minHeight: 64,
    paddingHorizontal: 10,
    ...shadows.card
  },
  noAdsCardCompact: {
    borderRadius: 16,
    minHeight: 60,
    paddingHorizontal: 10
  },
  noAdsCardMedium: {
    minHeight: 62
  },
  noAdsTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "900"
  },
  noAdsTitleCompact: {
    fontSize: 13
  },
  noAdsTitleMedium: {
    fontSize: 13
  },
  noAdsPricePill: {
    minWidth: 104
  },
  noAdsPricePillCompact: {
    minHeight: 38,
    minWidth: 96
  },
  noAdsPricePillMedium: {
    minHeight: 38,
    minWidth: 98
  },
  noAdsHint: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    textAlign: "center"
  },
  noAdsHintCompact: {
    lineHeight: 12,
    paddingHorizontal: 8
  },
  noAdsHintMedium: {
    fontSize: 10,
    lineHeight: 12,
    marginBottom: 4,
    paddingHorizontal: 14
  },
  shopPricePill: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderBottomColor: colors.accentDark,
    borderBottomWidth: 2,
    borderRadius: radii.pill,
    justifyContent: "center",
    minHeight: 38,
    minWidth: 100,
    paddingHorizontal: 8
  },
  shopPricePillText: {
    color: "#ffffff",
    includeFontPadding: false,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 18,
    textAlign: "center"
  },
  shopPricePillTextCompact: {
    fontSize: 13
  },
  shopPricePillTextMedium: {
    fontSize: 13
  },
  coinGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
    width: "100%"
  },
  coinGridMedium: {
    gap: 8,
    justifyContent: "space-between"
  },
  coinCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.surfaceMuted,
    borderWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.09)",
    borderBottomWidth: 2,
    borderRadius: 16,
    gap: 4,
    minHeight: 154,
    minWidth: 0,
    overflow: "visible",
    paddingHorizontal: 8,
    paddingTop: 8,
    position: "relative",
    ...shadows.card
  },
  coinCardThreeUp: {
    minWidth: 0,
    width: "31.5%"
  },
  coinCardMedium: {
    minHeight: 150
  },
  coinCardAmount: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 21
  },
  coinCardAmountCompact: {
    fontSize: 17,
    lineHeight: 19
  },
  coinCardAmountMedium: {
    fontSize: 19,
    lineHeight: 21
  },
  coinPackImage: {
    height: 74,
    marginTop: -1,
    width: 108
  },
  coinArtStage: {
    alignItems: "center",
    height: 58,
    justifyContent: "center",
    position: "relative",
    width: 82
  },
  coinArtShadow: {
    backgroundColor: "rgba(22, 45, 53, 0.10)",
    borderRadius: 999,
    bottom: 1,
    height: 9,
    position: "absolute",
    width: 54
  },
  coinPileA: {
    left: 18,
    position: "absolute",
    top: 29,
    zIndex: 3
  },
  coinPileB: {
    left: 38,
    position: "absolute",
    top: 29,
    zIndex: 3
  },
  coinPileC: {
    left: 28,
    position: "absolute",
    top: 12,
    zIndex: 4
  },
  coinPileD: {
    left: 48,
    position: "absolute",
    top: 13,
    zIndex: 4
  },
  coinPileE: {
    left: 9,
    position: "absolute",
    top: 39,
    zIndex: 2
  },
  coinPileF: {
    left: 56,
    position: "absolute",
    top: 39,
    zIndex: 2
  },
  coinPileG: {
    left: 37,
    position: "absolute",
    top: 0,
    zIndex: 5
  },
  bagSack: {
    alignItems: "center",
    backgroundColor: "#c9965b",
    borderBottomColor: "#9f6a34",
    borderBottomWidth: 3,
    borderColor: "#e0b77d",
    borderRadius: 18,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 40,
    zIndex: 2
  },
  bagTie: {
    alignSelf: "center",
    backgroundColor: "#8b5a2b",
    borderRadius: radii.pill,
    height: 7,
    position: "absolute",
    top: 7,
    width: 22
  },
  bagBadge: {
    alignItems: "center",
    backgroundColor: "#b47b3f",
    borderColor: "#f2c55f",
    borderRadius: 10,
    borderWidth: 1,
    height: 21,
    justifyContent: "center",
    marginTop: 8,
    width: 21
  },
  bagCoinTop: {
    left: 18,
    position: "absolute",
    top: 4,
    zIndex: 1
  },
  bagCoinSide: {
    position: "absolute",
    right: 15,
    top: 14,
    zIndex: 1
  },
  chestPeekCoinA: {
    left: 22,
    position: "absolute",
    top: 12,
    zIndex: 1
  },
  chestPeekCoinB: {
    position: "absolute",
    right: 22,
    top: 14,
    zIndex: 1
  },
  chestLid: {
    backgroundColor: "#6a3d18",
    borderColor: "#8f5b2d",
    borderWidth: 1,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    height: 18,
    justifyContent: "center",
    position: "absolute",
    top: 18,
    width: 52,
    zIndex: 3
  },
  chestLidBand: {
    backgroundColor: "#f2c55f",
    height: 4,
    opacity: 0.9,
    width: "100%"
  },
  chestBase: {
    alignItems: "center",
    backgroundColor: "#9d642d",
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderColor: "#c58a43",
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    position: "absolute",
    top: 34,
    width: 58,
    zIndex: 4
  },
  chestBand: {
    backgroundColor: "#f2c55f",
    bottom: 0,
    height: "100%",
    left: 26,
    position: "absolute",
    width: 6
  },
  treasurePeekCoinA: {
    left: 18,
    position: "absolute",
    top: 10,
    zIndex: 1
  },
  treasurePeekCoinB: {
    position: "absolute",
    right: 20,
    top: 8,
    zIndex: 1
  },
  treasurePeekCoinC: {
    left: 36,
    position: "absolute",
    top: 2,
    zIndex: 1
  },
  treasureLid: {
    backgroundColor: "#5f3516",
    borderColor: "#8c5528",
    borderWidth: 1,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    height: 16,
    justifyContent: "center",
    position: "absolute",
    top: 16,
    transform: [{ rotate: "-10deg" }],
    width: 56,
    zIndex: 3
  },
  treasureLidBand: {
    backgroundColor: "#f2c55f",
    height: 4,
    opacity: 0.9,
    width: "100%"
  },
  treasureBase: {
    alignItems: "center",
    backgroundColor: "#a36a34",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderColor: "#d89b4f",
    borderWidth: 1,
    height: 29,
    justifyContent: "center",
    position: "absolute",
    top: 34,
    width: 62,
    zIndex: 4
  },
  treasureBand: {
    backgroundColor: "#f2c55f",
    bottom: 0,
    height: "100%",
    left: 28,
    position: "absolute",
    width: 6
  },
  coinCardMonogram: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    minHeight: 18,
    opacity: 0.38
  },
  coinCardMonogramMedium: {
    minHeight: 18
  },
  coinWatermark: {
    opacity: 0.55
  },
  coinCardFooter: {
    alignItems: "center",
    gap: 4,
    marginTop: "auto",
    paddingBottom: 6,
    width: "100%"
  },
  coinCardFooterMedium: {
    gap: 4,
    paddingBottom: 6
  },
  freeOfferWrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    position: "relative",
    width: 116
  },
  adBubble: {
    alignItems: "center",
    backgroundColor: "#8f398a",
    borderRadius: 14,
    height: 24,
    justifyContent: "center",
    left: 2,
    position: "absolute",
    top: -2,
    width: 24,
    zIndex: 1
  },
  adBubbleText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900"
  },
  freePill: {
    backgroundColor: "#f137b0",
    borderBottomColor: "#a21f79",
    minWidth: 100
  },
  coinCardBadgeShell: {
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    right: -3,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 5,
    top: 62,
    transform: [{ rotate: "8deg" }],
    elevation: 4,
    zIndex: 3
  },
  coinCardBadgeFace: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.76)",
    borderWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.18)",
    borderBottomWidth: 2,
    borderRadius: 8,
    height: 29,
    justifyContent: "center",
    minWidth: 61,
    overflow: "hidden",
    paddingHorizontal: 5
  },
  coinCardBadgeFaceCompact: {
    height: 27,
    minWidth: 58,
    paddingHorizontal: 5
  },
  coinCardBadgeFaceMedium: {
    height: 29,
    minWidth: 61
  },
  coinCardBadgeShine: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 999,
    height: 11,
    left: 5,
    position: "absolute",
    right: 5,
    top: 3
  },
  coinCardBadgeCompact: {
    right: -4,
    top: 58
  },
  coinCardBadgeMedium: {
    right: -3,
    top: 62
  },
  popularBadge: {
    backgroundColor: "#ff8150"
  },
  bestValueBadge: {
    backgroundColor: "#a943ff"
  },
  coinCardBadgeText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 9.2,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.24)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1
  },
  coinCardBadgeTextCompact: {
    fontSize: 7.3,
    lineHeight: 8.5
  },
  coinCardBadgeTextMedium: {},
  boostersToggle: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomColor: "rgba(0,0,0,0.08)",
    borderBottomWidth: 2,
    borderColor: colors.surfaceMuted,
    borderWidth: 1,
    borderRadius: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 74,
    paddingHorizontal: 14,
    ...shadows.card
  },
  boostersToggleCompact: {
    borderRadius: 16,
    minHeight: 68,
    paddingHorizontal: 12
  },
  boostersToggleText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  boostersToggleTextCompact: {
    fontSize: 17
  },
  boostersToggleAction: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderBottomColor: colors.accentDark,
    borderBottomWidth: 2,
    borderRadius: 16,
    height: 46,
    justifyContent: "center",
    width: 86
  },
  boostersToggleActionCompact: {
    borderRadius: 14,
    height: 42,
    width: 74
  },
  boosterSections: {
    gap: 18
  },
  boosterPanel: {
    gap: 8,
    overflow: "visible",
    paddingHorizontal: 0,
    position: "relative"
  },
  boosterPanelHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    minHeight: 34,
    paddingHorizontal: 2
  },
  boosterPanelIcon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 32,
    justifyContent: "center",
    marginLeft: -1,
    width: 32
  },
  boosterPanelTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 18,
    textAlign: "left"
  },
  boosterInfoBadge: {
    alignItems: "center",
    backgroundColor: "#74c4ff",
    borderBottomColor: "#3e93d2",
    borderBottomWidth: 2,
    borderRadius: radii.pill,
    height: 24,
    justifyContent: "center",
    width: 24
  },
  boosterCardsRow: {
    alignItems: "stretch",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9
  },
  boosterCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomColor: "rgba(0,0,0,0.08)",
    borderBottomWidth: 3,
    borderColor: colors.surfaceMuted,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    minHeight: 182,
    overflow: "visible",
    paddingBottom: 10,
    paddingHorizontal: 10,
    paddingTop: 13,
    position: "relative",
    ...shadows.card
  },
  boosterCardTwoUp: {
    minWidth: 0,
    width: "48.8%"
  },
  boosterGetLabel: {
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 17,
    marginTop: 2,
    textAlign: "center"
  },
  boosterIconStage: {
    alignItems: "center",
    height: 84,
    justifyContent: "center",
    width: "100%"
  },
  boosterTripleIcons: {
    alignItems: "center",
    height: 82,
    justifyContent: "center",
    position: "relative",
    width: 98
  },
  boosterTripleIconSlot: {
    position: "absolute"
  },
  boosterTripleIconTop: {
    top: 0,
    zIndex: 3
  },
  boosterTripleIconLeft: {
    left: 5,
    top: 30,
    zIndex: 2
  },
  boosterTripleIconRight: {
    right: 5,
    top: 30,
    zIndex: 2
  },
  boosterValueBadge: {
    alignItems: "center",
    backgroundColor: "#ffe27a",
    borderBottomColor: "#d29a16",
    borderBottomWidth: 2,
    borderColor: "rgba(255,255,255,0.80)",
    borderRadius: 8,
    borderWidth: 1,
    height: 26,
    justifyContent: "center",
    overflow: "hidden",
    paddingHorizontal: 10,
    position: "absolute",
    right: -6,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    top: 51,
    transform: [{ rotate: "5deg" }],
    zIndex: 5
  },
  boosterValueBadgeShine: {
    backgroundColor: "rgba(255,255,255,0.35)",
    borderRadius: 999,
    height: 8,
    left: 4,
    position: "absolute",
    right: 4,
    top: 3
  },
  boosterValueBadgeText: {
    color: "#7a4a00",
    fontSize: 9.6,
    fontWeight: "900",
    lineHeight: 11,
    textAlign: "center",
    textShadowColor: "rgba(255,255,255,0.38)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1
  },
  boosterCostPill: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: colors.accent,
    borderBottomColor: colors.accentDark,
    borderBottomWidth: 2,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    marginTop: "auto",
    minHeight: 42,
    paddingHorizontal: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.11,
    shadowRadius: 5,
    elevation: 2
  },
  boosterCostText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  },
  coinCardPriceTextCompact: {
    fontSize: 15
  },
  coinCardPriceTextMedium: {
    fontSize: 15
  },
  adBanner: {
    minHeight: 74,
    width: "100%"
  },
  adBannerDock: {
    alignItems: "center",
    backgroundColor: colors.background,
    bottom: 0,
    left: 0,
    paddingHorizontal: spacing.xl,
    position: "absolute",
    right: 0,
    zIndex: 5
  },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(16, 18, 24, 0.58)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg
  },
  noAdsModalBackdrop: {
    backgroundColor: "rgba(16, 18, 24, 0.68)",
    overflow: "hidden",
    paddingHorizontal: 18,
    paddingVertical: 30
  },
  noAdsPurchaseCardShadow: {
    borderRadius: 36,
    maxWidth: 354,
    paddingBottom: 11,
    position: "relative",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.42,
    shadowRadius: 20,
    width: "100%",
    zIndex: 3
  },
  noAdsPurchaseCardDepth: {
    backgroundColor: "#c76b18",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    bottom: 0,
    height: 52,
    left: -1,
    position: "absolute",
    right: -1
  },
  noAdsPurchaseCard: {
    alignItems: "center",
    backgroundColor: "#73c9eb",
    borderColor: "#ffe077",
    borderRadius: 36,
    borderWidth: 10,
    gap: 8,
    minHeight: 520,
    overflow: "hidden",
    paddingBottom: 22,
    paddingHorizontal: 20,
    paddingTop: 46,
    position: "relative",
    zIndex: 1
  },
  noAdsPurchaseStripes: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.13,
    overflow: "hidden"
  },
  noAdsPurchaseStripe: {
    backgroundColor: "#ffffff",
    bottom: -150,
    position: "absolute",
    top: -150,
    transform: [{ rotate: "-32deg" }],
    width: 28
  },
  noAdsPurchaseClose: {
    alignItems: "center",
    backgroundColor: "#ffe077",
    borderBottomColor: "#d48b20",
    borderBottomWidth: 4,
    borderRadius: 14,
    height: 42,
    justifyContent: "center",
    position: "absolute",
    right: 12,
    top: 12,
    width: 42,
    zIndex: 4
  },
  noAdsPurchaseIconStage: {
    alignItems: "center",
    height: 184,
    justifyContent: "center",
    marginTop: -4,
    width: 184,
    zIndex: 2
  },
  noAdsPurchaseTitle: {
    color: "#ffe000",
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: -1,
    lineHeight: 44,
    marginTop: 3,
    textAlign: "center",
    textShadowColor: "#64527e",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 1,
    zIndex: 2
  },
  noAdsPurchaseSubtitle: {
    color: "#27637d",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
    lineHeight: 15,
    marginBottom: 14,
    textAlign: "center",
    zIndex: 2
  },
  noAdsPurchaseButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#54dc18",
    borderBottomColor: "#279d0d",
    borderBottomWidth: 8,
    borderRadius: radii.pill,
    justifyContent: "center",
    minHeight: 62,
    minWidth: 250,
    paddingHorizontal: spacing.lg,
    shadowColor: "#216b0d",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    zIndex: 2
  },
  noAdsPurchaseButtonPressed: {
    borderBottomWidth: 3,
    transform: [{ translateY: 5 }]
  },
  noAdsPurchasePrice: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "900",
    includeFontPadding: false,
    letterSpacing: 0.4,
    lineHeight: 40,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.16)",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 1
  },
  noAdsPurchaseNote: {
    backgroundColor: "rgba(21, 47, 64, 0.78)",
    borderRadius: radii.pill,
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
    lineHeight: 14,
    marginTop: 16,
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 8,
    textAlign: "center",
    zIndex: 2
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    gap: spacing.md,
    maxWidth: 420,
    padding: spacing.lg,
    width: "100%",
    ...shadows.tactile
  },
  modalTitle: {
    color: colors.text,
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: 0
  },
  checkoutModalCard: {
    borderColor: "rgba(31, 41, 55, 0.07)",
    borderRadius: 26,
    borderWidth: 1,
    gap: 14,
    maxWidth: 390,
    padding: 18,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 26
  },
  checkoutHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between"
  },
  checkoutHeaderCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  checkoutEyebrow: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  checkoutCloseButton: {
    alignItems: "center",
    backgroundColor: colors.backgroundAlt,
    borderColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  checkoutProduct: {
    alignItems: "center",
    backgroundColor: colors.backgroundAlt,
    borderColor: colors.surfaceMuted,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 76,
    padding: 12
  },
  checkoutProductIcon: {
    alignItems: "center",
    backgroundColor: colors.surfaceCool,
    borderRadius: 15,
    height: 48,
    justifyContent: "center",
    overflow: "hidden",
    width: 48
  },
  checkoutProductCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0
  },
  checkoutPriceWrap: {
    alignItems: "flex-end",
    gap: 2,
    maxWidth: 94,
    minWidth: 72
  },
  checkoutPriceLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  checkoutPrice: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "900",
    includeFontPadding: false,
    letterSpacing: 0,
    lineHeight: 19,
    maxWidth: "100%",
    textAlign: "right"
  },
  checkoutRewards: {
    borderColor: colors.surfaceMuted,
    borderRadius: 16,
    borderWidth: 1,
    gap: 2,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  checkoutRewardsTitle: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0,
    marginBottom: 3,
    textTransform: "uppercase"
  },
  checkoutRewardRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: 32
  },
  checkoutRewardLabel: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: "800"
  },
  checkoutRewardValue: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "900",
    includeFontPadding: false,
    letterSpacing: 0
  },
  checkoutConfirmButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderBottomColor: colors.accentDark,
    borderBottomWidth: 4,
    borderRadius: 17,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 14,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3
  },
  checkoutConfirmText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0
  },
  checkoutCancelButton: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: radii.pill,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: spacing.lg
  },
  checkoutCancelText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0
  },
  checkoutDisabled: {
    opacity: 0.55
  },
  successModalCard: {
    borderColor: "rgba(0,109,55,0.12)",
    borderWidth: 1,
    gap: 18,
    maxWidth: 390,
    overflow: "hidden",
    padding: 0
  },
  successHeader: {
    alignItems: "center",
    backgroundColor: "#f5fbf8",
    borderBottomColor: "#d8ebe0",
    borderBottomWidth: 1,
    gap: 7,
    paddingBottom: 20,
    paddingHorizontal: 22,
    paddingTop: 24
  },
  successSealOuter: {
    alignItems: "center",
    backgroundColor: "#dff5e8",
    borderColor: "#bfe8cf",
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 76,
    justifyContent: "center",
    marginBottom: 2,
    width: 76
  },
  successSealInner: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderBottomColor: colors.accentDark,
    borderBottomWidth: 3,
    borderRadius: radii.pill,
    height: 58,
    justifyContent: "center",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.16,
    shadowRadius: 9,
    width: 58,
    elevation: 4
  },
  successEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.9
  },
  successTitle: {
    color: colors.text,
    fontSize: 27,
    fontWeight: "900",
    lineHeight: 32,
    textAlign: "center"
  },
  successSubtitle: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
    maxWidth: 300,
    textAlign: "center"
  },
  successRewardsPanel: {
    backgroundColor: colors.backgroundAlt,
    borderColor: colors.surfaceMuted,
    borderRadius: 20,
    borderWidth: 1,
    gap: 9,
    marginHorizontal: 18,
    padding: 12
  },
  successRewardsHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 24,
    paddingHorizontal: 2
  },
  successRewardsTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900"
  },
  successRewardRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#dfe8e3",
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row",
    gap: 11,
    minHeight: 62,
    paddingHorizontal: 10
  },
  successRewardIcon: {
    alignItems: "center",
    height: 42,
    justifyContent: "center",
    width: 42
  },
  successRewardCopy: {
    flex: 1,
    minWidth: 0
  },
  successRewardLabel: {
    color: "#607064",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
    lineHeight: 13
  },
  successRewardValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 24
  },
  successDoneButton: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: colors.accent,
    borderBottomColor: colors.accentDark,
    borderBottomWidth: 3,
    borderRadius: 17,
    justifyContent: "center",
    marginBottom: 18,
    marginHorizontal: 18,
    minHeight: 54,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3
  },
  successDoneButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.9
  },
  checkoutName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    includeFontPadding: false,
    letterSpacing: 0,
    lineHeight: 19
  },
  checkoutText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15
  },
  pressed: {
    opacity: 0.9
  }
});
