import path from 'path';
import { fileURLToPath } from 'url';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  
  entry: {
    main: './src/frontend/index.js'
  },
  
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: process.env.NODE_ENV === 'production' ? '[name].[contenthash].js' : '[name].js',
    clean: true,
    publicPath: './'
  },
  
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                targets: {
                  browsers: ['> 1%', 'last 2 versions']
                },
                modules: false
              }]
            ]
          }
        }
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1,
              modules: false
            }
          }
        ]
      }
    ]
  },
  
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/frontend/index.template.html',
      filename: 'index.html',
      inject: 'body'
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'src/frontend/styles/theme.css',
          to: 'theme.css'
        },
        {
          from: 'src/frontend/styles/components',
          to: 'components'
        }
      ]
    })
  ],
  
  resolve: {
    extensions: ['.js', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src/frontend')
    },
    fallback: {
      "path": "path-browserify",
      "url": "url/",
      "fs": false,
      "stream": "stream-browserify",
      "buffer": "buffer"
    }
  },
  
  devtool: process.env.NODE_ENV === 'production' ? 'source-map' : 'eval-source-map',
  
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    compress: true,
    port: 9000,
    hot: process.env.NODE_ENV !== 'production', // Only enable HMR in development
    proxy: [
      {
        context: ['/api'],
        target: 'http://localhost:4100',
        secure: false,
        changeOrigin: true
      }
    ]
  },
  
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
  },
  
  // Only use ES modules for production to avoid HMR conflicts
  ...(process.env.NODE_ENV === 'production' && {
    experiments: {
      outputModule: true
    }
  })
};