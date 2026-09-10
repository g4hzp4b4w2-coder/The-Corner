module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-worklets-core: vision-camera/mediapipe's frame processor
    // worklets. react-native-worklets: Reanimated 4 / Skia's own worklets
    // (react-native-reanimated/plugin is just a re-export of this same
    // plugin). Two independent worklet runtimes, kept side by side rather
    // than merged -- last one wins convention per Reanimated's docs.
    plugins: ['react-native-worklets-core/plugin', 'react-native-worklets/plugin'],
  };
};
