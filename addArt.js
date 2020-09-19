'use strict'

var fs = require('fs')
var file = require('file')
var term = require('child_process')
var path = require('path')
var art = require('./art')
var metaGetter = require('./getMeta')
var argv = require('optimist').argv

function Addart () {
//	this.startLocation = "/Volumes/Music/4/";
  this.startLocation = '/Volumes/music/1/'
  this.count = 0
}

Addart.prototype = {
  start: function () {
    file.walkSync(this.startLocation, this.iterateDirs.bind(this))
  },

  iterateDirs: function (dirPath, dirs, files) {
    for (var i = dirs.length - 1; i >= 0; i--) {
      var dir = dirs[i]
      if (dir[0] === '.') { continue }
      var albumFolder = dirPath + '/' + dir
      this.checkFiles(albumFolder)
    };
  },

  checkFiles: function (albumFolder, meta) {
    var artFile = albumFolder + '/folder.jpg'
    fs.stat(artFile, this.afterFile.bind(this, albumFolder, artFile, meta))
  },

  afterFile: function (albumFolder, artFile, meta, err, stat) {
    if (err === null) {
	    } else if (err.code == 'ENOENT') {
	    	var files = fs.readdir(albumFolder, this.scanAlbumFolder.bind(this, albumFolder, artFile, meta))
	    }
  },

  scanAlbumFolder: function (albumFolder, artFile, meta, err, files) {
    if (err === null) {
	    	if (files.length > 0 && path.extname(files[0]) === '.mp3' && files[0][0] !== '.') {
	    		this.getMetaData(albumFolder, artFile, files[0], meta)
		    } else if (meta) {
		    	this.getMetaData(albumFolder, artFile, undefined, meta)
		    }
    }
  },

  getMetaData: function (albumFolder, artFile, testFile, meta) {
    if (!meta) {
      meta = metaGetter.getMeta(albumFolder, testFile)
    }

    var album = meta.fullAlbum
    var artist = meta.fullArtist

    this.count++

    art.getArt.call(art, artist, album, albumFolder)
  },

  checkArtistFile: function (folder, artist) {
    var artFile = folder + '/folder.jpg'
    fs.stat(artFile, this.getArtistImage.bind(this, folder, artist, artFile))
  },

  getArtistImage: function (folder, artist, artFile, err, stat) {
    if (err === null) {
	    } else if (err.code == 'ENOENT') {
      art.getArt.call(art, artist, null, folder)
	    }
  }
}

module.exports = new Addart()
if (argv.run === 'true') {
  module.exports.start()
}
