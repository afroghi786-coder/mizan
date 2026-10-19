const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// پشتیبانی از buffer/stream برای whisper.rn
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  buffer: require.resolve('buffer/'),
  stream: require.resolve('readable-stream'),
  events: require.resolve('events/'),
  process: require.resolve('process/browser'),
  util: require.resolve('util/'),
  string_decoder: require.resolve('string_decoder/'),
  url: require.resolve('url/'),
  path: require.resolve('path-browserify'),
  fs: false,
  crypto: false,
};

// پسوندهای اضافی
config.resolver.sourceExts = [...(config.resolver.sourceExts || []), 'cjs', 'mjs'];
config.resolver.assetExts = [...(config.resolver.assetExts || []), 'bin'];

module.exports = config;
