import gulp from 'gulp'
require('./scripts')
require('./manifest')
require('./styles')
require('./pages')
require('./prompts')
require('./locales')
require('./images')
require('./fonts')
require('./chromereload')
require('./content')
require('./clean')

gulp.task('build', gulp.series('clean', gulp.parallel(
  'manifest',
  'scripts',
  'styles',
  'pages',
  'prompts',
  'locales',
  'images',
  'fonts',
  'chromereload',
  'content'
)))
