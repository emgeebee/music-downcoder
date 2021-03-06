#!/usr/bin/env node
'use strict'

const fs = require('fs')
const fse = require('fs-extra')
const fileSys = require('file')
const path = require('path')
const args = require('minimist')(process.argv.slice(2))

const addArt = require('./addArt')
const metaGetter = require('./getMeta')
const { commandsFolder, config, numOfCores, rate } = require('./constants')

const configKey = args.key || 'alac'

console.log('================')
console.log('================')
console.log(`Using key "${configKey}", other options are "main", "alac", "ogg"`)
console.log(`Use "--key {key}" to select`)
console.log('================')
console.log('================')

const outputFormat = config[configKey].format
const outputFormatExtension = '.' + outputFormat
const outputFormatExtensionRegex = new RegExp('\.' + outputFormat)
const commands = {}
const genres = {}
const outputFiles = {}

const pathSanitiser = (i) => i.replace(/[`\$\"]/g, '\\$&')

const checkOutputFolders = () => {
  for (var i = numOfCores - 1; i >= 0; i--) {
    fse.ensureDir(path.join(commandsFolder, String(i)), () => {})
  }
}

const getPaths = () => {
  fileSys.walkSync(config[configKey].start, checkFiles)
  metaGetter.writeBack()
  writeCommands(commands)
}

const getOutputPath = (file) => {
  let path = file
  let regex = new RegExp('.m4a')
  if (!isCopy(file)) {
    path = file.replace(config[configKey].start, '').replace('.m4a', outputFormatExtension).replace('.flac', outputFormatExtension)
    regex = new RegExp(outputFormatExtension)
  }
  return { path, regex }
}

const checkFiles = (dirPath, dirs, files) => {
  let meta
  let album = dirPath.replace(config[configKey].start, '')
  const sanistisedDirPath = dirPath.replace(/[`]/g, '\`')
  const outputDir = config[configKey].out
  files.forEach((file, i) => {
    if (file[0] === '.') { return }
    const { regex, path } = getOutputPath(file)

    if (!regex.test(path)) { return } // skipping non-music files

    const filename = file.replace(/[`]/g, '\`') // escape ticks

    if (!RegExp('\/').test(album)) { // if the album doesnt include artist, build it again
      meta = metaGetter.getMeta(file, filename)
      album = meta.fullArtist + '/' + album
    }

    if (genres[album] === undefined) { // if we dont have the genre, build it
      meta = metaGetter.getMeta(sanistisedDirPath, file)
      genres[album] = meta.genre
    }

    const outputFolder = outputDir + genres[album] + '/' + album
    const output = pathSanitiser(outputFolder + '/' + path)
    const filepath = pathSanitiser(sanistisedDirPath + '/' + filename)

    if (!outputFiles[album]) { // find the files in the output path so we can see if it already exists
      try {
        outputFiles[album] = fs.readdirSync(outputFolder)
      } catch (e) {
        outputFiles[album] = []
      }
    }

    if (outputFiles[album].indexOf(path) < 0) {
      // fse.ensureDir(outputFolder, afterDirectoryCreation.bind(null, outputFolder, meta));
      fse.ensureDir(outputFolder)

      var r = buildCommand(filepath, output)
      if (commands[album] === undefined) {
        commands[album] = []
      }
      commands[album].push(...r.command)
    }
  })
}

const isCopy = (path) => {
  return !!((outputFormat === 'cp' || outputFormatExtensionRegex.test(path) || new RegExp('mp3').test(path)))
}

const buildCommand = (filepath, output) => {
  return isCopy(filepath) ? addCopyCommands(filepath, output) : addEncodingCommands(filepath, output)
}

const addEncodingCommands = (filepath, output) => {
  const metaFile = output.replace('.' + outputFormat, '.txt')

  let cmd = [];
  cmd.push('/Applications/ffmpeg -i "' + filepath + '" -f ffmetadata "' + metaFile + '"');
  cmd.push('sed -i".bak" "/^major_brand/d" "' + metaFile + '"')
  cmd.push('sed -i".bak" "/^minor_version/d" "' + metaFile + '"')
  cmd.push('sed -i".bak" "/^compatible_brands/d" "' + metaFile + '"')
  cmd.push('sed -i".bak" "/^gapless_playback/d" "' + metaFile + '"')
  cmd.push('sed -i".bak" "/^encoder/d" "' + metaFile + '"')

  if (config[configKey].format === 'ogg') {
    cmd.push('/Applications/ffmpeg -i "' + filepath + '"  -i "' + metaFile + '" -map 0:0 -map_metadata 1 -c:a libvorbis -ar 44100 -qscale:a 8 -f ' + outputFormat + '  "' + output + '"')
  } else {
    cmd.push('/Applications/ffmpeg -i "' + filepath + '"  -i "' + metaFile + '" -map_metadata 1 -vn -c:a libmp3lame -ar 44100 -q:a ' + rate + ' -id3v2_version 3 -f ' + outputFormat + '  "' + output + '"')
  }
  cmd.push('rm "' + metaFile + '"')
  cmd.push('rm "' + metaFile + '.bak"')
  return { command: cmd }
}

const addCopyCommands = (filepath, output) => {
  return { command: ['cp "' + filepath + '"  "' + output + '"'] }
}

// const afterDirectoryCreation = (albumpath, meta, err) => {
// if (meta && config[configKey].getImages) {
// addArt.checkFiles(albumpath, meta)
// const artistPath = path.dirname(albumpath)
// addArt.checkArtistFile(artistPath, meta.fullArtist)
// }
// }

const writeCommands = (commands) => {
  Object.keys(commands).forEach((albums, i) => {
    fs.writeFileSync(`${commandsFolder}${i % (numOfCores)}/${albums.replace(/((?![a-zA-Z]).)/g, '')}-commands.sh`, commands[albums].join('\n'))
  })
}

const start = new Date().getTime()
checkOutputFolders()
getPaths()
console.log(`Time to run: ${(new Date().getTime() - start) / 1000}`)
