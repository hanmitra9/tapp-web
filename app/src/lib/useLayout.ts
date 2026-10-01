import { Platform, useWindowDimensions } from 'react-native';

// Desktop web gets a sidebar and wider content; phones (native or mobile browsers) keep the app layout.
export const WIDE_BREAKPOINT = 900;
export function useLayout() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  return { isWeb, isWide: isWeb && width >= WIDE_BREAKPOINT, width };
}
