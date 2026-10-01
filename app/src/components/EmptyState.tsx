import { StyleSheet, Text, View } from 'react-native';
import { color, space, type } from '@/theme/tokens';
import { Button } from './Button';

// Empty screens point to the next action.
export function EmptyState({ title, body, action }: { title: string; body?: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {action ? <Button variant="secondary" label={action.label} onPress={action.onPress} style={styles.btn} /> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { paddingVertical: space.xxxl, gap: space.sm },
  title: { ...type.heading, color: color.text },
  body: { ...type.body, color: color.textSecondary },
  btn: { marginTop: space.md, alignSelf: 'flex-start' },
});
