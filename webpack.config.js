'use strict';

const path = require('path');

/** @typedef {import('webpack').Configuration} WebpackConfig */

/** @type WebpackConfig */
const extensionConfig = {
  target: 'node',
  mode: 'none',
  entry: {
    // extension: './src/extension.ts', // A is compiled separately
    more: './src/more.ts', // B is bundled with all its dependencies (C, etc.)
  },

  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'commonjs2'
  },
  externals: [
    // Keep vscode module external
    'vscode',
    // Treat B as external when bundling A
    ({ context, request }, callback) => {
      if (context && context.endsWith('src') && request === './more') {
        return callback(null, 'commonjs ./more.js');
      }
      callback();
    },
  ],
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: "log"
  }
};

module.exports = [extensionConfig];

