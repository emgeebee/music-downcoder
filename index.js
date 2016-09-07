	"use strict";

	var fs = require('fs');
	var fse = require('fs-extra');
	var file = require('file');
	var term = require('child_process');
	var probe = require('node-ffprobe');
	var addArt = require('./addArt');
	var metaGetter = require('./getMeta');
	var path = require('path');

	var rate = "0";
	var numOfCores = 4;

//	var startLocation = "/Volumes/Travel/Music/ALAC/";
    // var startLocation = "/Volumes/Music/ALAC/";
    // var startLocation = "/Volumes/music/ALAC/";
    // var startLocation = "/Volumes/music/Dads\ vinyl/";
	// var startLocation = "/Volumes/usbshare2/Music/ALAC/";

    // var startLocation = "/Volumes/Music/Bootlegs/";
    var startLocation = "/Volumes/Itunes/Music/";
    // var startLocation = "/Users/mat/Music/ripping library/iTunes Media/Music/";
//	var startLocation = "/Users/mat/Music/music library/iTunes Media/Music/";
    // var startLocation = "/Users/mat/Music/Phile Audio/audio2/";

//	var outputLocation = "/Volumes/Travel/Music-new/" + rate + "/";
	// var outputLocation = "/Volumes/usbshare2/Music/" + rate + "/";
//	var outputLocation = "/Volumes/Dropbox/Car Music/";
    var outputLocation = "/Volumes/Music/" + rate + "/";
    // var outputLocation = "/Volumes/music/" + rate + "/";
//	var outputLocation = "/Volumes/Music/test2/" + rate + "/";
//	var outputLocation = "/Volumes/MOVIES/music/" + rate + "/";
//	var outputLocation = "/Volumes/X1/";
    // var outputLocation = "/Users/mat/Music/" + rate + "/";
    // var outputLocation = "/Users/mat/Music/Test/" + rate + "/";


	var commandFiles = "./commands.sh";
	var commandsFolder = './cmd/';
	var outputFormat = "mp3"
	var outputFormatExtension = "." + outputFormat;
	var outputFormatExtensionRegex = new RegExp('\.' + outputFormat);
	var commands = {};

	function getPaths(){
		file.walkSync(startLocation, checkFiles);
		writeCommands(commands);
	};

	function checkFiles(dirPath, dirs, files){
		var album = dirPath.replace(startLocation, '');
		var genre;
		var outputDir = outputLocation;
		var path;
		for (var i = files.length - 1; i >= 0; i--) {
			if (files[i][0] === '.') { continue; }
			if (outputFormat === 'cp' || outputFormatExtensionRegex.test(files[i])) {
				path = files[i];
			} else {
				path = files[i].replace(startLocation, '').replace('.m4a', outputFormatExtension).replace('.flac', outputFormatExtension);
				var regex = new RegExp(outputFormatExtension);
				if(!regex.test(path)){
					continue;
				}
			}
			//console.log(path);

			var r = buildCommand(dirPath, files[i], path, outputDir, album, genre);
			genre = r.genre;
			if (r.command === undefined){
				continue;
			}
			if(commands[album] === undefined){
				commands[album] = [];
			}
			commands[album] = commands[album].concat(r.command);

		};
	};

	function buildCommand(input, filename, path, outputDir, album, genre){

		input = input.replace(/[`]/g, '\`');
		filename = filename.replace(/[`]/g, '\`');

		if (genre === undefined){
			var meta = metaGetter.getMeta(input, filename);
			var genre = meta.genre;
		}
        if (!RegExp("\/").test(album)){
			var meta = metaGetter.getMeta(input, filename);
            album = meta.fullArtist + '/' + album;
        }
        var outputFolder = outputDir + genre + '/' + album;
		fse.ensureDir(outputFolder, afterDirectoryCreation.bind(null, outputFolder, meta));

		var output = outputFolder + '/' + path;
		var filepath = input + '/' + filename;

		if(!fs.existsSync(output)){
			filepath = filepath.replace(/[`\$\"]/g, '\\$&');
			output = output.replace(/[`\$\"]/g, '\\$&');

			if (outputFormat === 'cp' || outputFormatExtensionRegex.test(filepath)) {
				return addCopyCommands(filepath, output, genre);
			} else {
				return addEncodingCommands(filepath, output, genre);
			}

		} else {
			return {"genre": genre};
		}
	};

	function addEncodingCommands(filepath, output, genre) {
			var cmd = [];
			var metaFile = output.replace(outputFormat, 'txt');

			cmd.push('/Applications/ffmpeg -i "' + filepath + '" -f ffmetadata "' + metaFile + '"');
			cmd.push('sed -i".bak" "/^major_brand/d" "' + metaFile + '"');
			cmd.push('sed -i".bak" "/^minor_version/d" "' + metaFile + '"');
			cmd.push('sed -i".bak" "/^compatible_brands/d" "' + metaFile + '"');
			cmd.push('sed -i".bak" "/^gapless_playback/d" "' + metaFile + '"');
			cmd.push('sed -i".bak" "/^encoder/d" "' + metaFile + '"');

			//mp3
			cmd.push('/Applications/ffmpeg -i "' + filepath + '"  -i "' + metaFile + '" -map_metadata 1 -vn -c:a libmp3lame -ar 44100 -q:a ' + rate + ' -id3v2_version 3 -f ' + outputFormat + '  "' + output + '"');
			//ogg
			//cmd.push('/Applications/ffmpeg -i "' + filepath + '"  -i "' + metaFile + '" -map_metadata 1 -c:a libvorbis -ar 44100 -qscale:a ' + rate + ' -f ' + outputFormat + '  "' + output + '"');
			cmd.push('rm "' + metaFile + '"');
			cmd.push('rm "' + metaFile + '"');
			cmd.push('rm "' + metaFile + '.bak"');
			return {"command":cmd, "genre": genre};

	}

	function addCopyCommands(filepath, output, genre) {
			var cmd = [];

			//cp
			cmd.push('cp "' + filepath + '"  "' + output + '"');

			return {"command":cmd, "genre": genre};

	}

	function afterDirectoryCreation(albumpath, meta, err) {
		if (meta) {
			addArt.checkFiles(albumpath, meta);
			var artistPath = path.dirname(albumpath);
			addArt.checkArtistFile(artistPath, meta.fullArtist);
		}
	}

	function writeCommands(commands){
		var i = 0;

		for (var albums in commands) {
			var split;
			if (i === numOfCores) {
				i = 0;
			}

			fs.writeFileSync(commandsFolder + i + '/' + albums.replace('/', '_')+'-commands.sh', commands[albums].join('\n'));
			i++;

		};
	};

	getPaths();

