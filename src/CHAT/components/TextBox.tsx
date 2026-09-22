import {StyleSheet, Text, View} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type {ComponentProps} from 'react';

import COLORS from '../../AUTH/styles/colors';
import FONTFAMILY from '../../AUTH/styles/fonts';

type TextBoxProps = {
  text: string;
  heading: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
};

const TextBox = ({text, heading, icon = 'key-outline'}: TextBoxProps) => {
  return (
    <View style={styles.messageBox}>
      <View style={styles.headingBox}>
        <Text style={styles.heading}>{heading}</Text>
        <Ionicons name={icon} size={20} color={COLORS.brand.teal} />
      </View>
      <Text style={styles.messageText} selectable>
        {text}
      </Text>
    </View>
  );
};

export default TextBox;

const styles = StyleSheet.create({
  messageBox: {
    backgroundColor: COLORS.secondary.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.brand.inputBack,
    gap: 10,
  },
  heading: {
    ...FONTFAMILY.MONTSERRAT.sb.pt14,
    color: COLORS.brand.sub,
    flexShrink: 1,
    textTransform: 'capitalize',
  },
  messageText: {
    ...FONTFAMILY.MONTSERRAT.reg.pt14,
    color: COLORS.brand.ink,
    flexWrap: 'wrap',
  },
  headingBox: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10},
});