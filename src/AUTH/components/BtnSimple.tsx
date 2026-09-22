import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {StyleProp, ViewStyle} from 'react-native';

import FONTFAMILY from '../styles/fonts';
import FLEX from '../styles/flex';

import {screen_width} from '../utils/Dimensions';

const {MONTSERRAT: mon} = FONTFAMILY;

type BtnSimpleProps = {
  back: string;
  color: string;
  onClick: () => void;
  text: string;
  isDisabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const BtnSimple = ({
  back,
  color,
  onClick,
  text,
  isDisabled = false,
  style = {width: screen_width * 0.87},
}: BtnSimpleProps) => {
  return (
    <TouchableOpacity onPress={onClick} disabled={isDisabled}>
      <View
        style={[FLEX.centered, style, {backgroundColor: back}, styles.body]}>
        <Text style={[{color}, styles.text]}>{text}</Text>
      </View>
    </TouchableOpacity>
  );
};

export default BtnSimple;

const styles = StyleSheet.create({
  body: {
    height: 52,
    marginHorizontal: 'auto',
    borderRadius: 26,
  },
  text: {textAlign: 'center', ...mon.sb.pt16},
});