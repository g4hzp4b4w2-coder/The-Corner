// Shared camera-box: front camera feed + pose skeleton overlay, sized to
// whatever box a training screen puts it in (web's equivalent is the
// canvas inside each *Mode.jsx's "relative bg-neutral-950 ... rounded-lg
// overflow-hidden" div). `children` is for mode-specific overlay content
// (e.g. a dodge/pad target reticle) drawn on top, absolutely positioned.
import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import { Camera, type CameraDevice } from 'react-native-vision-camera';
import { PoseOverlay } from './PoseOverlay';
import type { RawLandmark } from '../lib/landmarkSpace';

interface Props {
  device: CameraDevice | undefined;
  isActive: boolean;
  frameProcessor: any;
  cameraViewLayoutChangeHandler?: (e: LayoutChangeEvent) => void;
  landmarks: RawLandmark[];
  style?: ViewStyle;
  children?: ReactNode;
}

export function TrainingCamera({
  device,
  isActive,
  frameProcessor,
  cameraViewLayoutChangeHandler,
  landmarks,
  style,
  children,
}: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  return (
    <View style={[styles.box, style]} onLayout={onLayout}>
      {device && (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isActive}
          pixelFormat="rgb"
          frameProcessor={frameProcessor}
          onLayout={cameraViewLayoutChangeHandler}
        />
      )}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <PoseOverlay landmarks={landmarks} width={size.width} height={size.height} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0a0a0a',
  },
});
