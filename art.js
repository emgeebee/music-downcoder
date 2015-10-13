"use strict"

var getter = require("album-art");
var request = require('request');
var fs = require('fs');

function art() {
	this.counters = {
		'inits': 0,
		'api_calls': 0,
		'api_errors': 0,
		'api_success': 0,
		'api_other': 0,
		'download_calls': 0,
		'download_errors': 0,
		'download_success': 0
	};
	this.running = {
		'lookup': false,
		'downloader': false
	};
	this.queues = {
		'api': [],
		'downloader': []
	};
	this.lists = {
		'api': {
			'failed': [],
			'other': []
		}
	}

	this.logger;
}

art.prototype = {
	getArt: function(artist, album, path) {
		this.queues.api.push({'album': album, 'artist': artist, 'size': 'biggest', 'dest': path});
		this.counters.inits++;
		if (!this.running.lookup) {
			this.checkGetterList.call(this);
			this.running.lookup = true;
			this.logger = setInterval(this.logState.bind(this), 1000);
		}
	},

	logState: function() {
		if (this.running.lookup === false && this.running.downloader === false) {
			console.log(this.counters);

			fs.writeFile('log/api_errors.json', JSON.stringify(this.lists.api.failed, 4));
			fs.writeFile('log/api_other.json', JSON.stringify(this.lists.api.other, 4));

			clearInterval(this.logger);
		}
	},

	checkGetterList: function() {
		if (this.queues.api.length > 0) {
			var item = this.queues.api.shift();
			this.lookupArt.call(this, item);
		} else {
			this.running.lookup = false;
		}
	},

	escapeArgs: function(input) {
		return input;
	},

	lookupArt: function(item) {
		var artist = item.artist ? this.escapeArgs(item.artist) : "";
		var album = item.album ? this.escapeArgs(item.album) : "";

		this.counters.api_calls++;
		getter(artist, album, item.size, this.onLookupSuccess.bind(this, item.dest, artist, album));
	},

	onLookupSuccess: function(dest, artist, album, err, src) {
		if (err) {
			//console.log('error! %s - %s: %s', artist, album, err);
			this.counters.api_errors++;
			this.lists.api.failed.push(artist + ': ' + album);
		} else if (src) {
			//console.log('success! %s - %s: %s', artist, album, src);
			this.addToList.call(this, dest, src);
			this.counters.api_success++;
		} else {
			//console.log('OTHER! %s - %s: %s', artist, album, src);
			this.counters.api_other++;
			this.lists.api.other.push(artist + ': ' + album);
		}
		this.checkGetterList.call(this);
	},

	addToList: function(dest, src) {
		this.queues.downloader.push({'src': src, 'dest': dest});
		if (!this.running.downloader) {
			this.checkList.call(this);
			this.running.downloader = true;
		}
	},

	checkList: function() {
		if (this.queues.downloader.length > 0) {
			this.downloadArt.call(this);
		} else {
			this.running.downloader = false;
		}
	},

	downloadError: function(){
		this.counters.download_errors++;
	},

	downloadSuccess: function(){
		this.counters.download_success++;
	},

	downloadArt: function() {
		var item = this.queues.downloader.shift();
		if (item.src) {
			//console.log('getting file for %s, current queue is %s, total %s', item.dest, this.queues.downloader.length, this.counter);
			this.counters.download_calls++;
			var downloader = request(item.src)
				.on('complete', this.checkList.bind(this))
				.on('complete', this.downloadSuccess.bind(this))
				.on('error', this.downloadError.bind(this))
				.pipe(fs.createWriteStream(item.dest + '/folder.jpg'));
		} else {
			this.checkList.call(this)
		}
	}
}

module.exports = new art();