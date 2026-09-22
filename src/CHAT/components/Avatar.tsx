import {StyleSheet, Text, View} from 'react-native';
import type {StyleProp, ViewStyle} from 'react-native';

import COLORS from '../../AUTH/styles/colors';
import FONTFAMILY from '../../AUTH/styles/fonts';

const pick = (name: string): string => {
  let n = 0;
  for (const ch of name) n = (n + ch.charCodeAt(0)) % 997;
  return COLORS.brand.avatar[n % COLORS.brand.avatar.length];
};

const Avatar = ({
  name,
  size = 48,
  style,
}: {
  name: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) => {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: pick(name),
        },
        style,
      ]}>
      <Text style={[styles.initial, {fontSize: size * 0.42}]}>{initial}</Text>
    </View>
  );
};

export default Avatar;

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: COLORS.secondary.white,
    ...FONTFAMILY.MONTSERRAT.b.pt16,
  },
});