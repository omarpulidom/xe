import {
  FiraCode_300Light,
  FiraCode_400Regular,
  FiraCode_500Medium,
  FiraCode_600SemiBold,
  FiraCode_700Bold,
} from "@expo-google-fonts/fira-code";

import {
  GeistMono_100Thin,
  GeistMono_200ExtraLight,
  GeistMono_300Light,
  GeistMono_400Regular,
  GeistMono_500Medium,
  GeistMono_600SemiBold,
  GeistMono_700Bold,
  GeistMono_800ExtraBold,
  GeistMono_900Black,
} from "@expo-google-fonts/geist-mono";

export const AppFonts = {
  FiraCode_300Light,
  FiraCode_400Regular,
  FiraCode_500Medium,
  FiraCode_600SemiBold,
  FiraCode_700Bold,

  GeistMono_100Thin,
  GeistMono_200ExtraLight,
  GeistMono_300Light,
  GeistMono_400Regular,
  GeistMono_500Medium,
  GeistMono_600SemiBold,
  GeistMono_700Bold,
  GeistMono_800ExtraBold,
  GeistMono_900Black,
} as const;

export type AppFontKeys = keyof typeof AppFonts;
