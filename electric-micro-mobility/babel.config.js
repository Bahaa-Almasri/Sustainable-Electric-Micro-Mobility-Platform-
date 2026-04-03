/** @type {import('@babel/core').ConfigFunction} */
module.exports = function (api) {
  // Persist Babel transform cache between Metro restarts → faster rebundles in dev.
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
