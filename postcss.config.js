module.exports = {
  plugins: {
    'postcss-preset-env': {
      stage: 1,
      features: {
        'nesting-rules': true,
        'custom-properties': {
          preserve: false
        },
        'custom-media-queries': true,
        'media-query-ranges': true,
        'custom-selectors': true,
        'color-mod-function': true,
        'color-function': true
      }
    }
  }
}
