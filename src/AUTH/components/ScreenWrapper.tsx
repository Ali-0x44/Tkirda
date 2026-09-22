import type {ReactNode} from 'react';

import {Keyboard, TouchableOpacity} from 'react-native';

import FLEX from '../styles/flex';

const ScreenWrapper = ({children}: {children: ReactNode}) => {
  return (
    <TouchableOpacity
      style={FLEX.fill}
      activeOpacity={1}
      onPress={() => Keyboard.dismiss()}>
      {children}
    </TouchableOpacity>
  );
};

export default ScreenWrapper;