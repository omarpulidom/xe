import type { AppFontKeys } from "./fonts";

export const AppFontNames = {
  FiraCode_300Light: "FiraCode_300Light",
  FiraCode_400Regular: "FiraCode_400Regular",
  FiraCode_500Medium: "FiraCode_500Medium",
  FiraCode_600SemiBold: "FiraCode_600SemiBold",
  FiraCode_700Bold: "FiraCode_700Bold",

  GeistMono_100Thin: "GeistMono_100Thin",
  GeistMono_200ExtraLight: "GeistMono_200ExtraLight",
  GeistMono_300Light: "GeistMono_300Light",
  GeistMono_400Regular: "GeistMono_400Regular",
  GeistMono_500Medium: "GeistMono_500Medium",
  GeistMono_600SemiBold: "GeistMono_600SemiBold",
  GeistMono_700Bold: "GeistMono_700Bold",
  GeistMono_800ExtraBold: "GeistMono_800ExtraBold",
  GeistMono_900Black: "GeistMono_900Black",
} as const satisfies {
  [key in AppFontKeys]: AppFontKeys;
};
