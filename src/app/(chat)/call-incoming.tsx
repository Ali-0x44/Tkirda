import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

import COLORS from '@/AUTH/styles/colors';
import FONTFAMILY from '@/AUTH/styles/fonts';
import Avatar from '@/CHAT/components/Avatar';
import { rejectCall } from '@/P2P/callSignaling';
import { callService, type Call } from '@/services/callService';
import { navigateToActiveCall, performAnswer } from '@/services/callKeepService';

export default function IncomingCallScreen() {
  const params = useLocalSearchParams<{ id: string; name: string }>();
  const contactId = params.id;
  const contactName = params.name || 'Unknown';
  const router = useRouter();

  const [call, setCall] = useState<Call | null>(null);
  const [ringing, setRinging] = useState(true);

  useEffect(() => {
    const unsub = callService.subscribe(setCall);
    return unsub;
  }, []);

  const onAnswer = async () => {
    if (!call || !contactId) return;
    setRinging(false);

    try {
      const info = await performAnswer(call.id);

      if (info) {
        // Answered from a cold start — navigate with the caller info we just
        // rebuilt from the offer doc.
        await navigateToActiveCall(info);
      } else {
        router.push({
          pathname: '/call/[id]',
          params: { id: contactId, name: contactName, callId: call.id },
        });
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to answer call');
      console.error('Answer call error:', err);
      setRinging(true);
    }
  };

  const onReject = async () => {
    if (!call) return;

    try {
      await rejectCall(call.id);
      callService.rejectCall();
      router.back();
    } catch (err) {
      console.error('Reject call error:', err);
      router.back();
    }
  };

  if (!call || !ringing) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Avatar name={contactName} size={120} />
        <Text style={styles.name}>{contactName}</Text>
        <Text style={styles.label}>Incoming {call.mediaType.replace('-', ' ')} call</Text>
        {ringing && (
          <View style={styles.pulseContainer}>
            <View style={[styles.pulse, styles.pulse1]} />
            <View style={[styles.pulse, styles.pulse2]} />
            <View style={[styles.pulse, styles.pulse3]} />
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.rejectButton]}
          onPress={onReject}
          accessibilityLabel="Reject call">
          <Ionicons name="close" size={32} color={COLORS.secondary.white} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.answerButton]}
          onPress={onAnswer}
          accessibilityLabel="Answer call">
          <Ionicons name="call" size={32} color={COLORS.secondary.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary.blue,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 40,
  },
  content: {
    alignItems: 'center',
    gap: 16,
  },
  name: {
    ...FONTFAMILY.MONTSERRAT.reg.pt24,
    color: COLORS.secondary.white,
  },
  label: {
    ...FONTFAMILY.POPPINS.reg.pt14,
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'capitalize',
  },
  pulseContainer: {
    marginTop: 24,
    position: 'relative',
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  pulse1: {
    width: 100,
    height: 100,
  },
  pulse2: {
    width: 140,
    height: 140,
  },
  pulse3: {
    width: 180,
    height: 180,
  },
  actions: {
    flexDirection: 'row',
    gap: 40,
    paddingBottom: 20,
  },
  button: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  rejectButton: {
    backgroundColor: COLORS.brand.danger,
  },
  answerButton: {
    backgroundColor: '#10b981',
  },
});
