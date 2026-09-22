import {StyleSheet, Text, TouchableOpacity} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type {ComponentProps} from 'react';

import COLORS from '../../AUTH/styles/colors';

type CardsProps = {
  onClick: () => void;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
};

const Cards = ({onClick, label, icon}: CardsProps) => {
  return (
    <TouchableOpacity style={styles.box} onPress={onClick} activeOpacity={0.6}>
      <Ionicons name={icon} size={21} color={COLORS.primary.blue} />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={COLORS.secondary.greyThree} />
    </TouchableOpacity>
  );
};

export default Cards;

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    height: 50,
    paddingHorizontal: 16,
    gap: 14,
  },
  label: {
    color: COLORS.brand.ink,
    ...{fontSize: 15},
    flex: 1,
  },
});