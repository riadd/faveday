/**
 * MediaPlayer - the player that fills the app window
 *
 * Shows one day's videos and photos, or plays a list of days. A list plays as one
 * joined video file, so there is no switch between clips that could be noticed.
 */
class MediaPlayer {
  constructor(manager) {
    this.manager = manager;
    this.isOpen = false;
    this.muted = false;
    this.request = 0;

    this.modal = document.getElementById('media-modal');
    this.video = document.getElementById('media-modal-video');
    this.photo = document.getElementById('media-modal-photo');
    this.status = document.getElementById('media-modal-status');
    this.title = document.getElementById('media-modal-title');
    this.counter = document.getElementById('media-modal-counter');
    this.playButton = document.getElementById('media-modal-play');
    this.muteButton = document.getElementById('media-modal-mute');
    this.listButton = document.getElementById('media-modal-list');
    this.prevButton = document.getElementById('media-modal-prev');
    this.nextButton = document.getElementById('media-modal-next');

    this.playButton.addEventListener('click', () => this.togglePlay());
    this.video.addEventListener('click', () => this.togglePlay());
    this.muteButton.addEventListener('click', () => this.toggleMute());
    this.listButton.addEventListener('click', () => this.startList(this.dateId));
    this.prevButton.addEventListener('click', () => this.step(-1));
    this.nextButton.addEventListener('click', () => this.step(1));
    document.getElementById('media-modal-close').addEventListener('click', () => this.close());

    this.video.addEventListener('play', () => this.updatePlayButton());
    this.video.addEventListener('pause', () => this.updatePlayButton());
    this.video.addEventListener('playing', () => this.setStatus(''));
    this.video.addEventListener('waiting', () => this.setStatus('Loading'));
    this.video.addEventListener('error', () => this.onVideoFailed());
    this.video.addEventListener('loadedmetadata', () => {
      // A format without a decoder can load as sound only.
      if (this.video.videoWidth === 0) this.onVideoFailed();
    });

    this.modal.addEventListener('mousemove', () => this.wakeControls());
    document.addEventListener('keydown', event => this.onKeyDown(event), true);
  }

  // ==================== OPEN AND CLOSE ====================

  /** Opens one day at the given file, or at its main video. */
  openDay(dateId, playlist, file = null) {
    const day = this.manager.days[dateId];
    this.mode = 'day';
    this.dateId = dateId;
    this.playlist = playlist;
    this.items = day.items;
    const start = file || this.manager.displayItem(day).file;
    this.itemIndex = this.items.findIndex(item => item.file === start);

    this.show();
    this.showItem();
  }

  openList(dateIds) {
    if (dateIds.length === 0) return;
    this.playlist = dateIds;
    this.show();
    this.startList(dateIds[0]);
  }

  show() {
    this.isOpen = true;
    this.modal.classList.remove('hidden');
    this.manager.setThumbsPaused(true);
    this.video.muted = this.muted;
    this.updateMuteButton();
    this.wakeControls();
  }

  close() {
    this.isOpen = false;
    this.request++;
    cancelAnimationFrame(this.listFrame);
    clearTimeout(this.idleTimer);
    this.stopVideo();
    this.photo.removeAttribute('src');
    this.modal.classList.add('hidden');
    this.setStatus('');
    if (this.mode === 'list') window.api.removeMediaReel();
    this.manager.setThumbsPaused(false);
  }

  stopVideo() {
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load();
    this.video.classList.add('hidden');
  }

  setStatus(text) {
    this.status.textContent = text;
  }

  dayTitle(dateId) {
    return new Date(dateId).format('{d} {Month} {yyyy}, {Weekday}');
  }

  // ==================== ONE DAY ====================

  showItem() {
    const item = this.items[this.itemIndex];
    this.request++;
    this.setStatus('');
    this.title.textContent = this.dayTitle(this.dateId);
    this.counter.textContent = this.items.length > 1 ? `${this.itemIndex + 1} of ${this.items.length}` : '';
    this.setControls({ isVideo: item.kind === 'video', canStep: this.items.length > 1, listSize: this.playlist.length });

    if (item.kind === 'photo') {
      this.stopVideo();
      this.photo.src = item.url;
      this.photo.classList.remove('hidden');
      return;
    }

    this.photo.classList.add('hidden');
    this.triedFullCopy = false;
    this.playUrl(item.url);
    this.setStatus('Loading');
  }

  playUrl(url) {
    this.video.classList.remove('hidden');
    this.video.src = url;
    this.video.play().catch(() => {});
  }

