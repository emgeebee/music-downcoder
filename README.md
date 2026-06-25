# Music Downcoder

A TypeScript CLI and web UI that scans music folders and generates bash scripts with ffmpeg commands to transcode your music library. Supports multiple encoders (mp3, ogg, ALAC copy) and parallel execution.

Published as [`@emgeebee/music_downcoder`](https://www.npmjs.com/package/@emgeebee/music_downcoder) on npm.

## Quick start (npx)

```bash
# Interactive CLI (uses built-in defaults)
npx @emgeebee/music_downcoder

# Web UI on port 3798
npx @emgeebee/music_downcoder serve -c /path/to/conf.json -H 0.0.0.0 -p 3798
```

Open `http://localhost:3798` to pick source folder, encoders, and artist filter. After scripts are generated under `cmd/`, the UI lists them and lets you run individually or all at once.

## Configuration

All paths and encoder settings live in a JSON config file. See [`docker/conf.json`](docker/conf.json) for a Synology/Docker example:

- `ffmpeg` — path to ffmpeg binary
- `startFolders` — source library folders shown in the UI/CLI
- `encoders` — output folders and formats (mp3, ogg, cp)
- `commandsFolder`, `queueFolder`, `metaFile` — working directories
- `numOfCores`, `rate`, `autoConfirm`

```bash
npx @emgeebee/music_downcoder -c ./docker/conf.json
```

## Synology / Docker

See [`docker/synology-compose.yml`](docker/synology-compose.yml). Copy `docker/conf.json` to your NAS config volume and adjust paths. The container runs:

```bash
npx @emgeebee/music_downcoder serve -H 0.0.0.0 -p 3798 -c /data/config/conf.json
```

## Development

```bash
npm install
npm start                    # CLI
npm run serve -- -c docker/conf.json -p 3798   # web UI
npm run build
```

## npm publish

Pushes to npm on merge to `main`/`master` via [`.github/workflows/publish.yml`](.github/workflows/publish.yml). Add an `NPM_TOKEN` secret to the repository (npm automation token with publish access to `@emgeebee`).

## How it works

1. Walk the selected music directory
2. Extract/cache metadata (artist, album, genre, year) via ffmpeg
3. Generate ffmpeg/rsync commands per encoder
4. Write scripts to `cmd/{core}/`
5. Optionally execute via CLI or web UI
