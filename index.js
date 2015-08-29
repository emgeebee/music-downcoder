
	"use strict";

	var fs = require('fs');
	var fse = require('fs-extra');
	var file = require('file');
	var term = require('child_process');
	var probe = require('node-ffprobe');

	var rate = "4";
	var numOfCores = 3;

	var startLocation = "/Volumes/Travel/Music/ALAC/";
	//var startLocation = "/Volumes/Itunes/Music/";


	var outputLocation = "/Volumes/Travel/Music-new/" + rate + "/";
	//var outputLocation = "/Volumes/Music/" + rate + "/";


	var commandFiles = "./commands.sh";
	var commandsFolder = './cmd/';
	var outputFormat = ".mp3";
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
			path = files[i].replace(startLocation, '').replace('.m4a', outputFormat).replace('.flac', outputFormat);
			//console.log(path);

			var regex = new RegExp(outputFormat);
			if(!regex.test(path)){
				continue;
			}

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

		input = input + '/' + filename;

		var tempin = input.replace(/[`]/g, '\`');
		if(genre === undefined){
			var meta = term.execSync('/Applications/ffmpeg -y -i "' + tempin + '" -f ffmetadata pipe:1', {"encoding": "utf-8"});
			genre = meta.match(/genre.*/g)[0].split('=')[1];
		}

		var outputFolder = outputDir + genre + '/' + album;
		fse.ensureDirSync(outputFolder);

		var output = outputFolder + '/' + path;

		if(!fs.existsSync(output)){

			input = input.replace(/[`\$\"]/g, '\\$&');
			output = output.replace(/[`\$\"]/g, '\\$&');
			var metaFile = output.replace(outputFormat, '.txt');

			var cmd = [];
			cmd.push('/Applications/ffmpeg -i "' + input + '" -f ffmetadata "' + metaFile + '"');
			cmd.push('sed -i".bak" "/^major_brand/d" "' + metaFile + '"');
			cmd.push('sed -i".bak" "/^minor_version/d" "' + metaFile + '"');
			cmd.push('sed -i".bak" "/^compatible_brands/d" "' + metaFile + '"');
			cmd.push('sed -i".bak" "/^gapless_playback/d" "' + metaFile + '"');
			cmd.push('sed -i".bak" "/^encoder/d" "' + metaFile + '"');
			cmd.push('/Applications/ffmpeg -i "' + input + '"  -i "' + metaFile + '" -map_metadata 1 -c:a libmp3lame -ar 44100 -q:a ' + rate + ' -id3v2_version 3 -f mp3  "' + output + '"');
			cmd.push('rm "' + metaFile + '"');
			cmd.push('rm "' + metaFile + '"');
			cmd.push('rm "' + metaFile + '.bak"');
			return {"command":cmd, "genre": genre};
		} else {
			return {"genre": genre};
		}
	};

	function writeCommands(commands){
		var alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
		var bounds = [];

		for (var i = 0; i <= numOfCores; i++) {
			var core = i;
			fse.ensureDirSync(commandsFolder + core + '/');
			bounds[i] = core/numOfCores;
		}

		for (var albums in commands) {
			var split;
			var posInBet = alphabet.indexOf(albums[0].toUpperCase());
			var fracOfBet = posInBet/(alphabet.length + 1)

			for (var j = bounds.length - 1; j >= 0; j--) {
				if (bounds[j-1] === undefined || (fracOfBet > bounds[j-1] && fracOfBet < bounds[j])) {
					fs.writeFileSync(commandsFolder + j + '/' + albums.replace('/', '_')+'-commands.sh', commands[albums].join('\n'));
					break;
				}
			};

		};
	};

	getPaths();

