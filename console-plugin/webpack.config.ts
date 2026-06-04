import { ConsoleRemotePlugin } from '@openshift-console/dynamic-plugin-sdk-webpack';
import * as path from 'path';

const config = {
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
  plugins: [new ConsoleRemotePlugin()],
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

export default config;
