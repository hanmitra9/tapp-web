import { StyleSheet, View } from 'react-native';
import { color, font } from '@/theme/tokens';

// Phone tab bar: a floating glass pill (blur + hairline), same look as the website's navbar.
export const tabChrome = {
  tabBarActiveTintColor: '#7DA2FF',
  tabBarInactiveTintColor: color.textMuted,
  tabBarStyle: {
    position: 'absolute' as const, left: 12, right: 12, bottom: 12, height: 70, paddingTop: 8, paddingBottom: 10,
    borderRadius: 22, borderTopWidth: 0, elevation: 0, backgroundColor: 'transparent',
  },
  tabBarBackground: () => <View style={[StyleSheet.absoluteFill, { borderRadius: 22 }]} {...({ dataSet: { tapp: 'glass' } } as object)} />,
  tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 11, marginTop: 2 },
  tabBarActiveBackgroundColor: 'transparent',
};
