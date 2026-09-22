import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import COLORS from '@/AUTH/styles/colors';
import FONTFAMILY from '@/AUTH/styles/fonts';
import CustomHeader from '@/CHAT/components/CustomHeader';

const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

export default function ContactUsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <CustomHeader title="Contact Us" onClick={() => router.back()} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="mail-outline" size={34} color={COLORS.brand.teal} />
          </View>
          <Text style={styles.title}>Get in touch</Text>
          <Text style={styles.sub}>
            Questions, feedback or security concerns? Reach out any time.
          </Text>
        </View>
        <View style={styles.card}>
          <Row label="Email" value="support@tkirda.app" />
          <View style={styles.hairline} />
          <Row label="App" value="Tkirda" />
          <View style={styles.hairline} />
          <Row label="Version" value="1.0.0" />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.brand.inputBack,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    gap: 20,
  },
  hero: {
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  heroIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.secondary.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...FONTFAMILY.MONTSERRAT.b.pt20,
    color: COLORS.brand.ink,
  },
  sub: {
    textAlign: 'center',
    color: COLORS.brand.sub,
    ...FONTFAMILY.MONTSERRAT.reg.pt14,
  },
  card: {
    backgroundColor: COLORS.secondary.white,
    borderRadius: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: COLORS.brand.inputBack,
  },
  hairline: {
    height: 1,
    backgroundColor: COLORS.brand.inputBack,
  },
  row: {
    paddingVertical: 14,
    gap: 2,
  },
  rowLabel: {
    ...FONTFAMILY.MONTSERRAT.sb.pt12,
    color: COLORS.brand.teal,
    textTransform: 'uppercase',
  },
  rowValue: {
    ...FONTFAMILY.MONTSERRAT.reg.pt16,
    color: COLORS.brand.ink,
  },
});