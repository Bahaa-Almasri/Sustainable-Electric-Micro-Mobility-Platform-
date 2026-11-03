/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#FF4B41';
const tintColorDark = '#FF5A4F';

/** App-wide loading spinners (tabs, splash screens, pull-to-refresh tint). */
export const LoaderAccent = '#FF4B41';

export const Colors = {
  light: {
    text: '#121212',
    background: '#F1EFEA',
    tint: tintColorLight,
    icon: '#5E5B55',
    tabIconDefault: '#5E5B55',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#F1EFEA',
    background: '#121211',
    tint: tintColorDark,
    icon: '#A39F97',
    tabIconDefault: '#A39F97',
    tabIconSelected: tintColorDark,
  },
};

/** Wayfinder design tokens. See docs/design/FINAL_DESIGN.md, section 2.1. */
export const Palette = {
  light: {
    bg: '#F1EFEA',
    surface: '#FAF9F6',
    text: '#121212',
    muted: '#5E5B55',
    line: '#D9D5CC',
    accent: '#FF4B41',
    accentText: '#B8291F',
    onAccent: '#121212',
    inverse: '#121212',
    inverseText: '#F1EFEA',
    inverseMuted: '#A39F97',
    success: '#2F6B3A',
    inverseSuccess: '#7FD6A0',
    warning: '#8A5A00',
    accentSoft: '#FFE1DC',
    photoTile: '#FFE1DC',
    tile: '#E7E4DD',
    skeleton: '#E2DFD8',
    backdrop: 'rgba(18,18,17,0.5)',
    halo: 'rgba(255,75,65,0.22)',
  },
  dark: {
    bg: '#121211',
    surface: '#1C1B19',
    text: '#F1EFEA',
    muted: '#A39F97',
    line: '#2E2C29',
    accent: '#FF5A4F',
    accentText: '#FF7A70',
    onAccent: '#121212',
    inverse: '#F1EFEA',
    inverseText: '#121211',
    inverseMuted: '#5E5B55',
    success: '#7FD6A0',
    inverseSuccess: '#2F6B3A',
    warning: '#F2C26B',
    accentSoft: '#3A1C19',
    photoTile: '#E9E5DC',
    tile: '#2A2926',
    skeleton: '#2A2926',
    backdrop: 'rgba(0,0,0,0.6)',
    halo: 'rgba(255,90,79,0.25)',
  },
} as const;

export type PaletteTokens = { [K in keyof typeof Palette.light]: string };

/** Loaded in `app/_layout.tsx`. Use `fontFamily` only: custom fonts ignore `fontWeight` on Android. */
export const FontFamily = {
  display: 'BricolageGrotesque_800ExtraBold',
  regular: 'InstrumentSans_400Regular',
  medium: 'InstrumentSans_500Medium',
  semibold: 'InstrumentSans_600SemiBold',
  bold: 'InstrumentSans_700Bold',
} as const;

export const Type = {
  pageTitle: { fontFamily: FontFamily.display, fontSize: 42, lineHeight: 44, letterSpacing: -1.8 },
  detailTitle: { fontFamily: FontFamily.display, fontSize: 32, lineHeight: 34, letterSpacing: -1.2 },
  sectionTitle: { fontFamily: FontFamily.display, fontSize: 22, lineHeight: 26, letterSpacing: -0.6 },
  stat: { fontFamily: FontFamily.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.6 },
  label: { fontFamily: FontFamily.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 1.3 },
  body: { fontFamily: FontFamily.bold, fontSize: 15, lineHeight: 20 },
  secondary: { fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18 },
  input: { fontFamily: FontFamily.medium, fontSize: 17 },
  button: { fontFamily: FontFamily.bold, fontSize: 16 },
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
