import gulp from 'gulp'
import gulpif from 'gulp-if'
import colors from 'ansi-colors'
import log from 'fancy-log'
import sourcemaps from 'gulp-sourcemaps'
import less from 'gulp-less'
import gulpSass from 'gulp-sass'
import dartSass from 'sass'
import cleanCSS from 'gulp-clean-css'
import livereload from 'gulp-livereload'
import args from './lib/args'

const sass = gulpSass(dartSass)

// Sass compiler options to silence deprecation warnings from dependencies
const sassOptions = {
  includePaths: ['./app'],
  quietDeps: true, // Silence deprecation warnings from dependencies
  silenceDeprecations: [
    'legacy-js-api', 
    'import',
    'global-builtin',
    'color-functions',
    'if-function',
    'abs-percent'
  ] // Silence specific deprecations
}

gulp.task('styles:css', function () {
  return gulp.src('app/styles/*.css')
    .pipe(gulpif(args.sourcemaps, sourcemaps.init()))
    .pipe(gulpif(args.production, cleanCSS()))
    .pipe(gulpif(args.sourcemaps, sourcemaps.write()))
    .pipe(gulp.dest(`dist/${args.vendor}/styles`))
    .pipe(gulpif(args.watch, livereload()))
})

gulp.task('styles:less', function () {
  return gulp.src('app/styles/*.less')
    .pipe(gulpif(args.sourcemaps, sourcemaps.init()))
    .pipe(less({ paths: ['./app'] }).on('error', function (error) {
      log(colors.red('Error (' + error.plugin + '): ' + error.message))
      this.emit('end')
    }))
    .pipe(gulpif(args.production, cleanCSS()))
    .pipe(gulpif(args.sourcemaps, sourcemaps.write()))
    .pipe(gulp.dest(`dist/${args.vendor}/styles`))
    .pipe(gulpif(args.watch, livereload()))
})

gulp.task('styles:sass', function () {
  return gulp.src('app/styles/*.scss')
    .pipe(gulpif(args.sourcemaps, sourcemaps.init()))
    .pipe(sass(sassOptions).on('error', function (error) {
      log(colors.red('Error (' + error.plugin + '): ' + error.message))
      this.emit('end')
    }))
    .pipe(gulpif(args.production, cleanCSS()))
    .pipe(gulpif(args.sourcemaps, sourcemaps.write()))
    .pipe(gulp.dest(`dist/${args.vendor}/styles`))
    .pipe(gulpif(args.watch, livereload()))
})

gulp.task('styles', gulp.series(
  'styles:css',
  'styles:less',
  'styles:sass'
))
