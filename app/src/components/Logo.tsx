import { Image, StyleSheet } from 'react-native';

// The approved TAPP mark is the source of truth: drop the official export at assets/tapp-logo.png.
// Never recreate the mark in code.
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/tapp-logo.png')}
      style={[styles.img, { width: size, height: size }]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="TAPP"
    />
  );
}
const styles = StyleSheet.create({ img: {} });
