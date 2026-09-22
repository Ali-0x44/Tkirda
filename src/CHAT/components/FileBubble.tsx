import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import COLORS from '../../AUTH/styles/colors';
import FONTFAMILY from '../../AUTH/styles/fonts';
import { formatBytes } from '../../services/filePickerService';
import type { MediaMessage } from '../../services/mediaStore';
import TransferProgress from './TransferProgress';

type FileBubbleProps = {
  media: MediaMessage;
  mine: boolean;
  onCancel?: () => void;
  onRetry?: () => void;
  onOpen?: (media: MediaMessage) => void;
};

const FileBubble = ({media, mine, onCancel, onRetry, onOpen}: FileBubbleProps) => {
  const downloadable = !!media.path && ['ready', 'delivered', 'failed'].includes(media.status) && onOpen;
  const showTransfer = !['ready', 'delivered'].includes(media.status);

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          {mine ? (
            <Ionicons name="arrow-up-circle" size={26} color={COLORS.brand.teal} />
          ) : (
            <Ionicons name="arrow-down-circle" size={26} color={COLORS.brand.teal} />
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
            {media.name}
          </Text>
          <Text style={styles.size} numberOfLines={1} ellipsizeMode="tail">
            {media.kind} · {formatBytes(media.size)}
            {media.status === 'delivered' ? ' · delivered' : ''}
          </Text>
        </View>
        {downloadable ? (
          <TouchableOpacity
            onPress={() => onOpen?.(media)}
            accessibilityLabel="Open file"
            style={styles.actionButton}>
            <Ionicons name="open-outline" size={18} color={COLORS.brand.teal} />
          </TouchableOpacity>
        ) : null}
      </View>
      {showTransfer ? (
        <TransferProgress media={media} onCancel={onCancel} onRetry={onRetry} />
      ) : null}
      {media.status === 'failed' && onRetry ? (
        <View style={styles.actionRow}>
          <TouchableOpacity onPress={onRetry} style={styles.retryPill}>
            <Ionicons name="refresh" size={14} color={COLORS.secondary.white} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

export default FileBubble;

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
    minWidth: 200,
    maxWidth: 280,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  info: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    ...FONTFAMILY.MONTSERRAT.reg.pt14,
    color: COLORS.brand.ink,
    flexShrink: 1,
  },
  size: {
    ...FONTFAMILY.POPPINS.reg.pt12,
    color: COLORS.brand.sub,
    flexShrink: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.brand.inputBack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.secondary.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  retryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.brand.danger,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  retryText: {
    ...FONTFAMILY.POPPINS.reg.pt12,
    color: COLORS.secondary.white,
  },
});