const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Lazy-evaluate dependency subgraphs where safe → less work per module during dev transforms.
const upstreamGetTransformOptions = config.transformer?.getTransformOptions;
config.transformer = {
  ...config.transformer,
  getTransformOptions: async (entryPoints, options) => {
    const base = upstreamGetTransformOptions
      ? await upstreamGetTransformOptions(entryPoints, options)
      : { transform: {} };
    return {
      ...base,
      transform: {
        ...base.transform,
        experimentalImportSupport: false,
        // Keep Expo/RN default for inlineRequires. Forcing true can reorder module init and
        // break react-native-worklets / Reanimated (e.g. dev-time serialization in runOnUI).
      },
    };
  },
};

module.exports = config;
