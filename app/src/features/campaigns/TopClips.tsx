import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { compact } from '@/lib/format';
import { useQuery } from '@/lib/useQuery';
import { platformLabel, type Platform } from '@/features/creator/options';
import { card, color, radius, space, type } from '@/theme/tokens';

// "Contoh klip terbaik" (0079): the 3 accepted clips with the most views in this campaign, to learn what works.
type TopClip = { rank: number; name: string; platform: Platform; post_url: string; views: number };
async function fetchTopClips(campaignId: string): Promise<TopClip[]> {
  const { data, error } = await supabase.rpc('campaign_top_clips', { p_campaign: campaignId });
  if (error) throw error;
  return ((data ?? []) as TopClip[]).map((x) => ({ ...x, rank: Number(x.rank), views: Number(x.views ?? 0) }));
}

export function TopClips({ campaignId, render }: { campaignId: string; render: (list: ReactNode) => ReactNode }) {
  const q = useQuery(() => fetchTopClips(campaignId), [campaignId]);
  if (!q.data?.length) return null;
  return render(
    <View style={{ gap: space.sm }}>
      <Text style={styles.hint}>Tonton dulu klip yang paling banyak views di campaign ini: hook, durasi, dan caption-nya.</Text>
      {q.data.map((k) => (
        <Pressable key={k.post_url} onPress={() => Linking.openURL(k.post_url).catch(() => {})} accessibilityRole="link"
          accessibilityLabel={`Klip nomor ${k.rank}, ${compact(k.views)} views di ${platformLabel(k.platform)}`}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}>
          <Text style={[styles.rank, k.rank === 1 && { color: '#F5C451' }]}>{k.rank}</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.name}>{k.name}</Text>
            <Text style={styles.cap}>{platformLabel(k.platform)} · {compact(k.views)} views</Text>
          </View>
          <View style={styles.play}><Feather name="play" size={13} color={color.text} /><Text style={styles.playText}>Tonton</Text></View>
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  hint: { ...type.caption, color: color.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, ...card },
  rank: { ...type.heading, width: 22, textAlign: 'center', color: color.textMuted, fontVariant: ['tabular-nums'] },
  name: { ...type.label, color: color.text },
  cap: { ...type.caption, color: color.textMuted, fontVariant: ['tabular-nums'] },
  play: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill,
    borderWidth: 1, borderColor: color.borderStrong },
  playText: { ...type.caption, color: color.text, fontWeight: '600' },
});
