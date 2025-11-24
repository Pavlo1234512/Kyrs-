const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const app = express();

// Порт для Render і локалки
const PORT = process.env.PORT || 3000;

// ====================== НАЛАШТУВАННЯ ======================
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Статичні файли
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ====================== АВТОРИЗАЦІЯ МІДЛВАР ======================
app.use((req, res, next) => {
  if (req.path.includes('.') || req.path.startsWith('/uploads')) return next();

  const publicPaths = ['/', '/register', '/api/auth/login', '/login.html', '/register.html', '/help.html'];
  if (publicPaths.includes(req.path)) return next();
  if (req.method === 'GET' && req.path.startsWith('/api/')) return next();

  const userId = req.query.authUserId ||
                 (req.headers['x-user'] ? JSON.parse(req.headers['x-user'] || '{}')?.id : null) ||
                 req.headers['x-user-id'];

  if (!userId) return res.status(401).json({ error: 'Не авторизовано' });
  req.userId = userId;
  next();
});

// ====================== MULTER ======================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const name = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, Date.now() + '_' + name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.docx')) {
      return cb(new Error('Тільки .docx!'));
    }
    cb(null, true);
  }
});

// === НА САМОМУ ВЕРХУ ФАЙЛУ (після всіх require) ===
require('dotenv').config();

// === ПІДКЛЮЧЕННЯ ДО MONGODB (ФІНАЛЬНА ВЕРСІЯ) ===
const uri = process.env.MONGODB_URI;

if (!uri) {
  if (process.env.RENDER) {
    console.error('ПОМИЛКА: MONGODB_URI не знайдено на Render!');
    process.exit(1);
  } else {
    console.warn('MONGODB_URI не знайдено → використовую локальну MongoDB');
    process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/kyrsach';
  }
}

console.log('Підключаюсь до MongoDB...');

mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10
})
  .then(() => console.log('MongoDB підключено успішно!'))
  .catch(err => {
    console.error('Не вдалося підключитися до MongoDB:');
    console.error(err.message);
    process.exit(1);
  });
// ====================== МОДЕЛІ ======================
const User = mongoose.model('User', new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, required: true },
  password: String,
  settings: { type: Map, of: mongoose.Schema.Types.Mixed, default: () => ({}) }
}, { strict: false }));

const Order = mongoose.model('Order', new mongoose.Schema({
  title: String,
  filePath: String,
  status: { type: String, enum: ['Активний', 'Виконаний', 'Архів'], default: 'Активний' },
  deadline: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdByName: String
}, { timestamps: true }));

const Notification = mongoose.model('Notification', new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  message: String,
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  read: { type: Boolean, default: false }
}, { timestamps: true }));

// ====================== РОУТИ ======================

