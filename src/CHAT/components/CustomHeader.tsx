import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import COLORS from '../../AUTH/styles/colors';
import FONTFAMILY from '../../AUTH/styles/fonts';

import { screen_width } from '../../AUTH/utils/Dimensions';

type CustomHeaderProps = {
  onClick: () => void;
  title: string;
  fontSize?: { fontSize: number; fontFamily: string };
  leftIconName?: any;
};

const CustomHeader = ({
  onClick,
  title,
  fontSize = { ...FONTFAMILY.MONTSERRAT.sb.pt18 },
  leftIconName,
}: CustomHeaderProps) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { height: 56 + insets.top, paddingTop: insets.top }]}>
      <TouchableOpacity style={styles.side} onPress={onClick} hitSlop={10}>
        <Ionicons name={leftIconName || "chevron-back"} size={26} color={COLORS.secondary.white} />
      </TouchableOpacity>
      <Text style={[fontSize, styles.title]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.side} />
    </View>
  );
};

export default CustomHeader;

const styles = StyleSheet.create({
  header: {
    width: screen_width,
    height: 56,
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.primary.blue,
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  side: { minWidth: 34 },
  title: {
    color: COLORS.secondary.white,
    textAlign: 'center',
    flex: 1,
  },
});