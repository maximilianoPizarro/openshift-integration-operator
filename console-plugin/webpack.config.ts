const path = require('path');
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
      { test: /\.js$/, resolve: { fullySpecified: false } },
    ],
  },
  plugins: [new ConsoleRemotePlugin({
    validateExtensionProperties: false,
    validateExtensionIntegrity: false,
  })],
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
