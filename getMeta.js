"use strict"

var term = require('child_process');
var fs = require('fs');

function getMeta() {
	this.counter = 0;
	this.usemetaFiles = true;
}

getMeta.prototype = {
	getMeta: function(path, filename){
		var metaFile = path + '/meta.json';
		var metaFileExists = false;

		try {
			var stats = fs.statSync(metaFile);
			metaFileExists = true;
		} catch(e) {}

		if (metaFileExists && this.usemetaFiles) {

			var metaData = JSON.parse(fs.readFileSync(metaFile));
			fullArtist = metaData.fullArtist;
			fullAlbum = metaData.fullAlbum;
			genre = metaData.genre;
			console.log('read meta for %s: %s', fullArtist, fullAlbum);

		} else {
			var meta = term.execSync('/Applications/ffmpeg -y -i "' + path + '/' + filename + '" -f ffmetadata pipe:1', {"encoding": "utf-8"});

			var genre = meta.match(/genre.*/gi)[0].split('=')[1];

			var artistReg = new RegExp(/[\t]*artist=(.*)$/gmi);
			var albumArtistReg = new RegExp(/[\t]*album_artist=(.*)$/gmi);
			var albumReg = new RegExp(/[\t]*album=(.*)$/gmi);

			var fullArtistResults = artistReg.exec(meta);
			var fullAlbumArtistResults = albumArtistReg.exec(meta);
			var fullAlbumResults = albumReg.exec(meta);

			console.log(fullAlbumResults);

			var fullArtist = "";
			var fullAlbum = "";

			if (fullAlbumResults && (fullArtistResults || fullAlbumArtistResults)) {
				fullArtist = fullAlbumArtistResults ? fullAlbumArtistResults[1] : fullArtistResults[1];
				fullAlbum = fullAlbumResults ? fullAlbumResults[1] : null;
			console.log(fullAlbum);

			}

			var metaData = fs.writeFileSync(metaFile, JSON.stringify({'fullArtist' : fullArtist, 'fullAlbum': fullAlbum, 'genre': genre}));

		}

		return {'fullArtist': fullArtist, 'fullAlbum': fullAlbum, 'genre': genre};
	}
}

module.exports = new getMeta();