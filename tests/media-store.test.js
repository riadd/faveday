// Tests for attaching media to days
// Run with: node tests/media-store.test.js

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const MediaStore = require('../app/lib/faveday/media-store');

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faveday-media-'));
  process.on('exit', () => fs.rmSync(root, { recursive: true, force: true }));
  const dataDir = path.join(root, 'data');
  const dropDir = path.join(root, 'dropped');
  fs.mkdirSync(dataDir);
  fs.mkdirSync(dropDir);
  const store = new MediaStore({
    getDataDir: () => dataDir,
    cacheDir: path.join(root, 'cache'),
    ffmpegPath: 'unused',
    onVideoUpdate: () => {}
  });
  store.requestCopies = () => {};
  const drop = (name, content = name) => {
    const file = path.join(dropDir, name);
    fs.writeFileSync(file, content);
    return file;
  };
  return { root, dataDir, store, drop };
}

async function run() {
  // The journal loader reads every .txt at the top of the data folder, so media must stay out of there.
  {
    const { dataDir, store, drop } = setup();
    await store.load();
    const result = await store.addFiles('2024-09-28', [drop('photo.jpg'), drop('first.mov'), drop('second.mp4'), drop('notes.txt')]);

    assert.strictEqual(path.basename(result.day.main), '2024-09-28 first.mov');
    assert.strictEqual(result.day.items.length, 3);
    assert.deepStrictEqual(result.skipped.map(s => s.name), ['notes.txt']);
    assert.deepStrictEqual(fs.readdirSync(dataDir), ['media']);
    assert.ok(fs.existsSync(path.join(dataDir, 'media', 'media.json')));
    assert.ok(fs.existsSync(path.join(dataDir, 'media', '2024', '2024-09-28 first.mov')));

    await store.load();
    assert.strictEqual(path.basename(store.days['2024-09-28'].main), '2024-09-28 first.mov');
  }

  // Removing the main video deletes its file and hands main to the next video, never to a photo.
  {
    const { dataDir, store, drop } = setup();
    await store.load();
    const { day } = await store.addFiles('2024-01-02', [drop('photo.jpg'), drop('a.mp4'), drop('b.mp4')]);
    const b = day.items.find(item => item.name.endsWith('b.mp4')).file;

    await store.setMain('2024-01-02', b);
    const afterRemove = await store.removeItem('2024-01-02', b);

    assert.ok(afterRemove.main.endsWith('a.mp4'));
    assert.ok(!fs.existsSync(path.join(dataDir, 'media', ...b.split('/'))));
    const photo = afterRemove.items.find(item => item.kind === 'photo').file;
    await assert.rejects(store.setMain('2024-01-02', photo));
  }

  // A record that can't be read must not get overwritten by the next drop.
  {
    const { dataDir, store, drop } = setup();
    const record = path.join(dataDir, 'media', 'media.json');
    fs.mkdirSync(path.dirname(record));
    fs.writeFileSync(record, '{ broken');

    await assert.rejects(store.load());
    await assert.rejects(store.addFiles('2024-01-02', [drop('a.mp4')]));
    assert.strictEqual(fs.readFileSync(record, 'utf-8'), '{ broken');
  }

  // Dropping the same file on the same day twice adds it once.
  {
    const { store, drop } = setup();
    await store.load();
    const file = drop('a.mp4');
    await store.addFiles('2024-01-02', [file]);
    const second = await store.addFiles('2024-01-02', [file]);

    assert.strictEqual(second.added.length, 0);
    assert.strictEqual(second.day.items.length, 1);
  }

  console.log('media-store tests passed');
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
