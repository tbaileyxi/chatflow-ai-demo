import React from 'react';
import { Share, TouchableOpacity, Text, StyleSheet } from 'react-native';

interface Props {
  betId: string;
  question: string;
  position: string;
  isSettled?: boolean;
  won?: boolean | null;
  displayName?: string;
  /** optional style overrides */
  compact?: boolean;
}

const SITE_URL = 'https://sidehuddlesports.com';

export function SharePickButton({
  betId,
  question,
  position,
  isSettled,
  won,
  displayName,
  compact = false,
}: Props) {

  const handleShare = async () => {
    const url = `${SITE_URL}/picks/${betId}`;

    let message: string;
    if (isSettled && won) {
      message = `🏆 I called it! "${question}" — ${position.toUpperCase()}\n\nThink you can beat me? Make your picks on Side Huddle Sports 👇\n${url}`;
    } else if (isSettled && won === false) {
      message = `I picked ${position.toUpperCase()} on "${question}" — see if you agree 👇\n${url}`;
    } else {
      message = `I'm picking ${position.toUpperCase()} on "${question}" 🎯\n\nChallenge me on Side Huddle Sports 👇\n${url}`;
    }

    try {
      await Share.share({
        message,
        url, // iOS uses this for the link preview
        title: 'Side Huddle Sports — My Pick',
      });
    } catch {
      // User dismissed share sheet — no-op
    }
  };

  if (compact) {
    return (
      <TouchableOpacity onPress={handleShare} style={styles.compactButton} activeOpacity={0.7}>
        <Text style={styles.compactIcon}>↗</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={handleShare} style={styles.button} activeOpacity={0.8}>
      <Text style={styles.icon}>↗</Text>
      <Text style={styles.label}>
        {isSettled && won ? 'Brag about this 🏆' : 'Challenge my pick'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.25)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  icon: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '700',
  },
  label: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
  },
  compactButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactIcon: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '700',
  },
});
