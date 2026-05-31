import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { playSound } from "../services/soundEffects";
import { usePlayerProgressStore } from "../store/usePlayerProgressStore";
import { colors, radii, shadows, spacing } from "../utils/theme";
import { PrimaryButton } from "./PrimaryButton";

type IconName = ComponentProps<typeof Ionicons>["name"];

type StoreCurrency = "cash" | "coins" | "ad";

interface PurchaseDraft {
  id: string;
  title: string;
  description: string;
  priceLabel: string;
  currency: StoreCurrency;
  coinsReward?: number;
  extraGuessReward?: number;
  skipReward?: number;
  removesAds?: boolean;
}

interface CoinPackOffer extends PurchaseDraft {
  amountLabel: string;
  badge?: string;
  art: "small-stack" | "medium-stack" | "large-stack" | "bag" | "chest" | "treasure";
}

interface BoosterShopOffer {
  id: string;
  title: string;
  icon: IconName;
  accent: string;
  singleCost: number;
  tripleCost: number;
  rewardKind: "extra-guess" | "skip";
}

const featuredOffer: PurchaseDraft = {
  id: "wordy-offer",
  title: "WORDY OFFER",
  description: "Starter bundle for quick runs and skip saves.",
  priceLabel: "₹480.00",
  currency: "cash",
  coinsReward: 1000,
  extraGuessReward: 3,
  skipReward: 2
};

const noAdsOffer: PurchaseDraft = {
  id: "no-ads",
  title: "NO ADS",
  description: "Purchase removes banner and full-screen pop-up ads.",
  priceLabel: "₹990.00",
  currency: "cash",
  removesAds: true
};

