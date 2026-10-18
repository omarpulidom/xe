import "../global.css";
import { useFonts } from "@expo-google-fonts/montserrat";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as ScreenCapture from "expo-screen-capture";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppFonts } from "@/components/fonts/fonts";
import { AppProviders } from "@/components/Providers/AppProviders";
import { Linking, Platform, View } from "react-native";
import { useVault } from "@/components/Providers/VaultProvider";
import { queueImportPath, subscribeImportPath, takeImportPath } from "@/lib/vault/pendingImport";

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { isUnlocked } = useVault();
  useEffect(() => {
    if (!isUnlocked) return;
    const openPending = () => {
      const path = takeImportPath();
      if (path) router.push({ pathname: "/(tabs)/vault", params: { importPath: encodeURIComponent(path) } });
    };
    openPending();
    return subscribeImportPath(openPending);
  }, [isUnlocked]);
  return (
    <View className="flex-1 bg-primary">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
    </View>
  );
}

function extractImportPathFromUrl(rawUrl: string): string | null {
  let decodedUrl: string;
  try { decodedUrl = decodeURIComponent(rawUrl); } catch { return null; }

  const paramMatch = decodedUrl.match(/[?&](?:url|path|importPath)=([^&]+)/i);
  if (paramMatch?.[1]) {
    let candidate: string;
    try { candidate = decodeURIComponent(paramMatch[1]); } catch { return null; }
    if (/\.xe([?#].*)?$/i.test(candidate)) {
      return candidate;
    }
  }

  if (
    decodedUrl.startsWith("file://") &&
    /\.xe([?#].*)?$/i.test(decodedUrl)
  ) {
    return decodedUrl;
  }

  const embeddedMatch = decodedUrl.match(
    /file:\/\/[^\s]+?\.xe(?:[?#][^\s]*)?/i,
  );
  if (embeddedMatch?.[0]) {
    return embeddedMatch[0];
  }

  return null;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...AppFonts,
  });
  const lastHandledImport = useRef<string | null>(null);

  useEffect(() => {
    const protectAppPreview = Platform.OS === "ios"
      ? ScreenCapture.enableAppSwitcherProtectionAsync(1)
      : Platform.OS === "android"
        ? ScreenCapture.preventScreenCaptureAsync("xe-app-preview")
        : Promise.resolve();

    protectAppPreview.catch((error) => {
      console.error("[RootLayout] app preview protection error:", error);
    });
  }, []);

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  useEffect(() => {
    if (!loaded && !error) return;

    const openImportIfPresent = (url: string) => {
      const importPath = extractImportPathFromUrl(url);
      if (!importPath) return;

      if (lastHandledImport.current === importPath) {
        return;
      }

      lastHandledImport.current = importPath;
      queueImportPath(importPath);
    };

    Linking.getInitialURL()
      .then((url) => {
        if (url) openImportIfPresent(url);
      })
      .catch((err) => {
        console.error("[RootLayout] initial URL error:", err);
      });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      openImportIfPresent(url);
    });

    return () => {
      subscription.remove();
    };
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <GestureHandlerRootView
      style={{
        flex: 1,
      }}
    >
      <StatusBar style="light" />
      <AppProviders>
        <RootStack />
      </AppProviders>
    </GestureHandlerRootView>
  );
}
