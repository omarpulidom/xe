import type { Config } from "tailwindcss";
import { Colors } from "./src/components/colors";
import { AppFontNames } from "./src/components/fonts/font-names";

const config: Config = {
  content: ["./src/app/**/*.{js,ts,tsx}", "./src/components/**/*.{js,ts,tsx}"],

  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: Colors,
      fontFamily: {
        "fira-code": [AppFontNames.FiraCode_400Regular],
        "fira-code-light": [AppFontNames.FiraCode_300Light],
        "fira-code-regular": [AppFontNames.FiraCode_400Regular],
        "fira-code-medium": [AppFontNames.FiraCode_500Medium],
        "fira-code-semibold": [AppFontNames.FiraCode_600SemiBold],
        "fira-code-bold": [AppFontNames.FiraCode_700Bold],

        "geist-mono": [AppFontNames.GeistMono_400Regular],
        "geist-mono-thin": [AppFontNames.GeistMono_100Thin],
        "geist-mono-extralight": [AppFontNames.GeistMono_200ExtraLight],
        "geist-mono-light": [AppFontNames.GeistMono_300Light],
        "geist-mono-regular": [AppFontNames.GeistMono_400Regular],
        "geist-mono-medium": [AppFontNames.GeistMono_500Medium],
        "geist-mono-semibold": [AppFontNames.GeistMono_600SemiBold],
        "geist-mono-bold": [AppFontNames.GeistMono_700Bold],
        "geist-mono-extrabold": [AppFontNames.GeistMono_800ExtraBold],
        "geist-mono-black": [AppFontNames.GeistMono_900Black],
      },
    },
  },

  plugins: [],
};

export default config;
