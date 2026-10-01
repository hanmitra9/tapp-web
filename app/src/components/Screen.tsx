import type React from 'react';
import type { ReactNode, RefObject } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLayout } from '@/lib/useLayout';
import { color, radius, space } from '@/theme/tokens';

type Props = {
  children: ReactNode; footer?: ReactNode; scroll?: boolean; scrollRef?: RefObject<ScrollView | null>;
  refreshControl?: React.ReactElement<any>; inTabs?: boolean;
  width?: 'narrow' | 'regular';   // max content width: forms 480, everything else 760
};

// Standard screen: content scrolls, the primary action stays pinned at the bottom.
// The column is centered with a max width so lines stay readable.
export function Screen({ children, footer, scroll = true, scrollRef, refreshControl, inTabs = false, width = 'regular' }: Props) {
  const { isWide } = useLayout();
  const column = [styles.column, { maxWidth: width === 'narrow' ? 480 : 760 }];
  const tabPad = inTabs && !isWide ? styles.tabsPad : null;

  // Desktop forms (login, onboarding, submit…): a centered card with the action inside it,
  // instead of a field list at the top and a button pinned to the bottom of a huge window.
  if (isWide && width === 'narrow') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView ref={scrollRef} refreshControl={refreshControl} style={styles.flex}
          contentContainerStyle={[styles.content, styles.centered]} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, column]}>
            {children}
            {footer ? <View style={styles.cardFooter}>{footer}</View> : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={inTabs ? ['top'] : ['top', 'bottom']}>
      <View style={styles.flex}>
        {scroll ? (
          <ScrollView ref={scrollRef} refreshControl={refreshControl} style={styles.flex}
            contentContainerStyle={[styles.content, isWide && styles.wideTop, tabPad, column]} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, styles.content, isWide && styles.wideTop, tabPad, column]}>{children}</View>
        )}
        {footer ? <View style={[styles.footer, column]}>{footer}</View> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  flex: { flex: 1 },
  content: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.xl, flexGrow: 1 },
  wideTop: { paddingTop: space.xxxl },
  column: { width: '100%', alignSelf: 'center' },
  centered: { justifyContent: 'center', paddingVertical: space.xxxl },
  card: { backgroundColor: color.panel, borderRadius: radius.xl, padding: space.xxl, borderWidth: 1, borderColor: color.border },
  cardFooter: { marginTop: space.xxl, gap: space.sm },
  tabsPad: { paddingBottom: 110 },   // clears the floating tab bar (phones only)
  footer: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.lg, gap: space.sm },
});
