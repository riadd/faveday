/**
 * MediaStore - videos and photos attached to days (main process)
 *
 * Originals live in <data folder>/media/<year>/ and the record of what belongs to
 * which day in <data folder>/media/media.json. The small uniform copies are made
 * with ffmpeg and live in a cache on this machine, so they get remade per machine.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi', '.3gp']);
const PHOTO_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif']);
const DATE_ID = /^\d{4}-\d{2}-\d{2}$/;

const CLIP_SECONDS = 2;
const CONCURRENT_COPIES = 2;
const FFMPEG_TIMEOUT_MS = 10 * 60 * 1000;

class MediaStore {
  /**
   * @param {object} options
   * @param {() => string} options.getDataDir - current data folder
   * @param {string} options.cacheDir - folder for copies on this machine
   * @param {string} options.ffmpegPath - path of the ffmpeg binary
   * @param {(update: object) => void} options.onVideoUpdate - a video's copies are ready or failed
   */
  constructor({ getDataDir, cacheDir, ffmpegPath, onVideoUpdate }) {
    this.getDataDir = getDataDir;
    this.cacheDir = cacheDir;
    this.ffmpegPath = ffmpegPath;
    this.onVideoUpdate = onVideoUpdate;

    this.days = {};
    this.loadedDir = null;
    this.copyErrors = new Map();
    this.queue = [];
    this.queued = new Set();
    this.running = 0;
    this.writeChain = Promise.resolve();
    this.currentReel = null;
  }

  // ==================== RECORD ====================

  recordPath() {
    return path.join(this.getDataDir(), 'media', 'media.json');
  }

  absolutePath(file) {
    return path.join(this.getDataDir(), 'media', ...file.split('/'));
  }

  /** Reads the record and starts making any copies this machine is missing. */
  async load() {
    this.loadedDir = null;
    this.days = {};
    this.copyErrors.clear();

    let text = null;
    try {
      text = await fs.promises.readFile(this.recordPath(), 'utf-8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (text !== null) this.days = JSON.parse(text);
    this.loadedDir = this.getDataDir();

    await fs.promises.mkdir(this.cacheDir, { recursive: true });
    await this.removeReelFiles();

    const view = await this.dayViews();
    for (const day of Object.values(this.days)) {
      for (const item of day.items) this.requestCopies(item);
    }
    return view;
  }

  assertLoaded() {
    // A record that failed to read must never be overwritten with an empty one.
    if (this.loadedDir !== this.getDataDir()) {
      throw new Error('The media record could not be read.');
    }
  }

  saveRecord() {
    const write = async () => {
      const target = this.recordPath();
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      const partial = `${target}.partial`;
      await fs.promises.writeFile(partial, JSON.stringify(this.days, null, 1), 'utf-8');
      await fs.promises.rename(partial, target);
    };
    this.writeChain = this.writeChain.then(write, write);
    return this.writeChain;
  }

  async itemView(item) {
    const view = { file: item.file, kind: item.kind, name: path.basename(item.file), url: pathToFileURL(this.absolutePath(item.file)).href };
    if (item.kind === 'video') {
      const { thumb } = this.cachePaths(item);
      view.thumbUrl = (await pathExists(thumb)) ? pathToFileURL(thumb).href : null;
      view.error = this.copyErrors.get(item.file) || null;
    }
    return view;
  }

  async dayView(dateId) {
    const day = this.days[dateId];
    if (!day) return null;
    return { main: day.main, items: await Promise.all(day.items.map(item => this.itemView(item))) };
  }

  async dayViews() {
    const views = {};
    for (const dateId of Object.keys(this.days)) views[dateId] = await this.dayView(dateId);
    return views;
  }

  // ==================== ADD, REMOVE, MAIN ====================

  /** Copies dropped files into the data folder. The first video of a day becomes its main video. */
  async addFiles(dateId, sourcePaths) {
    this.assertLoaded();
    if (!DATE_ID.test(dateId)) throw new Error(`Not a valid day: ${dateId}`);

    const added = [];
    const skipped = [];
    for (const source of sourcePaths) {
      const name = path.basename(source);
      const kind = mediaKind(name);
      if (!kind) {
        skipped.push({ name, reason: unsupportedReason(name) });
        continue;
      }
      try {
        const size = (await fs.promises.stat(source)).size;
        const day = this.days[dateId] || { main: null, items: [] };
        if (day.items.some(item => item.size === size && path.basename(item.file).endsWith(name))) {
          skipped.push({ name, reason: 'This day already has this file.' });
          continue;
        }

        const file = await this.copyIntoDataFolder(source, dateId, name);
        const item = { file, kind, size };
        this.days[dateId] = day;
        day.items.push(item);
        if (kind === 'video' && !day.main) day.main = file;
        await this.saveRecord();
        this.requestCopies(item);
        added.push(file);
      } catch (error) {
        skipped.push({ name, reason: copyFailureReason(error) });
      }
    }
    return { added, skipped, day: await this.dayView(dateId) };
  }

  async copyIntoDataFolder(source, dateId, name) {
    const year = dateId.slice(0, 4);
    const folder = path.join(this.getDataDir(), 'media', year);
    await fs.promises.mkdir(folder, { recursive: true });

    const ext = path.extname(name);
    const stem = `${dateId} ${path.basename(name, ext)}`;
    let fileName = `${stem}${ext}`;
    for (let n = 2; await pathExists(path.join(folder, fileName)); n++) {
      fileName = `${stem} ${n}${ext}`;
    }

    const target = path.join(folder, fileName);
    const partial = `${target}.partial`;
    try {
      await fs.promises.copyFile(source, partial);
      await fs.promises.rename(partial, target);
    } catch (error) {
      await fs.promises.rm(partial, { force: true });
      throw error;
    }
    return `${year}/${fileName}`;
  }

  requireItem(dateId, file) {
    const item = this.days[dateId]?.items.find(candidate => candidate.file === file);
    if (!item) throw new Error('This file is no longer attached to the day.');
    return item;
  }

  async setMain(dateId, file) {
    this.assertLoaded();
    const item = this.requireItem(dateId, file);
    if (item.kind !== 'video') throw new Error('Only a video can be the main video.');
    this.days[dateId].main = file;
    await this.saveRecord();
    return this.dayView(dateId);
  }

  /** Removes the file from the day and the data folder. The next video becomes main if needed. */
  async removeItem(dateId, file) {
    this.assertLoaded();
    const item = this.requireItem(dateId, file);
    const day = this.days[dateId];

    await fs.promises.rm(this.absolutePath(file), { force: true });
    day.items = day.items.filter(candidate => candidate !== item);
    if (day.main === file) {
      day.main = day.items.find(candidate => candidate.kind === 'video')?.file || null;
    }
    if (day.items.length === 0) delete this.days[dateId];
    await this.saveRecord();

    for (const copy of Object.values(this.cachePaths(item))) {
      await fs.promises.rm(copy, { force: true });
    }
    return this.dayView(dateId);
  }

  // ==================== COPIES ====================

  cachePaths(item) {
    const key = crypto.createHash('sha1').update(`${item.file}|${item.size}`).digest('hex').slice(0, 20);
    return {
      thumb: path.join(this.cacheDir, `${key}-thumb.mp4`),
      clip: path.join(this.cacheDir, `${key}-clip.mp4`),
      full: path.join(this.cacheDir, `${key}-full.mp4`)
    };
  }

  requestCopies(item) {
    if (item.kind !== 'video' || this.queued.has(item.file)) return;
    this.queued.add(item.file);
    this.queue.push(item);
    this.runQueue();
  }

  runQueue() {
    while (this.running < CONCURRENT_COPIES && this.queue.length > 0) {
      const item = this.queue.shift();
      this.running++;
      this.makeCopies(item).finally(() => {
        this.running--;
        this.queued.delete(item.file);
        this.runQueue();
      });
    }
  }

  async makeCopies(item) {
    const { thumb, clip } = this.cachePaths(item);
    if ((await pathExists(thumb)) && (await pathExists(clip))) return;

    try {
      await this.encodeClipAndThumb(this.absolutePath(item.file), clip, thumb);
      this.copyErrors.delete(item.file);
    } catch (error) {
      console.error(`Could not make copies of ${item.file}:`, error.message);
      this.copyErrors.set(item.file, 'This video could not be read.');
    }
    this.onVideoUpdate({ file: item.file, view: await this.itemView(item) });
  }

  /**
   * Every clip gets the same size, frame rate, audio format and exact length,
   * so that clips can be joined without re-encoding and the joins can't be seen.
   */
  async encodeClipAndThumb(source, clip, thumb) {
    const hasAudio = await this.hasAudioStream(source);
    const audioInput = hasAudio ? '0:a:0' : '1:a';
    const filter = [
      `[0:v:0]fps=30,tpad=stop_mode=clone:stop_duration=${CLIP_SECONDS},trim=duration=${CLIP_SECONDS},setpts=PTS-STARTPTS,split=2[forClip][forThumb]`,
      '[forClip]scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[clip]',
      '[forThumb]scale=160:120:force_original_aspect_ratio=increase,crop=160:120,setsar=1,format=yuv420p[thumb]',
      `[${audioInput}]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration=${CLIP_SECONDS}[audio]`
    ].join(';');

    const clipPartial = `${clip}.partial.mp4`;
    const thumbPartial = `${thumb}.partial.mp4`;
    const args = ['-hide_banner', '-loglevel', 'error', '-y', '-t', String(CLIP_SECONDS), '-i', source];
    if (!hasAudio) args.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
    args.push('-filter_complex', filter);
    args.push('-map', '[clip]', '-map', '[audio]',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-g', '30', '-video_track_timescale', '30000',
      '-c:a', 'aac', '-b:a', '128k', clipPartial);
    args.push('-map', '[thumb]', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', thumbPartial);

    try {
      await this.runFfmpeg(args);
      await fs.promises.rename(clipPartial, clip);
      await fs.promises.rename(thumbPartial, thumb);
    } finally {
      await fs.promises.rm(clipPartial, { force: true });
      await fs.promises.rm(thumbPartial, { force: true });
    }
  }

  async hasAudioStream(source) {
    // With only an input ffmpeg prints the streams and exits with an error, which is expected.
    const stderr = await this.runFfmpeg(['-hide_banner', '-i', source], { allowFailure: true });
    return /Stream #\S+.*Audio:/.test(stderr);
  }

  runFfmpeg(args, { allowFailure = false } = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(this.ffmpegPath, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      const timer = setTimeout(() => child.kill(), FFMPEG_TIMEOUT_MS);

      child.stderr.on('data', chunk => {
        stderr = (stderr + chunk).slice(-8000);
      });
      child.on('error', error => {
        clearTimeout(timer);
        reject(error.code === 'ENOENT' ? new Error(`ffmpeg not found at ${this.ffmpegPath}`) : error);
      });
      child.on('close', (code, signal) => {
        clearTimeout(timer);
        if (signal) reject(new Error(`ffmpeg timed out after ${FFMPEG_TIMEOUT_MS / 60000} minutes`));
        else if (code !== 0 && !allowFailure) reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-500)}`));
        else resolve(stderr);
      });
    });
  }

  /** A full length copy for an original the player can't decode (an HEVC phone video, for example). */
  async fullCopyUrl(dateId, file) {
    const item = this.requireItem(dateId, file);
    const { full } = this.cachePaths(item);
    if (!(await pathExists(full))) {
      const partial = `${full}.partial.mp4`;
      try {
        await this.runFfmpeg(['-hide_banner', '-loglevel', 'error', '-y', '-i', this.absolutePath(file),
          '-vf', "scale='min(1920,iw)':-2,format=yuv420p", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21',
          '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', partial]);
        await fs.promises.rename(partial, full);
      } finally {
        await fs.promises.rm(partial, { force: true });
      }
    }
    return pathToFileURL(full).href;
  }

  // ==================== CONTINUOUS PLAYBACK ====================

  /**
   * Joins the clips of the given days into one video file, so the player never has to switch.
   * Days whose clip isn't made yet are left out.
   * @param {string[]} dateIds - in playing order
   */
  async buildReel(dateIds) {
    await this.removeReelFiles();

    const included = [];
    const lines = [];
    for (const dateId of dateIds) {
      const day = this.days[dateId];
      if (!day?.main) continue;
      const { clip } = this.cachePaths(this.requireItem(dateId, day.main));
      if (!(await pathExists(clip))) continue;
      included.push(dateId);
      lines.push(`file '${clip.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`, `duration ${CLIP_SECONDS}`);
    }
    if (included.length === 0) return { dateIds: [], url: null, clipSeconds: CLIP_SECONDS, missing: dateIds.length };

    const stamp = Date.now();
    const listPath = path.join(this.cacheDir, `reel-${stamp}.list`);
    const reelPath = path.join(this.cacheDir, `reel-${stamp}.mp4`);
    await fs.promises.writeFile(listPath, lines.join('\n'), 'utf-8');
    try {
      await this.runFfmpeg(['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', reelPath]);
    } finally {
      await fs.promises.rm(listPath, { force: true });
    }
    return { dateIds: included, url: pathToFileURL(reelPath).href, clipSeconds: CLIP_SECONDS, missing: dateIds.length - included.length };
  }

  async removeReelFiles() {
    const names = await fs.promises.readdir(this.cacheDir).catch(() => []);
    await Promise.all(names.filter(name => name.startsWith('reel-')).map(name =>
      fs.promises.rm(path.join(this.cacheDir, name), { force: true }).catch(error => {
        console.warn(`Could not remove ${name}:`, error.message);
      })));
  }
}

function mediaKind(name) {
  const ext = path.extname(name).toLowerCase();
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (PHOTO_EXTENSIONS.has(ext)) return 'photo';
  return null;
}

function unsupportedReason(name) {
  const ext = path.extname(name).toLowerCase();
  if (ext === '.heic' || ext === '.heif') return 'HEIC photos can not be shown. Save the photo as JPEG and drop it again.';
  return 'Only videos and photos can be added.';
}

function copyFailureReason(error) {
  if (error.code === 'ENOSPC') return 'The data folder drive is full.';
  if (error.code === 'ENOENT') return 'The file could not be found. Is it still at the same place?';
  if (error.code === 'EACCES' || error.code === 'EPERM') return 'FaveDay has no permission to copy this file.';
  return `The file could not be copied (${error.code || error.message}).`;
}

async function pathExists(target) {
  try {
    await fs.promises.access(target);
    return true;
  } catch {
    return false;
  }
}

module.exports = MediaStore;