app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    console.log('Реєстрація — отримані дані:', { name, email, password: password ? '[є пароль]' : '[немає]' });

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Заповніть усі поля' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Користувач з такою поштою вже існує' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword
    });

    await newUser.save();

    console.log(`УСПІШНО зареєстровано: ${email}`);
    res.json({
      success: true,
      user: { id: newUser._id.toString(), name: newUser.name, email: newUser.email }
    });

  } catch (err) {
    console.error('Помилка при реєстрації:', err);
    res.status(500).json({ error: 'Серверна помилка при реєстрації' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Невірний логін або пароль' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Невірний логін або пароль' });

    res.json({
      success: true,
      user: { id: user._id.toString(), name: user.name || 'Користувач', email: user.email }
    });
  } catch (err) {
    console.error('Помилка логіну:', err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

app.post('/api/orders', upload.single('file'), async (req, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Не авторизовано' });
  try {
    const user = await User.findById(req.userId);
    if (!user || !req.file) return res.status(400).json({ error: 'Помилка' });

    const title = Buffer.from(req.file.originalname, 'latin1').toString('utf8').replace(/\.docx$/i, '');
    const order = new Order({
      title,
      filePath: `/uploads/${req.file.filename}`,
      status: req.body.status || 'Активний',
      deadline: req.body.deadline ? new Date(req.body.deadline) : null,
      createdBy: req.userId,
      createdByName: user.name || user.email.split('@')[0]
    });
    await order.save();

    const others = await User.find({ _id: { $ne: req.userId } });
    for (const u of others) {
      await new Notification({ userId: u._id, message: `${user.name} додав наказ: "${title}"`, orderId: order._id }).save();
    }

    res.json({ message: 'Наказ додано!', order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.searchTitle) query.title = { $regex: req.query.searchTitle, $options: 'i' };
    const orders = await Order.find(query).populate('createdBy', 'name').sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('createdBy', 'name');
    if (!order) return res.status(404).json({ error: 'Не знайдено' });
    res.json(order);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/orders/:id', upload.single('file'), async (req, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Не авторизовано' });
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Наказ не знайдено' });

    if (req.file && order.filePath) {
      const oldPath = path.join(__dirname, 'uploads', path.basename(order.filePath));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    let newTitle = order.title;
    if (req.file) {
      newTitle = Buffer.from(req.file.originalname, 'latin1').toString('utf8').replace(/\.docx$/i, '');
    } else if (req.body.title && req.body.title.trim()) {
      newTitle = req.body.title.trim();
    }

    order.title = newTitle;
    order.status = req.body.status || order.status;
    order.deadline = req.body.deadline ? new Date(req.body.deadline) : order.deadline;
    if (req.file) order.filePath = `/uploads/${req.file.filename}`;

    await order.save();

    res.json({
      success: true,
      message: 'Наказ успішно відредаговано!',
      redirect: '/'
    });
  } catch (err) {
    console.error('Помилка редагування:', err);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Не авторизовано' });
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (order?.filePath) {
      fs.unlinkSync(path.join(__dirname, 'uploads', path.basename(order.filePath)));
    }
    res.json({ message: 'Видалено' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/orders/:id/docx', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order?.filePath) return res.status(404).json({ error: 'Файл не знайдено' });
    const filePath = path.join(__dirname, 'uploads', path.basename(order.filePath));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Файл відсутній' });
    res.download(filePath, `${order.title}.docx`);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/users/:id', async (req, res) => {
  if (!req.userId || req.userId !== req.params.id) return res.status(403).json({ error: 'Доступ заборонено' });
  try {
    const updates = {};
    if (req.body.name) updates.name = req.body.name.trim();
    if (req.body.email) {
      const email = req.body.email.toLowerCase().trim();
      const exists = await User.findOne({ email, _id: { $ne: req.userId } });
      if (exists) return res.status(400).json({ error: 'Пошта зайнята' });
      updates.email = email;
    }
    if (req.body.password && req.body.password.length >= 4) {
      updates.password = await bcrypt.hash(req.body.password, 10);
    }
    const updated = await User.findByIdAndUpdate(req.userId, updates, { new: true }).select('-password');
    res.json({ message: 'Профіль оновлено', user: { id: updated._id, name: updated.name, email: updated.email } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users/:id/settings', async (req, res) => {
  try {
    const user = await User.findById(req.userId || req.params.id);
    res.json(user?.settings ? Object.fromEntries(user.settings) : {});
  } catch (err) { res.json({}); }
});

app.put('/api/users/:id/settings', async (req, res) => {
  if (!req.userId || req.userId !== req.params.id) return res.status(403).json({ error: 'Доступ заборонено' });
  try {
    const user = await User.findById(req.userId);
    const current = user.settings ? Object.fromEntries(user.settings) : {};
    user.settings = { ...current, ...req.body };
    await user.save();
    res.json({ message: 'Налаштування збережено' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/notifications', async (req, res) => {
  if (!req.userId) return res.json([]);
  try {
    const notifs = await Notification.find({ userId: req.userId })
      .sort({ createdAt: -1 }).limit(50).populate('orderId', 'title');
    res.json(notifs);
  } catch (err) { res.json([]); }
});

app.put('/api/notifications/read', async (req, res) => {
  if (!req.userId) return res.json({ success: false });
  try {
    await Notification.updateMany({ userId: req.userId, read: false }, { read: true });
    res.json({ success: true });
  } catch (err) { res.json({ success: false }); }
});

// ====================== SPA FALLBACK ======================
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ====================== ЗАПУСК СЕРВЕРА ======================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\nСЕРВЕР ЗАПУЩЕНО на порту ${PORT}`);
  console.log(`http://localhost:${PORT}`);
});