const coinPackOffers: CoinPackOffer[] = [
  {
    id: "coins-50",
    title: "50",
    amountLabel: "50",
    description: "Free reward pack.",
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

function CoinToken({ size = 30, style }: { size?: number; style?: object }) {
  return (
    <View
      style={[
        styles.coinToken,
        {
          borderRadius: size / 2,
          height: size,
          width: size
        },
        style
      ]}
    >
      <View
        style={[
          styles.coinTokenInner,
          {
            borderRadius: (size - 10) / 2,
            height: size - 10,
            width: size - 10
          }
        ]}
      >
        <Ionicons color="#ffd85a" name="star" size={Math.max(10, Math.round(size * 0.42))} />
      </View>
    </View>
  );
}

function CoinWatermark({ size = 16 }: { size?: number }) {
  return (
    <View style={styles.coinWatermark}>
      <CoinToken size={size} />
    </View>
  );
}

function BoosterGlyph({ accent, icon, size = 52 }: { accent: string; icon: IconName; size?: number }) {
  return (
    <View
      style={[
        styles.boosterGlyph,
        {
          backgroundColor: accent,
          borderRadius: size / 2,
          height: size,
          width: size
        }
      ]}
    >
      <Ionicons color="#ffffff" name={icon} size={Math.round(size * 0.48)} />
    </View>
  );
}

function CoinArt({ variant }: { variant: CoinPackOffer["art"] }) {
  if (variant === "bag") {
    return (
      <View style={styles.bagArt}>
        <CoinToken size={18} style={styles.bagCoinTop} />
        <CoinToken size={16} style={styles.bagCoinFront} />
        <View style={styles.bagSack}>
          <View style={styles.bagTie} />
        </View>
      </View>
    );
  }

  if (variant === "chest") {
    return (
      <View style={styles.chestArt}>
        <View style={styles.chestLid} />
        <View style={styles.chestBase}>
          <Ionicons color="#f2c55f" name="star" size={12} />
        </View>
        <CoinToken size={16} style={styles.chestCoinA} />
        <CoinToken size={14} style={styles.chestCoinB} />
      </View>
    );
  }

  if (variant === "treasure") {
    return (
      <View style={styles.treasureArt}>
        <View style={styles.treasureLid} />
        <View style={styles.treasureBase}>
          <Ionicons color="#f2c55f" name="star" size={12} />
        </View>
        <CoinToken size={18} style={styles.treasureCoinA} />
        <CoinToken size={15} style={styles.treasureCoinB} />
        <CoinToken size={13} style={styles.treasureCoinC} />
      </View>
    );
  }

  const stackStyles =
    variant === "small-stack"
      ? [styles.stackCoinA, styles.stackCoinB, styles.stackCoinC]
      : variant === "medium-stack"
        ? [styles.stackCoinD, styles.stackCoinE, styles.stackCoinF, styles.stackCoinG, styles.stackCoinH]
        : [styles.stackCoinI, styles.stackCoinJ, styles.stackCoinK, styles.stackCoinL, styles.stackCoinM, styles.stackCoinN];

  return (
    <View style={styles.coinStackArt}>
      {stackStyles.map((positionStyle, index) => (
        <CoinToken key={`${variant}-${index}`} size={variant === "small-stack" ? 20 : 18} style={positionStyle} />
      ))}
    </View>
  );
}

function CoinPricePill({ label, style, textStyle }: { label: string; style?: object; textStyle?: object }) {
  return (
    <View style={[styles.shopPricePill, style]}>
      <Text style={[styles.shopPricePillText, textStyle]}>{label}</Text>
    </View>
  );
}

function ShopStatusStrip() {
  const { width } = useWindowDimensions();
  const isCompact = width <= 380;
  const isMediumPhone = width > 380 && width <= 410;
  const extraGuessPowerUps = usePlayerProgressStore((state) => state.profile.extraGuessPowerUps);
  const skipBoosters = usePlayerProgressStore((state) => state.profile.skipBoosters);
  const coins = usePlayerProgressStore((state) => state.profile.coins);

  return (
    <View style={styles.statusStrip}>
      <View style={[styles.statusPill, isCompact && styles.statusPillCompact, isMediumPhone && styles.statusPillMedium]}>
        <BoosterGlyph accent="#b55cff" icon="flash" size={isCompact ? 19 : isMediumPhone ? 20 : 22} />
        <Text style={[styles.statusPillValue, isCompact && styles.statusPillValueCompact, isMediumPhone && styles.statusPillValueMedium]}>{extraGuessPowerUps}</Text>
      </View>
      <View style={[styles.statusPill, isCompact && styles.statusPillCompact, isMediumPhone && styles.statusPillMedium]}>
        <BoosterGlyph accent="#6bbdff" icon="play-skip-forward" size={isCompact ? 19 : isMediumPhone ? 20 : 22} />
        <Text style={[styles.statusPillValue, isCompact && styles.statusPillValueCompact, isMediumPhone && styles.statusPillValueMedium]}>{skipBoosters}</Text>
      </View>
      <View style={[styles.statusCoinPill, isCompact && styles.statusCoinPillCompact, isMediumPhone && styles.statusCoinPillMedium]}>
        <Text numberOfLines={1} style={[styles.statusCoinValue, isCompact && styles.statusCoinValueCompact, isMediumPhone && styles.statusCoinValueMedium]}>
          {coins.toLocaleString("en-US")}
        </Text>
        <CoinToken size={isCompact ? 22 : isMediumPhone ? 23 : 25} />
      </View>
    </View>
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

  const actionLabel =
    purchase.currency === "cash"
      ? "COMPLETE DEMO PAYMENT"
      : purchase.currency === "ad"
        ? "CLAIM DEMO REWARD"
        : "BUY WITH COINS";

  return (
    <Modal animationType="fade" transparent visible>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Checkout</Text>
          <View style={styles.checkoutSummary}>
            <Text style={styles.checkoutName}>{purchase.title}</Text>
            <CoinPricePill label={purchase.priceLabel} />
            <Text style={styles.checkoutText}>{purchase.description}</Text>
            {purchase.coinsReward ? <Text style={styles.checkoutReward}>+{purchase.coinsReward} coins</Text> : null}
            {purchase.extraGuessReward ? (
              <Text style={styles.checkoutReward}>+{purchase.extraGuessReward} extra guess boosters</Text>
            ) : null}
            {purchase.skipReward ? <Text style={styles.checkoutReward}>+{purchase.skipReward} skip boosters</Text> : null}
            {purchase.removesAds ? (
              <Text style={styles.checkoutReward}>No-ads unlock is shown as a UI demo here.</Text>
            ) : null}
          </View>
          <PrimaryButton
            label={actionLabel}
            loading={busy}
            onPress={onConfirm}
            variant="success"
          />
          <PrimaryButton disabled={busy} label="CANCEL" onPress={onCancel} variant="secondary" />
        </View>
      </View>
    </Modal>
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

  const [showBoosters, setShowBoosters] = useState(false);
  const [purchaseDraft, setPurchaseDraft] = useState<PurchaseDraft | null>(null);
  const [processingPurchase, setProcessingPurchase] = useState(false);

  const openPurchase = (draft: PurchaseDraft) => {
    playSound("modalOpen");
    setPurchaseDraft(draft);
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

      if (purchaseDraft.coinsReward) {
        await awardCoins(purchaseDraft.coinsReward);
      }

      if (purchaseDraft.extraGuessReward) {
        await awardExtraGuessPowerUps(purchaseDraft.extraGuessReward);
      }

      if (purchaseDraft.skipReward) {
        await awardSkipBoosters(purchaseDraft.skipReward);
      }

      const purchasedTitle = purchaseDraft.title;
      const wasNoAds = purchaseDraft.removesAds;

      setPurchaseDraft(null);
      playSound("purchaseSuccess");
      Alert.alert(
        wasNoAds ? "Demo purchase complete" : "Purchase complete",
        wasNoAds
          ? "The no-ads unlock is presented as a UI demo. Hook your billing receipt flow here when ready."
          : `${purchasedTitle} was added to your profile.`
      );
    } catch (error) {
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

      <ScrollView contentContainerStyle={[styles.shopScrollContent, isMediumPhone && styles.shopScrollContentMedium]} showsVerticalScrollIndicator={false}>
        <View style={[styles.featuredCard, isCompact ? styles.featuredCardCompact : isMediumPhone ? styles.featuredCardMedium : isLargePhone ? styles.featuredCardLarge : null]}>
          <View style={styles.featuredGlow} />
          <View style={[styles.featuredReferenceLayout, isCompact && styles.featuredReferenceLayoutCompact]}>
            <View style={styles.featuredReferenceLeft}>
              <View style={[styles.featuredCoinRow, isCompact && styles.featuredCoinRowCompact]}>
                <CoinToken size={isCompact ? 34 : 38} />
                <Text style={[styles.featuredCoinValue, isCompact && styles.featuredCoinValueCompact]}>
                  {featuredOffer.coinsReward}
                </Text>
              </View>

              <View style={[styles.featuredRewardPair, isCompact && styles.featuredRewardPairCompact]}>
                <View style={[styles.featuredMiniCard, styles.featuredMiniCardHorizontal, isCompact && styles.featuredMiniCardCompact]}>
                  <BoosterGlyph accent="#b55cff" icon="flash" size={isCompact ? 30 : 34} />
                  <Text style={[styles.featuredMiniValue, isCompact && styles.featuredMiniValueCompact]}>3</Text>
                </View>
                <View style={[styles.featuredMiniCard, styles.featuredMiniCardHorizontal, isCompact && styles.featuredMiniCardCompact]}>
                  <BoosterGlyph accent="#6bbdff" icon="play-skip-forward" size={isCompact ? 30 : 34} />
                  <Text style={[styles.featuredMiniValue, isCompact && styles.featuredMiniValueCompact]}>2</Text>
                </View>
              </View>
            </View>

            <View style={[styles.featuredReferenceRight, isCompact && styles.featuredReferenceRightCompact]}>
              <View style={[styles.featuredIllustration, isCompact && styles.featuredIllustrationCompact, styles.featuredReferenceArt]}>
                <CoinToken size={isCompact ? 18 : 20} style={styles.featuredCoinA} />
                <CoinToken size={isCompact ? 16 : 18} style={styles.featuredCoinB} />
                <CoinToken size={isCompact ? 14 : 16} style={styles.featuredCoinC} />
                <View style={styles.featuredBundleOrbLeft}>
                  <BoosterGlyph accent="#b55cff" icon="flash" size={isCompact ? 26 : 30} />
                </View>
                <View style={styles.featuredBundleOrbRight}>
                  <BoosterGlyph accent="#6bbdff" icon="play-skip-forward" size={isCompact ? 26 : 30} />
                </View>
                <View style={styles.featuredCoinCluster}>
                  <CoinToken size={isCompact ? 18 : 20} style={styles.featuredClusterCoinA} />
                  <CoinToken size={isCompact ? 18 : 20} style={styles.featuredClusterCoinB} />
                  <CoinToken size={isCompact ? 18 : 20} style={styles.featuredClusterCoinC} />
                  <CoinToken size={isCompact ? 18 : 20} style={styles.featuredClusterCoinD} />
                </View>
              </View>
              <Pressable
                onPress={() => openPurchase(featuredOffer)}
                style={({ pressed }) => [styles.featuredPriceButton, isCompact && styles.featuredPriceButtonCompact, styles.featuredReferencePriceButton, pressed && styles.pressed]}
              >
                <Text style={[styles.featuredPriceButtonText, isCompact && styles.featuredPriceButtonTextCompact]}>
                  {featuredOffer.priceLabel}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        <Pressable
          onPress={() => openPurchase(noAdsOffer)}
          style={({ pressed }) => [styles.noAdsCard, isCompact && styles.noAdsCardCompact, isMediumPhone && styles.noAdsCardMedium, pressed && styles.pressed]}
        >
          <View style={[styles.noAdsIcon, isCompact && styles.noAdsIconCompact]}>
            <Text style={[styles.noAdsIconText, isCompact && styles.noAdsIconTextCompact]}>AD</Text>
          </View>
          <Text style={[styles.noAdsTitle, isCompact && styles.noAdsTitleCompact, isMediumPhone && styles.noAdsTitleMedium]}>{noAdsOffer.title}</Text>
          <CoinPricePill
            label={noAdsOffer.priceLabel}
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
              <View style={[styles.coinCardMonogram, isMediumPhone && styles.coinCardMonogramMedium]}>
                <CoinWatermark size={16} />
              </View>
              {offer.badge ? (
                <View
                  style={[
                    styles.coinCardBadge,
                    isMediumPhone && styles.coinCardBadgeMedium,
                    offer.badge.includes("Best") ? styles.bestValueBadge : styles.popularBadge
                  ]}
                >
                  <Text style={[styles.coinCardBadgeText, isMediumPhone && styles.coinCardBadgeTextMedium]}>{offer.badge}</Text>
                </View>
              ) : null}
              <View style={[styles.coinCardFooter, isMediumPhone && styles.coinCardFooterMedium]}>
                {offer.currency === "ad" ? <View style={styles.adBubble}><Text style={styles.adBubbleText}>AD</Text></View> : null}
                <CoinPricePill
                  label={offer.priceLabel}
                  style={offer.currency === "ad" ? styles.freePill : undefined}
                  textStyle={
                    isCompact
                      ? styles.coinCardPriceTextCompact
                      : isMediumPhone
                        ? styles.coinCardPriceTextMedium
                        : undefined
                  }
                />
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
                <View style={styles.boosterInfoBadge}>
                  <Ionicons color="#ffffff" name="information" size={18} />
                </View>
                <Text style={styles.boosterPanelTitle}>{offer.title}</Text>

                <View style={styles.boosterCardsRow}>
                  <Pressable
                    onPress={() => handleBoosterPurchase(offer, 1)}
                    style={({ pressed }) => [
                      styles.boosterCard,
                      styles.boosterCardTwoUp,
                      pressed && styles.pressed
                    ]}
                  >
                    <Text style={styles.boosterGetLabel}>GET 1</Text>
                    <BoosterGlyph accent={offer.accent} icon={offer.icon} size={64} />
                    <View style={styles.boosterCostPill}>
                      <CoinToken size={24} />
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
                    <Text style={styles.boosterGetLabel}>GET 3</Text>
                    <View style={styles.boosterTripleIcons}>
                      <View style={[styles.boosterTripleIconSlot, styles.boosterTripleIconTop]}>
                        <BoosterGlyph accent={offer.accent} icon={offer.icon} size={36} />
                      </View>
                      <View style={[styles.boosterTripleIconSlot, styles.boosterTripleIconLeft]}>
                        <BoosterGlyph accent={offer.accent} icon={offer.icon} size={36} />
                      </View>
                      <View style={[styles.boosterTripleIconSlot, styles.boosterTripleIconRight]}>
                        <BoosterGlyph accent={offer.accent} icon={offer.icon} size={36} />
                      </View>
                    </View>
                    <View style={styles.boosterRibbon}>
                      <Text style={styles.boosterRibbonText}>Best Value!</Text>
                    </View>
                    <View style={styles.boosterCostPill}>
                      <CoinToken size={24} />
                      <Text style={styles.boosterCostText}>{offer.tripleCost}</Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.adBanner}>
          <Text style={styles.adBannerText}>Sponsored banner placeholder</Text>
        </View>
      </ScrollView>

      <CheckoutModal
        busy={processingPurchase}
        onCancel={() => setPurchaseDraft(null)}
        onConfirm={() => void handleConfirmPurchase()}
        purchase={purchaseDraft}
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
  shopScrollContentMedium: {
    gap: 8,
    paddingBottom: 12
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
    gap: 8
  },
  statusPill: {
    alignSelf: "center",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.surfaceMuted,
    borderWidth: 1,
    borderRadius: radii.pill,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    height: 40,
    paddingHorizontal: 10
  },
  statusPillCompact: {
    height: 36,
    paddingHorizontal: 8
  },
  statusPillMedium: {
    height: 38,
    paddingHorizontal: 9
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
    gap: 6,
    justifyContent: "center",
    height: 40,
    minWidth: 98,
    paddingHorizontal: 10
  },
  statusCoinPillCompact: {
    height: 36,
    minWidth: 88,
    paddingHorizontal: 8
  },
  statusCoinPillMedium: {
    height: 38,
    minWidth: 94,
    paddingHorizontal: 9
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
  coinToken: {
    alignItems: "center",
    backgroundColor: "#ffcc43",
    borderColor: "#f0a000",
    borderWidth: 1.5,
    borderBottomWidth: 2.5,
    justifyContent: "center"
  },
  coinTokenInner: {
    alignItems: "center",
    backgroundColor: "#ffb91f",
    justifyContent: "center"
  },
  coinTokenText: {
    color: "#fff7d5",
    fontWeight: "900"
  },
  boosterGlyph: {
    alignItems: "center",
    borderBottomColor: "rgba(0,0,0,0.16)",
    borderBottomWidth: 3,
    justifyContent: "center",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 5,
    elevation: 2
  },
  featuredCard: {
    backgroundColor: colors.surfaceCool,
    borderBottomColor: "rgba(92,184,253,0.18)",
    borderBottomWidth: 2,
    borderColor: "#bfdfff",
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    padding: 12,
    position: "relative",
    ...shadows.card
  },
  featuredCardCompact: {
    borderRadius: 18,
    padding: 10
  },
  featuredCardMedium: {
    borderRadius: 18,
    padding: 10
  },
  featuredCardLarge: {
    padding: 10
  },
  featuredGlow: {
    backgroundColor: "rgba(92,184,253,0.08)",
    borderRadius: 180,
    height: 180,
    position: "absolute",
    right: -42,
    top: -26,
    width: 180
  },
  featuredTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900",
    marginBottom: 8,
    textAlign: "center"
  },
  featuredTitleCompact: {
    fontSize: 17,
    lineHeight: 20,
    marginBottom: 6
  },
  featuredTitleMedium: {
    fontSize: 18,
    lineHeight: 22,
    marginBottom: 6
  },
  featuredReferenceLayout: {
    flexDirection: "row",
    gap: 10
  },
  featuredReferenceLayoutCompact: {
    gap: 8
  },
  featuredReferenceLeft: {
    flex: 1,
    gap: 8
  },
  featuredReferenceRight: {
    gap: 8,
    justifyContent: "space-between",
    width: "40%"
  },
  featuredReferenceRightCompact: {
    width: "42%"
  },
  featuredCoinRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.surfaceMuted,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 56,
    paddingHorizontal: 10
  },
  featuredCoinRowCompact: {
    alignSelf: "flex-start",
    borderRadius: 14,
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 10,
    paddingRight: 12
  },
  featuredCoinRowMedium: {
    flex: 1,
    minHeight: 54,
    paddingHorizontal: 9
  },
  featuredCoinValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900"
  },
  featuredCoinValueCompact: {
    fontSize: 20
  },
  featuredCoinValueMedium: {
    fontSize: 21
  },
  featuredBoostersGrid: {
    flexDirection: "row",
    gap: spacing.sm
  },
  featuredRewardPair: {
    flexDirection: "row",
    gap: 8
  },
  featuredRewardPairCompact: {
    gap: 6
  },
  featuredBoostersGridCompact: {
    gap: 8
  },
  featuredMiniCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.surfaceMuted,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    minHeight: 64,
    justifyContent: "center",
    padding: 6
  },
  featuredMiniCardHorizontal: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-start",
    paddingHorizontal: 10
  },
  featuredMiniCardCompact: {
    minHeight: 58,
    padding: 5
  },
  featuredMiniValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  featuredMiniValueCompact: {
    fontSize: 17
  },
  featuredIllustration: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.surfaceMuted,
    borderRadius: 14,
    borderWidth: 1,
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 88,
    overflow: "hidden",
    padding: 6,
    width: "100%"
  },
  featuredIllustrationCompact: {
    minHeight: 80
  },
  featuredReferenceArt: {
    minHeight: 132
  },
  featuredCoinA: {
    left: 12,
    position: "absolute",
    top: 58
  },
  featuredCoinB: {
    position: "absolute",
    right: 18,
    top: 60
  },
  featuredCoinC: {
    bottom: 22,
    position: "absolute",
    right: 38
  },
  featuredBundleOrbLeft: {
    left: 18,
    position: "absolute",
    top: 18
  },
  featuredBundleOrbRight: {
    position: "absolute",
    right: 18,
    top: 56
  },
  featuredCoinCluster: {
    alignItems: "center",
    height: 46,
    justifyContent: "center",
    position: "absolute",
    right: 28,
    top: 32,
    width: 64
  },
  featuredClusterCoinA: {
    left: 4,
    position: "absolute",
    top: 22
  },
  featuredClusterCoinB: {
    left: 20,
    position: "absolute",
    top: 10
  },
  featuredClusterCoinC: {
    position: "absolute",
    right: 16,
    top: 20
  },
  featuredClusterCoinD: {
    position: "absolute",
    right: 0,
    top: 30
  },
  featuredPriceButton: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: colors.accent,
    borderBottomColor: colors.accentDark,
    borderBottomWidth: 2,
    borderRadius: 14,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 10
  },
  featuredPriceButtonCompact: {
    minHeight: 38
  },
  featuredReferencePriceButton: {
    minHeight: 48
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
  noAdsIcon: {
    alignItems: "center",
    backgroundColor: colors.ai,
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    position: "relative",
    width: 32
  },
  noAdsIconCompact: {
    height: 30,
    width: 30
  },
  noAdsIconText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  noAdsIconTextCompact: {
    fontSize: 15
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
    minWidth: 96,
    paddingHorizontal: 12
  },
  shopPricePillText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  },
  shopPricePillTextCompact: {
    fontSize: 14
  },
  shopPricePillTextMedium: {
    fontSize: 14
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
    overflow: "hidden",
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
  coinStackArt: {
    height: 42,
    position: "relative",
    width: 62
  },
  stackCoinA: {
    left: 10,
    position: "absolute",
    top: 26
  },
  stackCoinB: {
    left: 34,
    position: "absolute",
    top: 18
  },
  stackCoinC: {
    left: 24,
    position: "absolute",
    top: 42
  },
  stackCoinD: {
    left: 12,
    position: "absolute",
    top: 40
  },
  stackCoinE: {
    left: 26,
    position: "absolute",
    top: 28
  },
  stackCoinF: {
    left: 46,
    position: "absolute",
    top: 35
  },
  stackCoinG: {
    left: 58,
    position: "absolute",
    top: 22
  },
  stackCoinH: {
    left: 34,
    position: "absolute",
    top: 10
  },
  stackCoinI: {
    left: 12,
    position: "absolute",
    top: 44
  },
  stackCoinJ: {
    left: 30,
    position: "absolute",
    top: 34
  },
  stackCoinK: {
    left: 48,
    position: "absolute",
    top: 42
  },
  stackCoinL: {
    left: 58,
    position: "absolute",
    top: 26
  },
  stackCoinM: {
    left: 22,
    position: "absolute",
    top: 18
  },
  stackCoinN: {
    left: 42,
    position: "absolute",
    top: 10
  },
  bagArt: {
    alignItems: "center",
    height: 42,
    justifyContent: "flex-end",
    position: "relative",
    width: 62
  },
  bagSack: {
    backgroundColor: "#d7b084",
    borderRadius: 22,
    height: 32,
    width: 28
  },
  bagTie: {
    alignSelf: "center",
    backgroundColor: "#b17d47",
    borderRadius: 8,
    height: 8,
    marginTop: 6,
    width: 18
  },
  bagCoinTop: {
    left: 24,
    position: "absolute",
    top: 6
  },
  bagCoinFront: {
    left: 14,
    position: "absolute",
    top: 36
  },
  chestArt: {
    alignItems: "center",
    height: 42,
    justifyContent: "center",
    position: "relative",
    width: 62
  },
  chestLid: {
    backgroundColor: "#5a3414",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    height: 12,
    marginBottom: -2,
    width: 34
  },
  chestBase: {
    alignItems: "center",
    backgroundColor: "#9b662f",
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderColor: "#f2c55f",
    borderWidth: 2,
    height: 22,
    justifyContent: "center",
    width: 38
  },
  chestLetter: {
    color: "#f2c55f",
    fontSize: 14,
    fontWeight: "900"
  },
  chestCoinA: {
    bottom: 6,
    position: "absolute",
    right: 14
  },
  chestCoinB: {
    bottom: 0,
    left: 18,
    position: "absolute"
  },
  treasureArt: {
    alignItems: "center",
    height: 42,
    justifyContent: "center",
    position: "relative",
    width: 62
  },
  treasureLid: {
    backgroundColor: "#6d3d18",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    height: 10,
    transform: [{ rotate: "-12deg" }, { translateY: -3 }],
    width: 36
  },
  treasureBase: {
    alignItems: "center",
    backgroundColor: "#99683b",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderColor: "#d8edf7",
    borderWidth: 2,
    height: 22,
    justifyContent: "center",
    width: 38
  },
  treasureCoinA: {
    bottom: 2,
    left: 14,
    position: "absolute"
  },
  treasureCoinB: {
    bottom: 6,
    position: "absolute",
    right: 14
  },
  treasureCoinC: {
    position: "absolute",
    right: 4,
    top: 36
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
  adBubble: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#8f398a",
    borderRadius: 14,
    height: 24,
    justifyContent: "center",
    marginLeft: 4,
    marginBottom: -8,
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
    borderBottomColor: "#a21f79"
  },
  coinCardBadge: {
    alignItems: "center",
    borderRadius: 14,
    justifyContent: "center",
    minHeight: 34,
    minWidth: 34,
    paddingHorizontal: 6,
    position: "absolute",
    right: 6,
    top: 38,
    transform: [{ rotate: "16deg" }]
  },
  coinCardBadgeMedium: {
    minHeight: 34,
    minWidth: 34,
    right: 8,
    top: 38
  },
  popularBadge: {
    backgroundColor: "#ff9150"
  },
  bestValueBadge: {
    backgroundColor: "#b23cff"
  },
  coinCardBadgeText: {
    color: "#ffffff",
    fontSize: 7,
    fontWeight: "900",
    textAlign: "center"
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
    gap: 12
  },
  boosterPanel: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.surfaceMuted,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 10,
    position: "relative"
  },
  boosterInfoBadge: {
    alignItems: "center",
    backgroundColor: "#72c2ff",
    borderRadius: 13,
    height: 26,
    justifyContent: "center",
    left: 10,
    position: "absolute",
    top: 10,
    width: 26
  },
  boosterPanelTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    paddingHorizontal: 24,
    textAlign: "center"
  },
  boosterCardsRow: {
    alignItems: "stretch",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  boosterCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomColor: "rgba(0,0,0,0.08)",
    borderBottomWidth: 2,
    borderColor: colors.surfaceMuted,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minHeight: 168,
    padding: 10,
    ...shadows.card
  },
  boosterCardTwoUp: {
    minWidth: 0,
    width: "48.8%"
  },
  boosterGetLabel: {
    color: colors.warning,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 18
  },
  boosterTripleIcons: {
    alignItems: "center",
    height: 56,
    justifyContent: "center",
    position: "relative",
    width: 72
  },
  boosterTripleIconSlot: {
    position: "absolute"
  },
  boosterTripleIconTop: {
    top: 0
  },
  boosterTripleIconLeft: {
    left: 4,
    top: 20
  },
  boosterTripleIconRight: {
    right: 4,
    top: 20
  },
  boosterRibbon: {
    alignItems: "center",
    backgroundColor: "#e5565f",
    borderRadius: 8,
    marginTop: 0,
    minHeight: 28,
    justifyContent: "center",
    paddingHorizontal: 8,
    width: "100%"
  },
  boosterRibbonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center"
  },
  boosterCostPill: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: colors.accent,
    borderBottomColor: colors.accentDark,
    borderBottomWidth: 2,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: "auto",
    minHeight: 40,
    paddingHorizontal: 8
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
    alignItems: "center",
    backgroundColor: "#efeff4",
    borderRadius: 8,
    height: 74,
    justifyContent: "center",
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm
  },
  adBannerText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "800"
  },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(22, 23, 31, 0.45)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg
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
    fontSize: 26,
    fontWeight: "900"
  },
  checkoutSummary: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: radii.lg,
    gap: spacing.xs,
    padding: spacing.md
  },
  checkoutName: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "900"
  },
  checkoutText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20
  },
  checkoutReward: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800"
  },
  pressed: {
    opacity: 0.9
  }
});
