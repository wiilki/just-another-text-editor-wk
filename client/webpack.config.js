const HtmlWebpackPlugin = require('html-webpack-plugin');
const WebpackPwaManifest = require('webpack-pwa-manifest');
const { InjectManifest } = require('workbox-webpack-plugin');
const path = require('path');

module.exports = (_, argv) => ({
  mode: argv.mode || 'development',
  entry: './src/js/index.js',
  output: {
    filename: 'assets/[name].[contenthash:8].js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: 'auto',
    clean: true
  },
  devServer: { port: 3001, hot: true, historyApiFallback: true },
  devtool: argv.mode === 'production' ? 'source-map' : 'eval-cheap-module-source-map',
  module: {
    rules: [{ test: /\.css$/i, use: ['style-loader', 'css-loader'] }]
  },
  plugins: [
    new HtmlWebpackPlugin({ template: './index.html', title: 'JATE Studio' }),
    new WebpackPwaManifest({
      name: 'JATE Studio',
      short_name: 'JATE',
      description: 'A private, offline-first studio for writing and code.',
      theme_color: '#171d2b',
      background_color: '#171d2b',
      display: 'standalone',
      start_url: './',
      scope: './',
      publicPath: './',
      fingerprints: false,
      inject: true,
      icons: [{
        src: path.resolve(__dirname, 'src/images/logo.png'),
        sizes: [96, 128, 192, 256, 384, 512],
        destination: path.join('assets', 'icons')
      }]
    }),
    new InjectManifest({ swSrc: './src-sw.js', swDest: 'src-sw.js', maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 })
  ]
});
