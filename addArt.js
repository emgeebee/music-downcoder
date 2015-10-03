"use strict"

var fs = require('fs');
var file = require('file');
var term = require('child_process');
var path = require('path');
var art = require('./art');

function Addart() {
	this.startLocation = "/Volumes/USB-MUSIC/";
	this.count = 0;
}

Addart.prototype = {
	start: function() {
		file.walkSync(this.startLocation, this.checkFiles.bind(this));
	},


	checkFiles: function(dirPath, dirs, files){
		for (var i = dirs.length - 1; i >= 0; i--) {
			var dir = dirs[i];
			if (dir[0] === '.') { continue }
			var albumFolder = dirPath + '/' + dir;
			var artFile = albumFolder + '/folder.jpg';
			fs.stat(artFile, this.afterFile.bind(this, albumFolder, artFile));
		};
	},

	afterFile: function(albumFolder, artFile, err, stat) {
		if (err === null) {
	        console.log('Album art exists');
	    } else if (err.code == 'ENOENT') {
	    	console.log(albumFolder);
	    	var files = fs.readdir(albumFolder, this.scanAlbumFolder.bind(this, albumFolder, artFile));
	    }
	},

	scanAlbumFolder: function(albumFolder, artFile, err, files) {
		if (err === null) {
	    	if (files.length > 0 && path.extname(files[0]) === ".mp3" && files[0][0] !== ".") {
	    		this.getMetaData(albumFolder, artFile, files[0]);
	    	}
	    }
	},

	getMetaData: function(albumFolder, artFile, testFile) {
		var meta = term.execSync('/Applications/ffmpeg -y -i "' + albumFolder + '/' + testFile + '" -f ffmetadata pipe:1', {"encoding": "utf-8"});
		var artist = meta.match(/album_artist.*/gi) ? meta.match(/album_artist.*/g)[0].split('=')[1] : meta.match(/artist.*/g)[0].split('=')[1];
		var album = meta.match(/album(?!_).*/gi)[0].split('=')[1];

		this.count++;

		setTimeout(art.getArt.bind(art, artist, album, albumFolder), 2000 * this.count);
	}
}

module.exports = new Addart();
module.exports.start();