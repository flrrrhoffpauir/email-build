# Email build system

The email build system will compile sass, autoprefix css and inline css into your html templates.

## Setup
1. install npm/node
2. install gulp globally `npm install -g gulp`
3. clone repo
4. run `npm install` in the project directory

## Usage

Run `gulp styles` or `gulp html` to compile styles or inline html. Run `gulp watch` to watch for files changes or `gulp server` to watch for changes and run a server at localhost:8000. The server will be looking at the build/ folder. `gulp email --file templates/sample.html` will post templates/sample.html to litmus using the credentials in config.json.
