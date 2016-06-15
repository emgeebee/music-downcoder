# Music Downcoder

A simple console based app which looks in 2 folders (src and dest) and generates some unix bash files which contain commands for ffmpeg to transcode your music.

## How to use

1. Edit index.js with a src, dest and a rate. Where rate is the ffmpeg rate. You can also modify 'numOfCores' if you want to run your batches on multiple cores.
2. Run `node index.js`
3. You will see in the cmd folder one folder per core with a list of commands, one per album
4. You will also see in your dest folder lots of new folders with album art!
5. You can now run `./batch.sh x` (where x is the core number) for each of the cores

## Future

It would be nice to turn this into an electron app so that folders (and cores, rates) can be selected via a UI
