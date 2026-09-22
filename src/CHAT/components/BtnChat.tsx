import {StyleSheet, Text, TouchableOpacity} from 'react-native';

import COLORS from '../../AUTH/styles/colors';
import FONTFAMILY from '../../AUTH/styles/fonts';

type BtnChatProps = {
  title: string;
  handler: () => void;
  disabled?: boolean;
};

const BtnChat = ({title, handler, disabled}: BtnChatProps) => {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabled]}
      onPress={handler}
      disabled={disabled}>
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
};

export default BtnChat;

const styles = StyleSheet.create({
  button: {
    backgroundColor: COLORS.brand.green,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  disabled: {
    opacity: 0.5,
  },
  buttonText: {
    ...FONTFAMILY.MONTSERRAT.sb.pt16,
    color: COLORS.secondary.white,
  },
});