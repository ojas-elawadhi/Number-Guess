import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

const keypadRows = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["clear", "0", "backspace"]
] as const;

interface GameKeyboardProps {
  disabled?: boolean;
  onAppendDigit: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
}

export function GameKeyboard({ disabled = false, onAppendDigit, onBackspace, onClear }: GameKeyboardProps) {
  const renderKey = (key: (typeof keypadRows)[number][number]) => {
    const label =
      key === "backspace" ? (
        <Ionicons color="#6b7075" name="backspace-outline" size={20} />
      ) : key === "clear" ? (
        <Ionicons color="#6b7075" name="close" size={20} />
      ) : (
        <Text style={styles.keyText}>{key}</Text>
      );

    const onPress =
      key === "backspace"
        ? onBackspace
        : key === "clear"
          ? onClear
          : () => onAppendDigit(key);

    return (
      <Pressable
        accessibilityLabel={key === "backspace" ? "Backspace" : key === "clear" ? "Clear" : `Number ${key}`}
        disabled={disabled}
        key={key}
        onPress={onPress}
        style={({ pressed }) => [styles.keyButton, pressed && !disabled && styles.keyButtonPressed, disabled && styles.keyButtonDisabled]}
      >
        {label}
      </Pressable>
    );
  };

  return (
    <View style={styles.keypadWrap}>
      {keypadRows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.keyRow}>
          {row.map(renderKey)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  keypadWrap: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    borderRadius: 18,
    borderWidth: 0,
    gap: 6,
    marginHorizontal: 6,
    paddingHorizontal: 0,
    paddingVertical: 0
  },
  keyRow: {
    flexDirection: "row",
    gap: 6
  },
  keyButton: {
    alignItems: "center",
    backgroundColor: "#eef0f1",
    borderBottomColor: "#d2d7d9",
    borderBottomWidth: 3,
    borderColor: "#e0e4e5",
    borderRadius: 9,
    borderWidth: 1,
    flex: 1,
    height: 44,
    justifyContent: "center"
  },
  keyButtonPressed: {
    backgroundColor: "#e2e6e7",
    borderBottomWidth: 1,
    transform: [{ translateY: 2 }]
  },
  keyButtonDisabled: {
    opacity: 0.55
  },
  keyText: {
    color: "#2d2f31",
    fontSize: 18,
    fontWeight: "900"
  }
});
