import {Image, StyleSheet, Text, View} from 'react-native';
import type {StyleProp, ViewStyle} from 'react-native';

import COLORS from '../styles/colors';
import FONTFAMILY from '../styles/fonts';

const {COMFORTAA: com} = FONTFAMILY;

const LOGO_IMAGE = require('../../../assets/images/icon.png');

const Logo = ({style}: {style?: StyleProp<ViewStyle>}) => {
  return (
    <View style={[styles.logoBox, style]}>
      <View style={styles.mark}>
        <Image source={LOGO_IMAGE} style={styles.markImage} resizeMode="contain" />
      </View>
      <Text style={styles.logoText}>Tkirda</Text>
    </View>
  );
};

export default Logo;

const styles = StyleSheet.create({
  logoBox: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  mark: {
    width: 116,
    height: 116,
    borderRadius: 58,
    overflow: 'hidden',
    backgroundColor: COLORS.secondary.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markImage: {
    width: 92,
    height: 92,
  },
  logoText: {
    color: COLORS.secondary.white,
    ...com.b.pt20,
    letterSpacing: 1,
  },
});