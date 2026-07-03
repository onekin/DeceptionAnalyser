import gulp from 'gulp'
import gulpif from 'gulp-if'
import livereload from 'gulp-livereload'
import args from './lib/args'

gulp.task('prompts', () => {
  return gulp.src('app/prompts/**/*.md')
    .pipe(gulp.dest(`dist/${args.vendor}/prompts`))
    .pipe(gulpif(args.watch, livereload()))
})
