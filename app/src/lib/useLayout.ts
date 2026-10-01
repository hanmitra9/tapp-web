import { useWindowDimensions } from 'react-native';

// Desktop gets a sidebar and wider content; phone browsers keep the mobile layout.
export const WIDE_BREAKPOINT = 900;
export function useLayout() {
  const { width } = useWindowDimensions();
  return { isWide: width >= WIDE_BREAKPOINT, width };
}
