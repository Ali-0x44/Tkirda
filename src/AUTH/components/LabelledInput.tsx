import {useState, useRef} from 'react';

import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import COLORS from '../styles/colors';
import FLEX from '../styles/flex';
import FONTFAMILY from '../styles/fonts';

const {COMFORTAA: com, MONTSERRAT: mon} = FONTFAMILY;

type LabelledInputProps = {
  labelColor?: string;
  label: string;
  data: string;
  onChange: (value: string) => void;
  onFocused?: () => void;
};

const LabelledInput = ({
  labelColor = COLORS.brand.sub,
  label,
  data,
  onChange,
  onFocused,
}: LabelledInputProps) => {
  const inputRef = useRef<TextInput>(null);
  const isPassword = label.includes('Password');
  const [showPassword, setShowPassword] = useState(isPassword);

  const handlePress = () => inputRef.current?.focus();
  const toggleEye = () => setShowPassword(prev => !prev);

  return (
    <TouchableWithoutFeedback onPress={handlePress}>
      <View style={[FLEX.row, styles.container]}>
        <View style={[FLEX.col, styles.inputBox]}>
          <Text style={[styles.label, {color: labelColor}]}>{label}</Text>
          <TextInput
            ref={inputRef}
            secureTextEntry={showPassword}
            style={styles.input}
            maxLength={isPassword ? 20 : 50}
            value={data}
            onChangeText={onChange}
            onFocus={onFocused}
          />
        </View>
        {isPassword && (
          <TouchableWithoutFeedback onPress={toggleEye}>
            <View style={styles.icon}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={COLORS.brand.teal}
              />
            </View>
          </TouchableWithoutFeedback>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
};

export default LabelledInput;

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.brand.inputBack,
    paddingHorizontal: 2,
    paddingVertical: 4,
    marginBottom: 6,
  },
  icon: {padding: 6},
  inputBox: {marginVertical: 2, flex: 1},
  label: {
    margin: 0,
    ...mon.sb.pt12,
  },
  input: {
    width: '100%',
    color: COLORS.brand.ink,
    ...com.reg.pt16,
    paddingVertical: 8,
  },
});