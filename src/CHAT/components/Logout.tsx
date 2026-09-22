import {StyleSheet, Text, TouchableWithoutFeedback, View} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import FONTFAMILY from '../../AUTH/styles/fonts';
import COLORS from '../../AUTH/styles/colors';

const Logout = ({onClick}: {onClick: () => void}) => {
  return (
    <TouchableWithoutFeedback onPress={onClick}>
      <View style={styles.box}>
        <Ionicons name="log-out-outline" size={21} color={COLORS.brand.danger} />
        <Text style={styles.label}>Log out</Text>
      </View>
    </TouchableWithoutFeedback>
  );
};

export default Logout;

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    gap: 8,
  },
  label: {
    color: COLORS.brand.danger,
    ...FONTFAMILY.MONTSERRAT.sb.pt16,
  },
});