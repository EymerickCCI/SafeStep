import express from "express";
import { createServer as createViteServer } from "vite";
import sqlite3 from "better-sqlite3";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "safestep-super-secret-key";

app.use(express.json());

// Database Setup
const db = sqlite3("safestep.db");

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password_hash TEXT,
    first_name TEXT,
    last_name TEXT,
    role TEXT
  );

  CREATE TABLE IF NOT EXISTS epi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_ref TEXT UNIQUE,
    category TEXT,
    status TEXT,
    last_check TEXT,
    site_id INTEGER,
    user_id INTEGER,
    quantity INTEGER DEFAULT 1,
    available INTEGER DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    gps_lat REAL,
    gps_lng REAL,
    ville TEXT
  );
`);

// Migration: Add quantity and available columns if they don't exist
const tableInfo = db.prepare("PRAGMA table_info(epi)").all() as any[];
const hasQuantity = tableInfo.some(col => col.name === 'quantity');
const hasAvailable = tableInfo.some(col => col.name === 'available');

if (!hasQuantity) {
  db.exec("ALTER TABLE epi ADD COLUMN quantity INTEGER DEFAULT 1");
}
if (!hasAvailable) {
  db.exec("ALTER TABLE epi ADD COLUMN available INTEGER DEFAULT 1");
}

// Seed data if empty
const userCount = db.prepare("SELECT count(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  const hashedPassword = bcrypt.hashSync("admin123", 10);
  db.prepare("INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)").run("admin@safestep.fr", hashedPassword, "Admin", "SafeStep", "admin");
  
  // Seed some EPI
  const seedEPI = [
    { tag_ref: 'CASQ-001', category: 'casque', status: 'conforme', last_check: '2024-02-20', site_id: 1, quantity: 10, available: 8 },
    { tag_ref: 'GANT-002', category: 'gants', status: 'a_inspecter', last_check: '2023-12-15', site_id: 1, quantity: 50, available: 45 },
    { tag_ref: 'HARN-003', category: 'harnais', status: 'conforme', last_check: '2024-01-10', site_id: 2, quantity: 5, available: 5 }
  ];
  
  const insertEPI = db.prepare("INSERT INTO epi (tag_ref, category, status, last_check, site_id, quantity, available) VALUES (?, ?, ?, ?, ?, ?, ?)");
  seedEPI.forEach(item => insertEPI.run(item.tag_ref, item.category, item.status, item.last_check, item.site_id, item.quantity, item.available));

  db.prepare("INSERT INTO sites (id, name, ville) VALUES (?, ?, ?)").run(1, "Tunnel Mont-Blanc", "Chamonix");
  db.prepare("INSERT INTO sites (id, name, ville) VALUES (?, ?, ?)").run(2, "Sous-sol Gare Lyon", "Paris");
}

// Middleware: JWT Auth
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: "Token manquant" });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: "Token invalide" });
    req.user = user;
    next();
  });
};

// --- API ROUTES ---

// Auth
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(username) as any;

  if (user && bcrypt.compareSync(password, user.password_hash)) {
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, first_name: user.first_name, last_name: user.last_name } });
  } else {
    res.status(401).json({ error: "Identifiants incorrects" });
  }
});

// EPI Management
app.get("/api/epi", authenticateToken, (req, res) => {
  const items = db.prepare("SELECT * FROM epi").all();
  res.json(items);
});

app.post("/api/sync", authenticateToken, (req, res) => {
  const { changes } = req.body; // Array of { action: 'put'|'delete', data: {} }
  
  try {
    const transaction = db.transaction((items) => {
      for (const item of items) {
        if (item.action === 'put') {
          db.prepare(`
            INSERT OR REPLACE INTO epi (id, tag_ref, category, status, last_check, site_id, quantity, available, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).run(item.data.id, item.data.tag_ref, item.data.category, item.data.status, item.data.last_check, item.data.site_id, item.data.quantity, item.data.available);
        } else if (item.action === 'delete') {
          db.prepare("DELETE FROM epi WHERE id = ?").run(item.id);
        }
      }
    });
    transaction(changes);
    res.json({ success: true });
  } catch (error) {
    console.error("Sync error:", error);
    res.status(500).json({ error: "Erreur de synchronisation" });
  }
});

// External Data: Weather (Mocked for demo but structured)
app.get("/api/weather", authenticateToken, (req, res) => {
  // In a real app, we'd call OpenWeatherMap or similar
  res.json({
    temp: 12,
    condition: "Pluie modérée",
    alert: "Vigilance Orange : Risque d'inondation en sous-sol",
    can_work: false,
    updated_at: new Date().toISOString()
  });
});

// External Data: Traffic
app.get("/api/traffic", authenticateToken, (req, res) => {
  res.json({
    site_id: "S1",
    travel_time: "45 min",
    status: "Ralentissements",
    delay: "+15 min",
    updated_at: new Date().toISOString()
  });
});

// --- VITE MIDDLEWARE ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SafeStep Server running on http://localhost:${PORT}`);
  });
}

startServer();
