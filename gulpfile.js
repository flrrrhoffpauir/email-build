var gulp = require('gulp'),
	autoprefixer = require('gulp-autoprefixer'),
	cache = require('gulp-cached'),
	clean = require('gulp-clean'),
	express = require('express'),
	filter = require('gulp-filter'),
	fs = require('fs'),
	inliner = require('gulp-inline-css')
	juice = require('./plugins/gulp-juice'),
	livereload = require('gulp-livereload'),
	lr = require('tiny-lr'),
	minify = require('gulp-minify-css'),
	minimist = require('minimist'),
	mailer = require('nodemailer').mail
	rename = require('gulp-rename'),
	replace = require('gulp-replace'),
	request = require('request'),
	sass = require('gulp-ruby-sass'),
	uglify = require('gulp-uglify')
	xml2js = require('xml2js');

var server = express(),
	reload = lr(),
	config = require('./config.json');

var paths = {
	styles: 'src/sass/**/*.scss',
	templates: 'src/templates/**/*.html'
}

gulp.task('clean', function() {
	return gulp.src(['build/*', 'dev/*'], { read: false })
		.pipe(clean());
});

gulp.task('styles', function() {
	return gulp.src(paths.styles)
		.pipe(filter('!**/_*.scss'))
		.pipe(cache('styles'))
		.pipe(sass({ style: 'nested' }))
		.pipe(autoprefixer('last 2 version', 'safari 5', 'ie 8', 'ie 9', 'opera 12.1', 'ios 6', 'android 4'))
    	.pipe(gulp.dest('build/css/')) // save non-min
		.pipe(gulp.dest('dev/css/'))
		.pipe(rename('styles.min.css'))
		.pipe(minify())
		.pipe(gulp.dest('build/css/')) // save min
		.pipe(gulp.dest('dev/css/'))
		.pipe(livereload(reload));
});

gulp.task('html', ['html_build', 'html_dev'], function() {
});

gulp.task('html_build', ['styles'],function(){
	return gulp.src(paths.templates)
		.pipe(juice({ url: 'file://'+ __dirname + '/build/' }))
		.pipe(gulp.dest('build/templates/'));
});

gulp.task('html_dev', ['styles'], function() {
	return gulp.src(paths.templates)
		.pipe(replace(/<\/body\>/, "\n\t<script src='http://localhost:35729/livereload.js'></script>\n</body>"))
		.pipe(replace('href="css', 'href="/css'))
		.pipe(gulp.dest('dev/templates/'))
		.pipe(livereload(reload));
});

gulp.task('watch', function() {
	gulp.watch([paths.templates, paths.styles], function() {
		gulp.start('html');
	});
});

gulp.task('server', function() {
	server.use(express.static('./dev'));
	server.listen(8000);
	reload.listen(35729);

	gulp.start('watch');
});

gulp.task('email', function() {
	var argv = minimist(process.argv.slice(2));
		file = argv.file || false,
		subject = argv.subject || false;
	
	if (!config) {
		console.log('Config file is missing. Ensure config.json is available');
		return
	}

	if (!file) {
		console.log('gulp email --file path/to/file.html --subject subject')
		return;
	}

	if (!subject) {
		subject = file;
	}

	var originalFile = fs.readFileSync('./src/' + file, 'utf8'),
		parsedFile = fs.readFileSync('./build/' + file, 'utf8'),
		regex = /\<\!--\s*Litmus\:\s*(\d+)\s*--\>/i,
		idMatch = regex.exec(originalFile);

	if (idMatch && idMatch[1] !== 'undefined') {
		getLitmusRetest(idMatch[1], function(email) {
			sendEmail(email, subject, parsedFile);
		});
	} else {
		getLitmusTest(function(email, id) {
			sendEmail(email, subject, parsedFile);
			appendId(file, id);
			gulp.start('html'); // push out litmus id everywhere
		});
	}
});

gulp.task('default', ['clean'], function() {
	gulp.run('styles', 'html');
});

// helpers
function getLitmusTest(callback) {
	var litmusTemplate = fs.readFileSync('email.xml', 'utf8'),
		options = {
			auth: {
				'user': config.litmus.username,
				'pass': config.litmus.password
			},
			headers: {
				'Accept': 'application/xml',
				'Content-Type': 'application/xml'
			},
			body: litmusTemplate
		};

	request.post('https://'+ config.litmus.domain +'.litmus.com/emails.xml', options, function(error, response, body) {
		xml2js.parseString(body, function(err, json) {
			if (err) {
				console.log(err);
				return;
			}
			var email = json.test_set.test_set_versions[0].test_set_version[0].url_or_guid,
				id = json.test_set.id[0]._;

			callback(email, id);
		});
	});
}

function getLitmusRetest(id, callback) {
	var options = {
			auth: {
				'user': config.litmus.username,
				'pass': config.litmus.password
			},
			headers: {
				'Accept': 'application/xml',
				'Content-Type': 'application/xml'
			}
		};
	request.post('https://'+ config.litmus.domain +'.litmus.com/tests/'+ id +'/versions.xml', options, function(error, response, body) {
		xml2js.parseString(body, function(err, json) {
			if (err) {
				console.log(err);
				return;
			}

			var email = json.test_set_version.url_or_guid[0];
			callback(email);
		});
	});
}

function sendEmail(to, subject, html) {
	mailer({
		from: 'crew@smithandrobot.com',
		to: to,
		subject: subject,
		html: html
	});
}

function appendId(file, id) {
	var tag = "\n<!-- Litmus: " + id + " -->";
	fs.appendFile('./src/' + file, tag, function(err) {});
}
