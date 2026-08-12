import React, {useState, useEffect, useRef} from 'react';
import {Image, ImageProps, View, StyleSheet, NativeModules, Platform} from 'react-native';
import {createVideoThumbnail} from 'react-native-compressor';

const {NativeVideoThumbnail} = NativeModules;

interface Props extends Omit<ImageProps, 'source'> {
  videoUri: string;
  fallbackComponent?: React.ReactNode;
}

// Global in-memory cache so scrolling list doesn't re-generate thumbnails repeatedly
const thumbnailCache = new Map<string, string>();
const failedUris = new Set<string>();

export const VideoThumbnail: React.FC<Props> = ({
  videoUri,
  style,
  resizeMode = 'cover',
  fallbackComponent,
  ...props
}) => {
  const isMounted = useRef(true);
  const attemptedUris = useRef(new Set<string>());

  const lowerUri = (videoUri || '').toLowerCase();
  const isMov = lowerUri.includes('.mov') || lowerUri.includes('.qt');

  const [thumbUri, setThumbUri] = useState<string | null>(() => {
    if (!videoUri) return null;
    if (thumbnailCache.has(videoUri)) return thumbnailCache.get(videoUri)!;
    return isMov ? null : videoUri;
  });

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const generateThumbnail = async (uriToGenerate: string) => {
    if (!uriToGenerate || attemptedUris.current.has(uriToGenerate) || failedUris.has(uriToGenerate)) {
      return;
    }
    attemptedUris.current.add(uriToGenerate);

    try {
      if (Platform.OS === 'android' && NativeVideoThumbnail?.getThumbnail) {
        try {
          const path = await NativeVideoThumbnail.getThumbnail(uriToGenerate);
          if (path) {
            thumbnailCache.set(uriToGenerate, path);
            if (isMounted.current) {
              setThumbUri(path);
            }
            return;
          }
        } catch {
          // Fall through to createVideoThumbnail fallback below
        }
      }

      const res = await createVideoThumbnail(uriToGenerate, {quality: 0.8});
      if (res?.path) {
        const path = res.path.startsWith('file://')
          ? res.path
          : `file://${res.path}`;
        thumbnailCache.set(uriToGenerate, path);
        if (isMounted.current) {
          setThumbUri(path);
        }
      } else {
        failedUris.add(uriToGenerate);
      }
    } catch {
      failedUris.add(uriToGenerate);
    }
  };

  useEffect(() => {
    if (!videoUri) return;

    if (thumbnailCache.has(videoUri)) {
      setThumbUri(thumbnailCache.get(videoUri)!);
      return;
    }

    if (isMov || videoUri.startsWith('content://')) {
      generateThumbnail(videoUri);
    }
  }, [videoUri]);

  const handleError = () => {
    if (videoUri && !attemptedUris.current.has(videoUri) && !failedUris.has(videoUri)) {
      generateThumbnail(videoUri);
    } else if (videoUri) {
      failedUris.add(videoUri);
    }
  };

  if (!thumbUri || failedUris.has(videoUri)) {
    return fallbackComponent ? <>{fallbackComponent}</> : <View style={[style, styles.fallback]} />;
  }

  return (
    <Image
      {...props}
      key={thumbUri}
      source={{uri: thumbUri}}
      style={style}
      resizeMode={resizeMode}
      onError={handleError}
    />
  );
};

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
});
