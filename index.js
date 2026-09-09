/*
    MIT License
    
    Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
    Mindoro State University - Philippines

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
    */
    
import dotenv from "dotenv";
dotenv.config();
import express from "express";
import path from "path";
import session from "express-session";
import flash from "connect-flash";
import "./models/maintenanceRequestModel.js";
import "./models/attendanceModel.js";
import "./models/attendanceSessionModel.js";
import "./models/laboratoryScheduleModel.js";
import { ensureClassListEntryTable } from "./models/classListEntryModel.js";
import "./models/borrowRecordModel.js";
import "./models/equipmentModel.js";
import "./models/userModel.js";
import router from "./routes/index.js";
import maintenanceRouter from "./routes/maintenanceRoutes.js";
import { sequelize } from "./models/db.js";
import fs from 'fs';
import hbs from "hbs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { getSmtpConfigStatus } from "./utils/mailer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(process.cwd(), "public")));

app.use(session({
  secret: "xianfire-secret-key",
  resave: false,
  saveUninitialized: false
}));
app.use(flash());

app.engine("xian", async (filePath, options, callback) => {
  try {
     const originalPartialsDir = hbs.partialsDir;
    hbs.partialsDir = path.join(__dirname, 'views');

    const result = await new Promise((resolve, reject) => {
      hbs.__express(filePath, options, (err, html) => {
        if (err) return reject(err);
        resolve(html);
      });
    });

    hbs.partialsDir = originalPartialsDir;
    callback(null, result);
  } catch (err) {
    callback(err);
  }
});
app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  next();
});


app.set("views", path.join(__dirname, "views"));
app.set("view engine", "xian");
const partialsDir = path.join(__dirname, "views/partials");
fs.readdir(partialsDir, (err, files) => {
  if (err) {
    console.error("❌ Could not read partials directory:", err);
    return;
  }

   files
    .filter(file => file.endsWith('.xian'))
    .forEach(file => {
      const partialName = file.replace('.xian', ''); 
      const fullPath = path.join(partialsDir, file);

      fs.readFile(fullPath, 'utf8', (err, content) => {
        if (err) {
          console.error(`❌ Failed to read partial: ${file}`, err);
          return;
        }
        hbs.registerPartial(partialName, content);
        
      });
    });
});

app.use("/", maintenanceRouter);
app.use("/", router);

const smtpStatus = getSmtpConfigStatus();
if (!smtpStatus.isConfigured) {
  console.warn(`⚠️ SMTP is not configured: missing ${smtpStatus.missing.join(", ")}. Email verification mail will be disabled until these environment variables are set.`);
} else {
  console.log("✅ SMTP environment variables are present.");
}

export default app;

if (!process.env.ELECTRON) {
  const initializeDatabase = async () => {
    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await sequelize.authenticate();
        console.log("✅ Database connected");

        try {
          await ensureClassListEntryTable();
          await sequelize.sync({ force: false, alter: true, logging: false });
          console.log("✅ Database tables are ready");
        } catch (syncError) {
          console.warn("⚠️ Database schema sync skipped:", syncError.message);
        }

        return; // Success
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
          console.warn(`⚠️  Database initialization attempt ${attempt} failed. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error("❌ Database initialization failed after retries:", lastError);
    process.exit(1);
  };

  const startServer = async (port, retries = 3) => {
    try {
      await initializeDatabase();
    } catch {
      return;
    }

    const server = app.listen(port, HOST, () => {
      const displayHost = HOST === "0.0.0.0" ? "localhost" : HOST;
      console.log(`🔥 XianFire running at http://${displayHost}:${port}`);
      if (HOST === "0.0.0.0") {
        console.log("   Listening on all network interfaces (0.0.0.0). Use your PC LAN IP to access from other devices.");
      }
    });

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`❌ Port ${port} is already in use.`);
        if (retries > 0) {
          const nextPort = port + 1;
          console.log(`Trying next available port: ${nextPort}`);
          startServer(nextPort, retries - 1);
          return;
        }
        console.error(`No available ports found after retries. Set PORT to a free port and restart.`);
        process.exit(1);
      }

      console.error("❌ Server failed to start:", err.message);
      if (err.code === "EACCES") {
        console.error(`Permission denied when trying to bind to port ${port}. Use a port above 1024 or run with elevated privileges.`);
      }
      process.exit(1);
    });

    server.on("listening", () => {
      process.on("unhandledRejection", (reason) => {
        console.error("❌ Unhandled promise rejection during runtime:", reason);
      });
    });

    return server;
  };

  startServer(Number(PORT) || 3000);
}
