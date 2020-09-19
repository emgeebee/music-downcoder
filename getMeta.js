'use strict'

var term = require('child_process')
var fs = require('fs')
const metaFile = './meta.json'
let metaData = {}
try {
  metaData = JSON.parse(fs.readFileSync(metaFile))
} catch (e) {}

function getMeta () {
  this.counter = 0
  this.usemetaFiles = true
}

getMeta.prototype = {
  getMeta: function (path, filename) {
    if (metaData[path] && this.usemetaFiles) {
      fullArtist = metaData[path].fullArtist
      fullAlbum = metaData[path].fullAlbum
      genre = metaData[path].genre
      console.log('read meta for %s: %s', fullArtist, fullAlbum)
    } else {
      var meta = term.execSync('/Applications/ffmpeg -y -i "' + path + '/' + filename + '" -f ffmetaData pipe:1', { encoding: 'utf-8' })
      var genre = meta.match(/genre.*/gi)[0].split('=')[1]

      var artistReg = new RegExp(/[\t]*artist=(.*)$/gmi)
      var albumArtistReg = new RegExp(/[\t]*album_artist=(.*)$/gmi)
      var albumReg = new RegExp(/[\t]*album=(.*)$/gmi)

      var fullArtistResults = artistReg.exec(meta)
      var fullAlbumArtistResults = albumArtistReg.exec(meta)
      var fullAlbumResults = albumReg.exec(meta)

      var fullArtist = ''
      var fullAlbum = ''

      if (fullAlbumResults && (fullArtistResults || fullAlbumArtistResults)) {
        fullArtist = fullAlbumArtistResults ? fullAlbumArtistResults[1] : fullArtistResults[1]
        fullAlbum = fullAlbumResults ? fullAlbumResults[1] : null
        console.log(fullAlbum)
      }

      metaData[path] = { fullArtist: fullArtist, fullAlbum: fullAlbum, genre: genre }
    }

    return { fullArtist: fullArtist, fullAlbum: fullAlbum, genre: genre }
  },

  writeBack: function () {
    fs.writeFileSync(metaFile, JSON.stringify(metaData))
  }
}

module.exports = new getMeta()
