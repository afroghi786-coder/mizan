// plugins/withVoskNoCompress.js
const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withVoskNoCompress(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      if (!config.modResults.contents.includes('VOSK_NOCOMPRESS')) {
        config.modResults.contents = config.modResults.contents.replace(
          /android\s*\{/,
          `android {
    // VOSK_NOCOMPRESS
    aaptOptions {
        noCompress "model-fa-fa", "model-en-us", "uuid", "mdl", "conf", "fst", "int", "dubm", "ie", "mat", "stats", "lookup", "mdef", "pcheck", "targets"
    }
`
        );
      }
    }
    return config;
  });
};
