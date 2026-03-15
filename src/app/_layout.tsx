import "../global.css";
import { useFonts } from "@expo-google-fonts/montserrat";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppFonts } from "@/components/fonts/fonts";
import { AppProviders } from "@/components/Providers/AppProviders";
import { Linking, View } from "react-native";

SplashScreen.preventAutoHideAsync();

function RootStack() {
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
  const decodedUrl = decodeURIComponent(rawUrl);

  const paramMatch = decodedUrl.match(/[?&](?:url|path|importPath)=([^&]+)/i);
  if (paramMatch?.[1]) {
    const candidate = decodeURIComponent(paramMatch[1]);
    if (/\.calcx([?#].*)?$/i.test(candidate)) {
      return candidate;
    }
  }

  if (
    decodedUrl.startsWith("file://") &&
    /\.calcx([?#].*)?$/i.test(decodedUrl)
  ) {
    return decodedUrl;
  }

  const embeddedMatch = decodedUrl.match(
    /file:\/\/[^\s]+?\.calcx(?:[?#][^\s]*)?/i,
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
      router.push({
        pathname: "/(tabs)/vault",
        params: {
          importPath: encodeURIComponent(importPath),
        },
      });
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
