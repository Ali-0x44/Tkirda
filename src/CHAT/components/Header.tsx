import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import COLORS from '../../AUTH/styles/colors';
import { screen_width } from '../../AUTH/utils/Dimensions';

import Avatar from './Avatar';

type HeaderProps = {
  name?: string;
  goBack: () => void;
  selectCount?: number;
  onDeleteSelected?: () => void;
  onCancelSelect?: () => void;
  onVoiceCall?: () => void;
  onVideoCall?: () => void;
};

const Header = ({
  name = 'CONTACT NAME',
  goBack,
  selectCount = 0,
  onDeleteSelected,
  onCancelSelect,
  onVoiceCall,
  onVideoCall,
}: HeaderProps) => {
  const insets = useSafeAreaInsets();
  const selecting = selectCount > 0;
  return (
    <View style={[styles.header, {height: 56 + insets.top, paddingTop: insets.top}]}>
      <TouchableOpacity
        style={styles.side}
        onPress={selecting ? onCancelSelect : goBack}
        accessibilityLabel={selecting ? 'Cancel selection' : 'Back'}>
        <Ionicons
          name={selecting ? 'close' : 'chevron-back'}
          size={26}
          color={COLORS.secondary.white}
        />
      </TouchableOpacity>
      {selecting ? (
        <>
          <View style={styles.identity}>
            <Text style={styles.title} numberOfLines={1}>
              {selectCount} selected
            </Text>
          </View>
          <TouchableOpacity
            style={styles.side}
            onPress={onDeleteSelected}
            accessibilityLabel="Delete selected messages">
            <Ionicons name="trash-outline" size={24} color={COLORS.secondary.white} />
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={styles.identity}>
            <Avatar name={name} size={38} />
            <View style={styles.identityText}>
              <Text style={styles.title} numberOfLines={1}>
                {name}
              </Text>
            </View>
          </View>
          {(onVoiceCall || onVideoCall) && (
            <View style={styles.actions}>
              {onVideoCall && (
                <TouchableOpacity
                  style={styles.side}
                  onPress={onVideoCall}
                  accessibilityLabel="Start camera call">
                  <Ionicons name="videocam-outline" size={24} color={COLORS.secondary.white} />
                </TouchableOpacity>
              )}
              {onVoiceCall && (
                <TouchableOpacity
                  style={styles.side}
                  onPress={onVoiceCall}
                  accessibilityLabel="Start voice call">
                  <Ionicons name="call-outline" size={24} color={COLORS.secondary.white} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
};

export default Header;

const styles = StyleSheet.create({
  header: {
    elevation: 4,
    width: screen_width,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    backgroundColor: COLORS.primary.blue,
    gap: 6,
  },
  side: {
    minWidth: 34,
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  identity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  identityText: {
    flex: 1,
  },
  title: {
    color: COLORS.secondary.white,
    ...{fontSize: 16},
    flexShrink: 1,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.72)',
    ...{fontSize: 11},
  },
});