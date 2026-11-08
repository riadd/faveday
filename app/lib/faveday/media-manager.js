/**
 * MediaManager - videos and photos attached to days (renderer)
 *
 * Holds the media of every day, renders the media column and the edit screen list,
 * takes file drops, and keeps only the thumbnails on screen playing.
 */
class MediaManager {
  constructor(app) {
    this.app = app;
    this.days = {};
    this.adding = new Set();
    this.editDateId = null;
    this.playlistFilter = null;
    this.visibleThumbs = new Set();
    this.thumbsPaused = false;
    this.player = new MediaPlayer(this);

    this.tmplCell = Hogan.compile($('#tmpl-media-cell').html());
    this.tmplEdit = Hogan.compile($('#tmpl-edit-media').html());

    this.thumbObserver = new IntersectionObserver(entries => this.onThumbsVisibility(entries), { rootMargin: '200px' });
    const contentObserver = new MutationObserver(() => this.onPageChanged());
    contentObserver.observe(document.getElementById('content'), { childList: true, subtree: true });
    contentObserver.observe(document.getElementById('editScoreMedia'), { childList: true, subtree: true });

    window.api.onMediaVideoUpdate(update => this.onVideoUpdate(update));
    this.wireDrop();
  }

  async load() {
    try {
      this.days = await window.api.loadMedia();
    } catch (error) {
      console.error('Failed to load media:', error);
      this.days = {};
      this.app.showToaster('media.json in the data folder could not be read. Videos and photos are hidden.', 'error', 8000);
    }
  }

  // ==================== RENDERING ====================

  displayItem(day) {
    return day.items.find(item => item.file === day.main) || day.items[0];
  }

  thumbData(item) {
    if (item.kind === 'photo') return { photoUrl: item.url };
    if (item.error) return { status: "Can't read", title: item.error };
    if (!item.thumbUrl) return { status: 'Preparing' };
    return { thumbUrl: item.thumbUrl };
  }

  cellHtml(dateId) {
    if (this.adding.has(dateId)) return this.tmplCell.render({ adding: true });
    const day = this.days[dateId];
    if (!day) return '';
    return this.tmplCell.render({
      dateId,
      item: this.thumbData(this.displayItem(day)),
      extraCount: day.items.length > 1 ? day.items.length - 1 : null
    });
  }

  hasMedia(dateId) {
    return Boolean(this.days[dateId]);
  }

  refreshDay(dateId) {
    document.querySelectorAll(`tr.score[data-date-id="${dateId}"]`).forEach(row => {
      row.querySelector('div.date-media').innerHTML = this.cellHtml(dateId);
      if (this.hasMedia(dateId)) row.classList.remove('empty');
    });
    if (dateId === this.editDateId) this.renderEditList();
    this.onPageChanged();
  }

  onVideoUpdate({ file, view }) {
    for (const [dateId, day] of Object.entries(this.days)) {
      const index = day.items.findIndex(item => item.file === file);
      if (index >= 0) {
        day.items[index] = view;
        this.refreshDay(dateId);
        return;
      }
    }
  }

  // ==================== EDIT SCREEN ====================

  showEditDay(dateId, isFutureEntry) {
    this.editDateId = isFutureEntry ? null : dateId;
    this.renderEditList();
  }

  renderEditList() {
    const container = document.getElementById('editScoreMedia');
    const day = this.days[this.editDateId];
    const adding = this.adding.has(this.editDateId);
    if (!day && !adding) {
      container.innerHTML = '';
      return;
    }

    const items = (day ? day.items : []).map((item, index) => ({
      index,
      thumb: this.thumbData(item),
      isMain: item.file === day.main,
      canMakeMain: item.kind === 'video' && item.file !== day.main
    }));
    container.innerHTML = this.tmplEdit.render({ items, adding });
  }

  editItem(index) {
    return this.days[this.editDateId].items[index];
  }

  async setMainVideo(index) {
    const dateId = this.editDateId;
    try {
      this.days[dateId] = await window.api.setMainVideo(dateId, this.editItem(index).file);
      this.refreshDay(dateId);
    } catch (error) {
      this.app.showToaster(error.message, 'error');
    }
  }

  /** The first click asks, the second click removes. */
  async removeItem(button, index) {
    if (!button.classList.contains('confirm')) {
      button.classList.add('confirm');
      button.textContent = 'Remove?';
      setTimeout(() => {
        button.classList.remove('confirm');
        button.textContent = 'Remove';
      }, 3000);
      return;
    }

    const dateId = this.editDateId;
    try {
      const day = await window.api.removeMedia(dateId, this.editItem(index).file);
      if (day) this.days[dateId] = day;
      else delete this.days[dateId];
      this.refreshDay(dateId);
    } catch (error) {
      this.app.showToaster(error.message, 'error');
    }
  }

  // ==================== DRAG AND DROP ====================

