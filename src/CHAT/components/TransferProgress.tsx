import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import COLORS from '../../AUTH/styles/colors';
import FONTFAMILY from '../../AUTH/styles/fonts';
import { formatBytes } from '../../services/filePickerService';
import type { MediaMessage } from '../../services/mediaStore';

const ACTIVE = new Set<MediaMessage['status']>(['queued', 'connecting', 'sending', 'receiving']);

type TransferProgressProps = {
  media: MediaMessage;
  onCancel?: () => void;
  onRetry?: () => void;
  detail?: string;
};

const percent = (media: MediaMessage): number => {
  if (!media.totalChunks) return 0;
  return Math.min(100, Math.round((media.transferredChunks / media.totalChunks) * 100));
};

const label = (media: MediaMessage): string => {
  switch (media.status) {
    case 'queued':
      return media.direction === 'out' ? 'Waiting to send…' : 'Waiting to receive…';
    case 'connecting':
      return media.direction === 'out' ? 'Connecting…' : 'Connecting…';
    case 'sending':
      return media.direction === 'out' ? `Sending… ${percent(media)}%` : `Receiving… ${percent(media)}%`;
    case 'receiving':
      return `Receiving… ${percent(media)}%`;
    case 'failed':
      return media.direction === 'out' ? 'Failed to send' : 'Interrupted';
    case 'cancelled':
      return 'Cancelled';
    default:
      return '';
  }
};

const TransferProgress = ({media, onCancel, onRetry, detail}: TransferProgressProps) => {
  const active = ACTIVE.has(media.status);
  const showBar = active && media.totalChunks > 1;

  return (
    <View style={styles.wrapper}>
      {showBar ? (
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, {width: `${percent(media)}%`}]}
            testID="transfer-progress-fill"
          />
        </View>
      ) : null}
      <View style={styles.row}>
        <Text style={styles.label} numberOfLines={1}>
          {label(media)}
          {detail ? ` · ${detail}` : ''}
        </Text>
        {active && media.direction === 'out' && onCancel ? (
          <TouchableOpacity onPress={onCancel} hitSlop={8} accessibilityLabel="Cancel transfer" style={styles.iconButton}>
            <Ionicons name="close" size={14} color={COLORS.brand.danger} />
          </TouchableOpacity>
        ) : null}
        {media.status === 'failed' && media.direction === 'out' && onRetry ? (
          <TouchableOpacity
            onPress={onRetry}
            hitSlop={10}
            accessibilityLabel="Resend"
            style={styles.retry}>
            <Ionicons name="refresh" size={14} color={COLORS.secondary.white} />
          </TouchableOpacity>
        ) : null}
      </View>
      {media.direction === 'out' && media.status === 'delivered' ? (
        <Text style={styles.delivered}>Delivered · {formatBytes(media.size)}</Text>
      ) : null}
      {media.direction === 'in' && media.status === 'ready' ? (
        <Text style={styles.delivered}>{formatBytes(media.size)}</Text>
      ) : null}
    </View>
  );
};

export default TransferProgress;

const styles = StyleSheet.create({
  wrapper: {
    gap: 4,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.brand.inputBack,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: COLORS.brand.teal,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    flex: 1,
    ...FONTFAMILY.POPPINS.reg.pt12,
    color: COLORS.brand.sub,
  },
  iconButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.secondary.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retry: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.brand.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  delivered: {
    marginTop: 1,
    ...FONTFAMILY.POPPINS.reg.pt12,
    color: COLORS.brand.sub,
  },
});