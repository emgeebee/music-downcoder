const rate = "0";
exports.rate = rate;
exports.commandFiles = "./commands.sh";
exports.commandsFolder = './cmd/';
exports.numOfCores = 4;
exports.config = {
    "main": {
        "start": "/Volumes/Itunes/Music/",
        "out": "/Volumes/Music/cds-mp3/",
        "format": "mp3"
    },
    "ogg": {
        "start": "/Volumes/Itunes/Music/",
        "out": "/Volumes/Music/cds-ogg/",
        "format": "ogg",
        "getImages": false
    },
    "alac": {
        "start": "/Volumes/Itunes/Music/",
        "out": "/Volumes/Music/cds-alac/",
        "format": "cp",
        "getImages": false
    },
    "local": {
        "start": "/Users/mat/Music/Phile Audio/audio2/",
        "out": "/Users/mat/Music/" + rate + "/"
    },
    "localitunes": {
        "start": "/Users/mat/Music/ripping library/iTunes Media/Music/",
        "out": "/Users/mat/Music/" + rate + "/"
    }
};
