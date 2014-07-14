var through = require('through2')
  , gutil = require('gulp-util')
  , jsdom = require('jsdom')
  , os = require('os')
  , fs = require('fs')
  , path = require('path')
	, juice = require('juice');

module.exports = function(opt){
  
  function gulpJuice (file, encoding, callback) {
    if (file.isNull()) {
      this.push(file);
      return callback();
    }

    if (file.isStream()) {
      return callback(new gutil.PluginError('gulp-juice', 'doesn\'t support Streams'));
    }

    juice(file.path, opt, function(err, html){
      if (err) return callback(new gutil.PluginError('gulp-juice', err));
      var cssFiles = getCSSFiles(file.contents);
      var headCSS = getCSSFilesContent(cssFiles);
      html = html.replace(/<\/head>/, '<style>\n'+headCSS+'\n</style>\n</head>');
      file.contents = new Buffer(html);
      this.push(file);
      callback();
    }.bind(this))

    // Get an array of the css files from the html references
    function getCSSFiles(html) {
      var results = [];
      var document = getJSDOM(html);
      var linkList = document.getElementsByTagName("link");
      var link, i, j, attr, attrs;
      for (i = 0; i < linkList.length; ++i) {
        link = linkList[i];
        attrs = {};
        for (j = 0; j < link.attributes.length; ++j) {
          attr = link.attributes[j];
          attrs[attr.name.toLowerCase()] = attr.value;
        }
        if (attrs.rel && attrs.rel.toLowerCase() === 'stylesheet') {
          results.push(attrs.href);
        }
      }
      return results;
    }
  }

  // Get the contents of the CSS files as a string
  function getCSSFilesContent(cssFiles) {
    var css = '';
    var self = this;
    var total = cssFiles.length-1
    var i = 0;

    for(i; i<=total; ++i) {
      cssFiles[i] = 'build/'+cssFiles[i];
      var cssFile = path.resolve(process.cwd(), cssFiles[i]);
      css += '\n'+fs.readFileSync(cssFile).toString();
    }
    return String(css);
  }


  function getJSDOM(html) {
    return jsdom.html(html, null, {
      features: {
          QuerySelector: ['1.0']
        , FetchExternalResources: false
        , ProcessExternalResources: false
        , MutationEvents: false
      }
    });
  }

  return through.obj(gulpJuice);
}
