// Preload Node 18 polyfills for Metro bundler
require('./polyfill-node');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Route lucide-react-native to CJS build to avoid Metro Windows .mjs relative resolution bug
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'lucide-react-native': path.resolve(__dirname, 'node_modules/lucide-react-native/dist/cjs/lucide-react-native.js'),
};

module.exports = config;
