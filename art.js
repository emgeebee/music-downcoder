"use strict"

var getter = require("album-art");
var request = require('request');
var fs = require('fs');

function art() {
	this.counter = 0;
}

art.prototype = {
	getArt: function(artist, album, path) {
		console.log(this.counter + ' === Searching for art for ', artist, ' ', album);
		getter(artist, album, 'mega', this.downloadArt.bind(this, path));
		this.counter++;
	},

	downloadArt: function(dest, err, src) {
		if (err) {
			console.log(err);
		}
		if (src) {
			request(src).pipe(fs.createWriteStream(dest + '/folder.jpg'))
		}
	}
}

module.exports = new art();