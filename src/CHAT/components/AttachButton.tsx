import {useState} from 'react';
import {Modal, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import COLORS from '../../AUTH/styles/colors';
import FONTFAMILY from '../../AUTH/styles/fonts';

type AttachButtonProps = {
  onPickDocument: () => void;
  onPickImage: () => void;
  disabled?: boolean;
  testID?: string;
};

const AttachButton = ({onPickDocument, onPickImage, disabled = false, testID}: AttachButtonProps) => {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        disabled={disabled}
        testID={testID}
        accessibilityLabel="Attach a file or image"
        style={[styles.button, disabled ? styles.disabled : null]}>
        <Ionicons name="add" size={26} color={COLORS.brand.teal} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.title}>Attach</Text>
            <View style={styles.options}>
              <TouchableOpacity
                style={styles.option}
                onPress={() => {
                  setOpen(false);
                  onPickDocument();
                }}
                accessibilityLabel="Attach document">
                <Ionicons name="document-text" size={26} color={COLORS.brand.teal} />
                <Text style={styles.optionLabel}>Document</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.option}
                onPress={() => {
                  setOpen(false);
                  onPickImage();
                }}
                accessibilityLabel="Attach image">
                <Ionicons name="image" size={26} color={COLORS.brand.teal} />
                <Text style={styles.optionLabel}>Image</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default AttachButton;

const styles = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.secondary.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    paddingBottom: 30,
  },
  title: {
    ...FONTFAMILY.MONTSERRAT.sb.pt16,
    color: COLORS.brand.ink,
    marginBottom: 12,
  },
  options: {
    flexDirection: 'row',
    gap: 12,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.brand.inputBack,
  },
  optionLabel: {
    ...FONTFAMILY.POPPINS.reg.pt12,
    color: COLORS.brand.ink,
  },
});