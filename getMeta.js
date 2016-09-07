"use strict"

var term = require('child_process');
var fs = require('fs');

function getMeta() {
	this.counter = 0;
	this.usemetaFiles = true;

	this.metaFile = './meta.json';
	this.metaData = {};
	try {
		this.metaData = JSON.parse(fs.readFileSync(this.metaFile));
	} catch (e) {}
}

getMeta.prototype = {
	getMeta: function(path, filename){

		if (this.metaData[path] && this.usemetaFiles) {

			fullArtist = this.metaData[path].fullArtist;
			fullAlbum = this.metaData[path].fullAlbum;
			genre = this.metaData[path].genre;
			console.log('read meta for %s: %s', fullArtist, fullAlbum);

		} else {
			var meta = term.execSync('/Applications/ffmpeg -y -i "' + path + '/' + filename + '" -f ffmetaData pipe:1', {"encoding": "utf-8"});
            var genre = meta.match(/genre.*/gi)[0].split('=')[1];

			var artistReg = new RegExp(/[\t]*artist=(.*)$/gmi);
			var albumArtistReg = new RegExp(/[\t]*album_artist=(.*)$/gmi);
			var albumReg = new RegExp(/[\t]*album=(.*)$/gmi);

			var fullArtistResults = artistReg.exec(meta);
			var fullAlbumArtistResults = albumArtistReg.exec(meta);
			var fullAlbumResults = albumReg.exec(meta);

			var fullArtist = "";
			var fullAlbum = "";

			if (fullAlbumResults && (fullArtistResults || fullAlbumArtistResults)) {
				fullArtist = fullAlbumArtistResults ? fullAlbumArtistResults[1] : fullArtistResults[1];
				fullAlbum = fullAlbumResults ? fullAlbumResults[1] : null;
			console.log(fullAlbum);

			}

			this.metaData[path] = {'fullArtist' : fullArtist, 'fullAlbum': fullAlbum, 'genre': genre};
			fs.writeFileSync(this.metaFile, JSON.stringify(this.metaData));

		}

		return {'fullArtist': fullArtist, 'fullAlbum': fullAlbum, 'genre': genre};
	}
}

module.exports = new getMeta();
