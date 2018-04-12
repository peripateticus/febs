const path = require('path');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const AssetTagPlugin = require('asset-tag-frag-webpack-plugin');
const ManifestPlugin = require('webpack-manifest-plugin');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const autoprefixer = require('autoprefixer');
const postCSSImport = require('postcss-import');
const babelPresetEnv = require('babel-preset-env');
const babelPresetES2015Riot = require('babel-preset-es2015-riot');

const projectPath = process.cwd();

// eslint-disable-next-line import/no-dynamic-require
const packageName = require(path.join(projectPath, '/package.json')).name;

// Get appropriate environment.
const env = !process.env.NODE_ENV ? 'prod' : process.env.NODE_ENV;

const extractSass = new ExtractTextPlugin({
  filename: env === 'dev' ? '[name].bundle.css' : '[name].bundle-[contenthash].css',
});

module.exports = {

  entry: {
    app: path.resolve(projectPath, 'src/entry.js'),
  },

  output: {
    path: path.resolve(projectPath, 'dist', packageName),
    filename: env === 'prod' ? '[name].bundle-[hash].js' : '[name].bundle.js',
    publicPath: '/dist/',
  },

  resolve: {
    extensions: [
      '.js',
      '.json',
      '.vue',
      '.scss',
      '.css',
    ],
  },

  devtool: env === 'dev' ?
    'eval-source-map' : /* internal, cheap, fast */
    'source-map' /* external */,

  // Resolve loaders relative to rei-febs (as this will be a dependency of another module.)
  resolveLoader: {
    modules: [
      path.resolve(__dirname, '..', 'node_modules'),
      path.resolve(projectPath, 'node_modules'),
    ],
  },

  module: {
    rules: [
      {
        test: /\.js|\.jsx$/,
        exclude: /(node_modules)/,
        use: {
          loader: 'babel-loader',
          options: {
            cacheDirectory: path.resolve('./.babelcache'),
            presets: [
              [
                babelPresetEnv, {
                  targets: {
                    browsers: [
                      'Chrome >= 41',
                      'Firefox > 57',
                      'iOS > 7',
                      'Safari >= 9',
                      'Explorer >= 11',
                      'Edge >= 15',
                    ],
                  },
                },
              ],
              babelPresetES2015Riot,
            ],
          },
        },
      },
      {
        enforce: 'pre',
        test: /\.jsx?$/,
        include: path.resolve('.'),
        use: {
          loader: 'eslint-loader',
          options: {
            // cache: true,
            fix: false,
            failOnWarning: false,
            failOnError: false,
            emitError: false,
            emitWarning: false,
          },
        },
      },
      {
        test: /\.tag$/,
        exclude: /node_modules/,
        loader: 'riot-tag-loader',
      },
      {
        test: /\.vue$/,
        exclude: /node_modules/,
        loader: 'vue-loader',
      }, {
        test: /\.(s[ac]|c)ss$/,
        use: extractSass.extract({
          use: [{
            loader: 'css-loader',
          }, {
            loader: 'postcss-loader',
            options: {
              plugins: loader => [
                postCSSImport({ root: loader.resourcePath }),
                autoprefixer(),
              ],
            },
          }, {
            loader: 'sass-loader',
            options: {
              outputStyle: env === 'prod' ? 'compressed' : 'nested',
            },
          }],
          fallback: 'style-loader',
        }),
      },
      {
        test: /\.less$/,
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',

          use: [
            {
              loader: 'css-loader',
              options: {
                minimize: env === 'prod',
                sourceMap: env !== 'prod',
              },
            }, {
              loader: 'postcss-loader',
              options: {
                plugins: loader => [
                  postCSSImport({ root: loader.resourcePath }),
                  autoprefixer(),
                ],
              },
            },
            {
              loader: 'less-loader',
              options: {},
            },
          ],
        }),
      },
      {
        test: /\.svg$/,
        loader: 'file-loader',
        options: {
          emitFile: false,
        },
      },
    ],
  },

  plugins: [

    extractSass,

    new ExtractTextPlugin({
      filename: env === 'dev' ? '[name].bundle.css' : '[name].bundle-[contenthash].css',
    }),

    new AssetTagPlugin({
      test: process.env.FEBS_TEST,
    }),

    new ManifestPlugin(),

    new UglifyJsPlugin({
      sourceMap: env === 'prod',
      uglifyOptions: {
        compress: env === 'prod',
      },
    }),
  ],
};