  wireDrop() {
    // Without this Electron navigates the whole window to any file dropped outside a target.
    document.addEventListener('dragover', event => {
      event.preventDefault();
      const target = this.dropTarget(event);
      event.dataTransfer.dropEffect = target ? 'copy' : 'none';
      this.highlightDropTarget(target);
    });
    document.addEventListener('dragleave', event => {
      if (!event.relatedTarget) this.highlightDropTarget(null);
    });
    document.addEventListener('drop', event => {
      event.preventDefault();
      const target = this.dropTarget(event);
      this.highlightDropTarget(null);
      if (!target) return;
      const paths = [...event.dataTransfer.files].map(file => window.api.getPathForFile(file));
      this.attach(target.dateId, paths);
    });
  }

  dropTarget(event) {
    if (!event.dataTransfer.types.includes('Files') || this.player.isOpen) return null;

    const editScreen = document.getElementById('editScore');
    if ($(editScreen).is(':visible')) {
      return this.editDateId ? { element: editScreen, dateId: this.editDateId } : null;
    }
    const row = event.target.closest ? event.target.closest('tr.score[data-date-id]') : null;
    return row ? { element: row, dateId: row.dataset.dateId } : null;
  }

  highlightDropTarget(target) {
    const element = target ? target.element : null;
    if (this.dropElement === element) return;
    if (this.dropElement) this.dropElement.classList.remove('media-drop-target');
    if (element) element.classList.add('media-drop-target');
    this.dropElement = element;
  }

  async attach(dateId, paths) {
    this.adding.add(dateId);
    this.refreshDay(dateId);
    try {
      const result = await window.api.addMedia(dateId, paths);
      if (result.day) this.days[dateId] = result.day;
      this.reportAttach(dateId, result);
    } catch (error) {
      console.error('Failed to add media:', error);
      this.app.showToaster(error.message, 'error');
    }
    this.adding.delete(dateId);
    this.refreshDay(dateId);
  }

  reportAttach(dateId, { added, skipped }) {
    if (skipped.length > 0) {
      const first = skipped[0];
      const others = skipped.length > 1 ? ` ${skipped.length - 1} more files not added.` : '';
      this.app.showToaster(`${first.name}: ${first.reason}${others}`, 'error', 6000);
    } else if (added.length > 0) {
      const what = added.length === 1 ? '1 file' : `${added.length} files`;
      this.app.showToaster(`${what} added to ${this.app.formatDateWithOrdinal(new Date(dateId))}.`);
    }
  }

  // ==================== THUMBNAILS ====================

  onPageChanged() {
    document.querySelectorAll('.media-thumb video[data-src]').forEach(video => {
      if (video.dataset.watched) return;
      video.dataset.watched = '1';
      this.thumbObserver.observe(video);
    });
    this.updatePlayListButton();
  }

  onThumbsVisibility(entries) {
    for (const { target: video, isIntersecting } of entries) {
      if (isIntersecting) {
        this.visibleThumbs.add(video);
        if (!video.getAttribute('src')) video.src = video.dataset.src;
        if (!this.thumbsPaused) video.play().catch(() => {});
      } else {
        // Dropping the source frees the decoder, so long lists stay light.
        this.visibleThumbs.delete(video);
        video.pause();
        video.removeAttribute('src');
        video.load();
        if (!video.isConnected) this.thumbObserver.unobserve(video);
      }
    }
  }

  setThumbsPaused(paused) {
    this.thumbsPaused = paused;
    for (const video of this.visibleThumbs) {
      if (!video.isConnected) this.visibleThumbs.delete(video);
      else if (paused) video.pause();
      else video.play().catch(() => {});
    }
  }

  // ==================== PLAYBACK ====================

  /**
   * Sets which days the current page plays. Pages that only show a sample of their
   * days pass a filter for all of them. Without a filter, the table that was clicked counts.
   */
  setPlaylistFilter(filter) {
    this.playlistFilter = filter;
  }

  playlistDates(clickedElement) {
    let filter = this.playlistFilter;
    if (!filter) {
      const table = clickedElement && clickedElement.closest('table');
      const rowDates = new Set([...(table ? table.querySelectorAll('tr.score[data-date-id]') : [])].map(row => row.dataset.dateId));
      filter = dateId => rowDates.has(dateId);
    }
    return Object.keys(this.days).filter(dateId => this.isPlayable(dateId) && filter(dateId)).sort();
  }

  isPlayable(dateId) {
    const day = this.days[dateId];
    return Boolean(day.main) && !this.displayItem(day).error;
  }

  updatePlayListButton() {
    const slot = document.querySelector('#content .media-play-slot');
    if (!slot) return;
    const count = this.playlistFilter ? this.playlistDates().length : 0;
    const label = count === 0 ? '' : `Play ${count === 1 ? '1 video' : `${count} videos`}`;
    if (slot.textContent !== label) slot.innerHTML = label ? `<a onclick="onPlayMediaList()">${label}</a>` : '';
  }

  openDay(element, dateId) {
    this.player.openDay(dateId, this.playlistDates(element));
  }

  openEditItem(index) {
    this.player.openDay(this.editDateId, this.playlistDates(), this.editItem(index).file);
  }

  playList() {
    this.player.openList(this.playlistDates());
  }
}
