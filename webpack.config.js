import path from 'path';
import { fileURLToPath } from 'url';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  
  entry: {
    workbench: './src/frontend/workbench/public/js/workbench.js'
  },
  
  output: {
    path: path.resolve(__dirname, 'dist/workbench'),
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
      template: './src/frontend/workbench/public/index.html',
      filename: 'index.html',
      inject: 'body',
      title: 'Semantic Memory Workbench'
    }),
    new CopyWebpackPlugin({
      patterns: [
        // Copy workbench styles
        {
          from: 'src/frontend/workbench/public/styles',
          to: 'styles'
        },
        // Copy workbench JavaScript modules (excluding the main entry point)
        {
          from: 'src/frontend/workbench/public/js',
          to: 'js',
          globOptions: {
            ignore: ['**/workbench.js'] // Exclude main entry point as it's handled by webpack
          }
        }
      ]
    })
  ],
  
  resolve: {
    extensions: ['.js', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src/frontend/workbench'),
      '@workbench': path.resolve(__dirname, 'src/frontend/workbench/public'),
      '@services': path.resolve(__dirname, 'src/frontend/workbench/public/js/services'),
      '@components': path.resolve(__dirname, 'src/frontend/workbench/public/js/components'),
      '@utils': path.resolve(__dirname, 'src/frontend/workbench/public/js/utils')
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
    static: [
      {
        directory: path.join(__dirname, 'dist/workbench'),
      },
      {
        directory: path.join(__dirname, 'src/frontend/workbench/public'),
        publicPath: '/workbench'
      }
    ],
    compress: true,
    port: 9000,
    hot: process.env.NODE_ENV !== 'production',
    proxy: [
      {
        context: ['/api', '/tell', '/ask', '/augment', '/zoom', '/pan', '/tilt', '/zpt', '/inspect', '/state'],
        target: 'http://localhost:4105', // Updated to match current MCP server port
        secure: false,
        changeOrigin: true
      }
    ],
    historyApiFallback: {
      index: '/index.html'
    }
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
        workbench: {
          test: /[\\/]src[\\/]frontend[\\/]workbench[\\/]/,
          name: 'workbench-common',
          chunks: 'all',
          minChunks: 2
        }
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