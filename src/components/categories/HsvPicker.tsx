import React, { useEffect, useRef, useState } from 'react';
import { View, PanResponder, StyleSheet, LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';
import { hsvToHex, hexToHsv, type Hsv } from '../../utils/color';

type Props = {
  value: string;
  onChange: (hex: string) => void;
};

const HUE_COLORS = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000'] as const;
const THUMB = 18;
const HUE_HEIGHT = 24;
const SV_HEIGHT = 160;

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

export function HsvPicker({ value, onChange }: Props) {
  const hsvRef = useRef<Hsv>(hexToHsv(value));
  const lastEmitted = useRef<string | null>(null);
  const svSize = useRef({ width: 0, height: SV_HEIGHT });
  const hueWidth = useRef(0);
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      hsvRef.current = hexToHsv(value);
      forceRender((t) => t + 1);
    }
  }, [value]);

  function commit(next: Hsv) {
    hsvRef.current = next;
    forceRender((t) => t + 1);
    const hex = hsvToHex(next);
    lastEmitted.current = hex;
    onChange(hex);
  }

  const svResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => handleSv(e.nativeEvent.locationX, e.nativeEvent.locationY),
      onPanResponderMove: (e) => handleSv(e.nativeEvent.locationX, e.nativeEvent.locationY),
    }),
  ).current;

  const hueResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => handleHue(e.nativeEvent.locationX),
      onPanResponderMove: (e) => handleHue(e.nativeEvent.locationX),
    }),
  ).current;

  function handleSv(x: number, y: number) {
    const { width, height } = svSize.current;
    if (!width) return;
    const s = clamp(x / width, 0, 1) * 100;
    const v = (1 - clamp(y / height, 0, 1)) * 100;
    commit({ ...hsvRef.current, s, v });
  }

  function handleHue(x: number) {
    const width = hueWidth.current;
    if (!width) return;
    const h = clamp(x / width, 0, 1) * 360;
    commit({ ...hsvRef.current, h });
  }

  function onSvLayout(e: LayoutChangeEvent) {
    svSize.current = { width: e.nativeEvent.layout.width, height: SV_HEIGHT };
  }

  function onHueLayout(e: LayoutChangeEvent) {
    hueWidth.current = e.nativeEvent.layout.width;
  }

  const { h, s, v } = hsvRef.current;
  const svWidth = svSize.current.width || 1;
  const thumbX = clamp((s / 100) * svWidth, 0, svWidth) - THUMB / 2;
  const thumbY = clamp((1 - v / 100) * SV_HEIGHT, 0, SV_HEIGHT) - THUMB / 2;
  const hueX = clamp((h / 360) * (hueWidth.current || 1), 0, hueWidth.current || 1) - THUMB / 2;
  const pureHue = hsvToHex({ h, s: 100, v: 100 });

  return (
    <View>
      <View onLayout={onSvLayout} style={styles.sv} {...svResponder.panHandlers}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: pureHue }]} />
        <LinearGradient
          style={StyleSheet.absoluteFill}
          colors={['#FFFFFF', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
        <LinearGradient
          style={StyleSheet.absoluteFill}
          colors={['rgba(0,0,0,0)', '#000000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        <View pointerEvents="none" style={[styles.thumb, { left: thumbX, top: thumbY }]} />
      </View>
      <View onLayout={onHueLayout} style={styles.hueTrack} {...hueResponder.panHandlers}>
        <LinearGradient
          style={StyleSheet.absoluteFill}
          colors={HUE_COLORS}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
        <View pointerEvents="none" style={[styles.thumb, styles.hueThumb, { left: hueX }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sv: {
    height: SV_HEIGHT,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    marginBottom: theme.spacing[4],
  },
  hueTrack: {
    height: HUE_HEIGHT,
    borderRadius: theme.radius.full,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...theme.shadows.sm,
  },
  hueThumb: {
    top: (HUE_HEIGHT - THUMB) / 2,
    backgroundColor: 'transparent',
  },
});
