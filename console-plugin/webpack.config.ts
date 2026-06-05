/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');

// Fix Windows path separators in PF5 dynamic module maps (backslashes break module resolution)
const dynamicModuleParser = require('@openshift-console/dynamic-plugin-sdk-webpack/lib/utils/dynamic-module-parser');
const originalGetDynamicModuleMap = dynamicModuleParser.getDynamicModuleMap;
dynamicModuleParser.getDynamicModuleMap = (...args: any[]) => {
  const result = originalGetDynamicModuleMap(...args);
  return Object.fromEntries(
    Object.entries(result).map(([key, value]) => [key, (value as string).replace(/\\/g, '/')])
  );
};

const { ConsoleRemotePlugin } = require('@openshift-console/dynamic-plugin-sdk-webpack');

module.exports = {
  entry: {},
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  module: {
    rules: [
      { test: /\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
    ],
  },
  plugins: [new ConsoleRemotePlugin({ validateExtensionProperties: false, validateExtensionIntegrity: false } as any)],
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name]-bundle.js',
    chunkFilename: '[name]-chunk.js',
  },
  devServer: {
    port: 9001,
    static: path.join(__dirname, 'dist'),
  },
};