  /** The original can't be decoded here, so play a converted copy instead. */
  async onVideoFailed() {
    if (!this.isOpen) return;
    if (this.mode !== 'day' || this.triedFullCopy) {
      this.setStatus('This video could not be played.');
      return;
    }

    this.triedFullCopy = true;
    const request = this.request;
    this.setStatus('Preparing this video');
    try {
      const url = await window.api.mediaFullCopyUrl(this.dateId, this.items[this.itemIndex].file);
      if (request === this.request) this.playUrl(url);
    } catch (error) {
      console.error('Failed to convert video:', error);
      if (request === this.request) this.setStatus('This video could not be played.');
    }
  }

  // ==================== A LIST OF DAYS ====================

  /** Plays from the given day to the newest, then from the oldest up to the day before it. */
  async startList(startDateId) {
    const start = Math.max(this.playlist.indexOf(startDateId), 0);
    const order = [...this.playlist.slice(start), ...this.playlist.slice(0, start)];
    const request = ++this.request;

    this.mode = 'list';
    this.reel = null;
    this.stopVideo();
    this.photo.classList.add('hidden');
    this.counter.textContent = '';
    this.setControls({ isVideo: true, canStep: true, listSize: 0 });
    this.setStatus(`Preparing ${order.length === 1 ? '1 video' : `${order.length} videos`}`);

    let reel;
    try {
      reel = await window.api.buildMediaReel(order);
    } catch (error) {
      console.error('Failed to join clips:', error);
      if (request === this.request) this.setStatus('The videos could not be joined.');
      return;
    }
    if (request !== this.request) return;
    if (!reel.url) {
      this.setStatus('These videos are still being prepared.');
      return;
    }

    this.reel = reel;
    this.reelIndex = -1;
    this.setStatus('');
    this.playUrl(reel.url);
    this.trackList();
  }

  trackList() {
    const index = this.currentReelIndex();
    if (index !== this.reelIndex) {
      this.reelIndex = index;
      const { dateIds, missing } = this.reel;
      this.title.textContent = this.dayTitle(dateIds[index]);
      const waiting = missing > 0 ? `, ${missing} still being prepared` : '';
      this.counter.textContent = `${index + 1} of ${dateIds.length}${waiting}`;
    }
    this.listFrame = requestAnimationFrame(() => this.trackList());
  }

  currentReelIndex() {
    const index = Math.floor(this.video.currentTime / this.reel.clipSeconds);
    return Math.min(index, this.reel.dateIds.length - 1);
  }

  // ==================== CONTROLS ====================

  setControls({ isVideo, canStep, listSize }) {
    this.playButton.classList.toggle('hidden', !isVideo);
    this.muteButton.classList.toggle('hidden', !isVideo);
    this.prevButton.classList.toggle('hidden', !canStep);
    this.nextButton.classList.toggle('hidden', !canStep);
    this.listButton.classList.toggle('hidden', listSize < 2);
    this.listButton.textContent = `Play ${listSize} videos`;
  }

  togglePlay() {
    if (this.video.paused) this.video.play().catch(() => {});
    else this.video.pause();
  }

  updatePlayButton() {
    this.playButton.textContent = this.video.paused ? 'Play' : 'Pause';
  }

  toggleMute() {
    this.muted = !this.muted;
    this.video.muted = this.muted;
    this.updateMuteButton();
  }

  updateMuteButton() {
    this.muteButton.textContent = this.muted ? 'Unmute' : 'Mute';
  }

  step(direction) {
    if (this.mode === 'list') {
      if (!this.reel) return;
      const target = this.currentReelIndex() + direction;
      if (target < 0 || target >= this.reel.dateIds.length) return;
      this.video.currentTime = target * this.reel.clipSeconds;
    } else if (this.items.length > 1) {
      this.itemIndex = (this.itemIndex + direction + this.items.length) % this.items.length;
      this.showItem();
    }
  }

  onKeyDown(event) {
    if (!this.isOpen) return;
    const actions = {
      Escape: () => this.close(),
      ArrowLeft: () => this.step(-1),
      ArrowRight: () => this.step(1),
      ' ': () => this.togglePlay(),
      m: () => this.toggleMute()
    };
    event.stopPropagation();
    if (actions[event.key]) {
      event.preventDefault();
      actions[event.key]();
    }
  }

  /** The controls and the pointer disappear while nothing moves, so only the video is left. */
  wakeControls() {
    this.modal.classList.remove('idle');
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.modal.classList.add('idle'), 2500);
  }
}
