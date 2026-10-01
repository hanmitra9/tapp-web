import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { color, space, type } from '@/theme/tokens';
import { Button } from './Button';

// Full-area loading / error state with a retry action.
export function LoadState({ error, onRetry }: { error?: string | null; onRetry?: () => void }) {
  return (
    <View style={styles.wrap}>
      {error ? (
        <>
          <Text style={styles.text}>{error}</Text>
          {onRetry ? <Button variant="secondary" label="Coba lagi" onPress={onRetry} /> : null}
        </>
      ) : <ActivityIndicator color={color.blue} />}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },
  text: { ...type.body, color: color.textSecondary, textAlign: 'center' },
});
