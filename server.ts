import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database('radio.db');

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS stations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    frequency TEXT,
    url TEXT NOT NULL,
    logo TEXT,
    category TEXT,
    location TEXT
  );

  CREATE TABLE IF NOT EXISTS admin (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL
  );
`);

// Seed initial data if empty
const stationCount = db.prepare('SELECT COUNT(*) as count FROM stations').get() as { count: number };
if (stationCount.count === 0) {
  const insert = db.prepare('INSERT INTO stations (id, name, frequency, url, logo, category, location) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const initialStations = [
    ['top-albania', 'Top Albania Radio', '100.0 FM', 'https://streaming.top-channel.tv/topalbania', 'https://upload.wikimedia.org/wikipedia/sq/thumb/3/3d/Top_Albania_Radio_Logo.png/200px-Top_Albania_Radio_Logo.png', 'Pop/Hits', 'Tirana'],
    ['radio-travel', 'Radio Travel', '94.8 FM', 'https://stream.radiotravel.al/live', 'https://radiotravel.al/wp-content/uploads/2021/03/logo-radio-travel.png', 'Chill/Travel', 'Tirana'],
    ['club-fm', 'Club FM', '100.4 FM', 'https://stream.clubfm.al/live', 'https://clubfm.al/wp-content/themes/clubfm/images/logo.png', 'Dance/Pop', 'Tirana'],
    ['radio-tirana', 'Radio Tirana 1', '94.3 FM', 'https://rtsh.stream.skylinewebcams.com/live.m3u8', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/RTSH_Radio_Tirana_logo.svg/1200px-RTSH_Radio_Tirana_logo.svg.png', 'News/Talk', 'Tirana'],
    ['radio-dukagjini', 'Radio Dukagjini', '99.7 FM', 'https://dukagjini.stream.skylinewebcams.com/live.m3u8', 'https://www.dukagjini.com/wp-content/uploads/2021/05/radio-dukagjini-logo.png', 'Hits/News', 'Peja'],
    ['radio-kosova', 'Radio Kosova 1', '91.8 FM', 'https://rtk.stream.skylinewebcams.com/live.m3u8', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/RTK_Radio_Kosova_1_logo.svg/1200px-RTK_Radio_Kosova_1_logo.svg.png', 'General', 'Pristina']
  ];
  initialStations.forEach(s => insert.run(...s));
}

const adminCount = db.prepare('SELECT COUNT(*) as count FROM admin').get() as { count: number };
if (adminCount.count === 0) {
  db.prepare('INSERT INTO admin (username, password) VALUES (?, ?)').run('admin', 'admin123');
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Routes
  app.get('/api/stations', (req, res) => {
    const stations = db.prepare('SELECT * FROM stations').all();
    res.json(stations);
  });

  app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM admin WHERE username = ? AND password = ?').get(username, password);
    if (user) {
      res.json({ success: true, token: 'mock-session-token' });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  });

  app.post('/api/stations', (req, res) => {
    // Simple auth check (mock)
    const { id, name, frequency, url, logo, category, location } = req.body;
    try {
      db.prepare('INSERT INTO stations (id, name, frequency, url, logo, category, location) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id || Math.random().toString(36).substr(2, 9), name, frequency, url, logo, category, location);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.put('/api/stations/:id', (req, res) => {
    const { id } = req.params;
    const { name, frequency, url, logo, category, location } = req.body;
    db.prepare('UPDATE stations SET name = ?, frequency = ?, url = ?, logo = ?, category = ?, location = ? WHERE id = ?')
      .run(name, frequency, url, logo, category, location, id);
    res.json({ success: true });
  });

  app.delete('/api/stations/:id', (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM stations WHERE id = ?').run(id);
    res.json({ success: true });
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
