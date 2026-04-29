const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const FILES = {
  users: 'users.json',
  profiles: 'profiles.json',
  products: 'products.json',
  orders: 'orders.json',
  vouchers: 'vouchers.json',
};

function readJSON(name) {
  const file = path.join(DATA_DIR, FILES[name]);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, '[]');
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function writeJSON(name, data) {
  const file = path.join(DATA_DIR, FILES[name]);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function findById(name, id) {
  const data = readJSON(name);
  return data.find(item => item.id === id);
}

function findByField(name, field, value) {
  const data = readJSON(name);
  return data.find(item => item[field] === value);
}

function create(name, item) {
  const data = readJSON(name);
  item.id = item.id || require('crypto').randomUUID();
  item.created_at = new Date().toISOString();
  item.updated_at = item.created_at;
  data.push(item);
  writeJSON(name, data);
  return item;
}

function update(name, id, updates) {
  const data = readJSON(name);
  const idx = data.findIndex(item => item.id === id);
  if (idx === -1) return null;
  data[idx] = { ...data[idx], ...updates, updated_at: new Date().toISOString() };
  writeJSON(name, data);
  return data[idx];
}

function remove(name, id) {
  const data = readJSON(name);
  const idx = data.findIndex(item => item.id === id);
  if (idx === -1) return false;
  data.splice(idx, 1);
  writeJSON(name, data);
  return true;
}

function list(name) {
  return readJSON(name);
}

module.exports = {
  readJSON,
  writeJSON,
  findById,
  findByField,
  create,
  update,
  remove,
  list,
  DATA_DIR,
};