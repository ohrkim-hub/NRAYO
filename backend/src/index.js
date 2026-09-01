const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const verifyRoutes = require('./routes/verify');
const discoveryRoutes = require('./routes/discovery');
const quizRoutes = require('./routes/quiz');
const friendsRoutes = require('./routes/friends');
const trioRoutes = require('./routes/trio');
const meetsRoutes = require('./routes/meets');
const safetyRoutes = require('./routes/safety');
const adminRoutes = require('./routes/admin');
const contactsRoutes = require('./routes/contacts');
const ratingsRoutes = require('./routes/ratings');
const paymentsRoutes = require('./routes/payments');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ service: 'NRAYO(너랑요) API', version: '0.1.0', status: 'ok' });
});

app.use('/auth', authRoutes);
app.use('/verify', verifyRoutes);
app.use('/discovery', discoveryRoutes);
app.use('/quiz', quizRoutes);
app.use('/friends', friendsRoutes);
app.use('/trio', trioRoutes);
app.use('/meets', meetsRoutes);
app.use('/safety', safetyRoutes);
app.use('/admin', adminRoutes);
app.use('/contacts', contactsRoutes);
app.use('/ratings', ratingsRoutes);
app.use('/payments', paymentsRoutes);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`NRAYO backend listening on port ${PORT}`);
});
