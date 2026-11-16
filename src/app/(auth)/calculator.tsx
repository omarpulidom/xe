import { useState, useCallback, useEffect, useRef } from "react";
import {
  Text,
  TouchableOpacity,
  View,
  Vibration,
  ActivityIndicator,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors } from "@/components/colors";
import { useVault } from "@/components/Providers/VaultProvider";

type SetupStep = "idle" | "enter_pin" | "confirm_pin";

const CALC_BUTTONS = [
  ["C", "±", "%", "÷"],
  ["7", "8", "9", "×"],
  ["4", "5", "6", "-"],
  ["1", "2", "3", "+"],
  ["0", ".", "="],
];

export default function CalculatorScreen() {
  const router = useRouter();
  const { isSetup, setup, unlock, isLockedOut, lockedUntil, failedAttempts, initializationError } = useVault();
  const [display, setDisplay] = useState("0");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupStep, setSetupStep] = useState<SetupStep>("idle");
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);

  // Shake animation for wrong PIN
  const shakeX = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const triggerShake = useCallback(() => {
    Vibration.vibrate(200);
    shakeX.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  }, [shakeX]);

  // Timer for lockout countdown
  const [lockCountdown, setLockCountdown] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isLockedOut && lockedUntil) {
      const tick = () => {
        setLockCountdown(Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000)));
      };
      tick();
      intervalRef.current = setInterval(tick, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
    setLockCountdown(0);
  }, [isLockedOut, lockedUntil]);

  const handleDigit = useCallback(
    (digit: string) => {
      setError(null);
      if (display === "0" || display === "Error") {
        setDisplay(digit);
      } else {
        setDisplay((prev) => prev + digit);
      }
    },
    [display],
  );

  const handleClear = useCallback(() => {
    setDisplay("0");
    setError(null);
    setStatusText(null);
    if (setupStep !== "idle") {
      setSetupStep("idle");
      setFirstPin(null);
    }
  }, [setupStep]);

  const handleDecimal = useCallback(() => {
    if (!display.includes(".")) {
      setDisplay((prev) => prev + ".");
    }
  }, [display]);

  const handleEquals = useCallback(async () => {
    const pinCandidate = display;

    // Minimum PIN length check
    if (pinCandidate.length < (isSetup ? 6 : 8)) {
      setError(isSetup ? "min 6 digits" : "min 8 digits");
      triggerShake();
      return;
    }

    if (isLockedOut) {
      setError("locked");
      triggerShake();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (!isSetup) {
        // ─── First-time setup flow ───
        if (setupStep === "idle" || setupStep === "enter_pin") {
          // Step 1: User enters PIN for the first time
          setFirstPin(pinCandidate);
          setSetupStep("confirm_pin");
          setDisplay("0");
          setStatusText("confirm pin");
          setIsLoading(false);
          return;
        }

        if (setupStep === "confirm_pin") {
          // Step 2: User confirms PIN
          if (pinCandidate !== firstPin) {
            setError("pins do not match");
            triggerShake();
            setSetupStep("idle");
            setFirstPin(null);
            setStatusText(null);
            setDisplay("0");
            setIsLoading(false);
            return;
          }

          // PINs match → create vault
          await setup(pinCandidate);
          router.replace("/");
          return;
        }
      } else {
        // ─── Normal unlock flow ───
        const success = await unlock(pinCandidate);

        if (success) {
          router.replace("/");
        } else {
          setError(`wrong pin (${failedAttempts + 1})`);
          triggerShake();
          setDisplay("0");
        }
      }
    } catch (err) {
      console.error("[Calculator] error:", err);
      setError(isSetup ? "could not unlock" : "set a device passcode and retry");
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  }, [
    display,
    isSetup,
    setupStep,
    firstPin,
    isLockedOut,
    failedAttempts,
    setup,
    unlock,
    router,
    triggerShake,
  ]);

  const handleOperator = useCallback(
    (op: string) => {
      // Operators make it look like a real calculator
      // but they don't do real math — just append to display
      // The PIN is whatever is on display when "=" is pressed
      switch (op) {
        case "÷":
        case "×":
        case "-":
        case "+":
          // In a real calculator this would set operator state
          // Here we just let the display accumulate digits
          break;
        case "%":
          break;
        case "±":
          if (display !== "0") {
            setDisplay((prev) =>
              prev.startsWith("-") ? prev.slice(1) : "-" + prev,
            );
          }
          break;
      }
    },
    [display],
  );

  const handleButtonPress = useCallback(
    (btn: string) => {
      switch (btn) {
        case "C":
          handleClear();
          break;
        case ".":
          handleDecimal();
          break;
        case "=":
          handleEquals();
          break;
        case "÷":
        case "×":
        case "-":
        case "+":
        case "%":
        case "±":
          handleOperator(btn);
          break;
        default:
          handleDigit(btn);
          break;
      }
    },
    [handleClear, handleDecimal, handleEquals, handleOperator, handleDigit],
  );

  const getButtonStyle = (btn: string) => {
    if (btn === "=") {
      return "bg-secondary-500";
    }
    if (["÷", "×", "-", "+"].includes(btn)) {
      return "bg-primary-400";
    }
    if (["C", "±", "%"].includes(btn)) {
      return "bg-primary-500";
    }
    return "bg-primary-600";
  };

  const getTextStyle = (btn: string) => {
    if (btn === "=") {
      return "text-primary font-geist-mono text-2xl";
    }
    if (["÷", "×", "-", "+"].includes(btn)) {
      return "text-secondary-400 font-fira-code text-2xl";
    }
    if (["C", "±", "%"].includes(btn)) {
      return "text-secondary-500 font-fira-code text-xl";
    }
    return "text-secondary font-geist-mono text-2xl";
  };

  return (
    <SafeAreaView className="flex-1 bg-primary px-6 pt-4">
      {/* Display */}
      <View className="flex-1 justify-end pb-6 px-2">
        {initializationError && <Text className="text-red-500 font-fira-code text-right mb-4">{initializationError}</Text>}
        {statusText && (
          <Animated.View entering={FadeIn.duration(200)}>
            <Text className="text-secondary-500 text-lg font-fira-code text-right mb-2">
              {"// "}
              {statusText}
            </Text>
          </Animated.View>
        )}
        <Animated.View style={animatedStyle}>
          <Text
            className="text-secondary text-6xl font-geist-mono text-right"
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {display}
          </Text>
        </Animated.View>
        {error && (
          <Animated.View
            entering={FadeInDown.duration(200)}
            exiting={FadeOut.duration(150)}
          >
            <Text className="text-red-500 text-lg font-fira-code text-right mt-2">
              {"> "}
              {error}
            </Text>
          </Animated.View>
        )}
        {isLockedOut && lockCountdown > 0 && (
          <Animated.View entering={FadeInDown.duration(200)}>
            <Text className="text-primary-100 text-lg font-fira-code text-right mt-1">
              retry in {lockCountdown}s
            </Text>
          </Animated.View>
        )}
      </View>

      {/*
      ⚠️ DEV RESET — remove before release
      <TouchableOpacity
        onPress={() =>
          Alert.alert("⚠️ DEV RESET", "Wipe ALL data? This cannot be undone.", [
            { text: "Cancel", style: "cancel" },
            {
              text: "RESET EVERYTHING",
              style: "destructive",
              onPress: async () => {
                await resetAllData();
              },
            },
          ])
        }
        className="mb-4 mx-8 h-12 rounded-2xl items-center justify-center bg-red-600"
      >
        <Text className="text-white font-fira-code-semibold text-lg">
          ⚠️ DEV RESET
        </Text>
      </TouchableOpacity>
      */}

      {/* Buttons Grid */}
      <View className="gap-3 pb-8">
        {CALC_BUTTONS.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} className="flex-row gap-3">
            {row.map((btn) => {
              const isZero = btn === "0";
              const isEquals = btn === "=";
              return (
                <TouchableOpacity
                  key={btn}
                  onPress={() => handleButtonPress(btn)}
                  disabled={isLoading || !!initializationError}
                  className={`
                    ${getButtonStyle(btn)}
                    ${isZero ? "flex-2" : "flex-1"}
                    ${isEquals ? "flex-1" : ""}
                    h-[72px] rounded-2xl items-center justify-center
                  `}
                  style={isZero ? { flex: 2 } : undefined}
                  activeOpacity={0.7}
                >
                  {isLoading && isEquals ? (
                    <ActivityIndicator color={Colors.primary.DEFAULT} />
                  ) : (
                    <Text className={getTextStyle(btn)}>{btn}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}
