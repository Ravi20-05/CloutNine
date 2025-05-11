import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import morgan from 'morgan';
import { aj } from './lib/arcjet.js'; // Importing the aj module
import bodyParser from 'body-parser';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static('public'));

app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(morgan("dev"));

app.use(async (req, res, next) => {
  try {
    const decision = await aj.protect(req, {
      requested: 1
    });
    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        res.status(429).json({ error: "Too Many Requests" });
      } else if (decision.reason.isBot()) {
        res.status(403).json({ error: "Bot access denied" });
      } else {
        res.status(403).json({ error: "Forbidden" });
      }
      return;
    }
    if (decision.results.some((result) => result.reason.isBot() && result.reason.isSpoofed())) {
      res.status(403).json({ error: "Spoofed bot detected" });
      return;
    }
    next();
  } catch (error) {
    console.log("Arcjet error", error);
    next(error);
  }
});

const PORT = process.env.PORT || 3000;

app.post('/send-email', async (req, res) => {
  const { first, last, email, phone, message } = req.body;

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"${first} ${last}" <${email}>`,
      to: 'singh1892004@gmail.com',
      subject: 'New Contact Form Submission',
      html: `
        <h3>Contact Form Submission</h3>
        <p><strong>Name:</strong> ${first} ${last}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
        <p><strong>Message:</strong><br>${message}</p>
      `,
    });

    res.send(`<script>alert('Message sent successfully!'); window.location.href='/';</script>`);
  } catch (err) {
    console.error('Email sending failed:', err);
    res.status(500).send(`<script>alert('Failed to send message. Try again later.'); window.location.href='/';</script>`);
  }
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/home.html');
});

app.get('/about', (req, res) => {
  res.sendFile(__dirname + '/views/about.html');
});

app.get('/contact', (req, res) => {
  res.sendFile(__dirname + '/views/contact.html');
});

app.listen(PORT, () => {
  console.log('Server is running on port 3000');
});
