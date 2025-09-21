// server.js
import express from 'express';
import multer from 'multer';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

const app = express();
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } });

app.post('/api/convert', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('No file uploaded.');
    const id = crypto.randomUUID();
    const tmpDir = path.join(process.cwd(), 'tmp');
    await fs.mkdir(tmpDir, { recursive: true });
    const inPath = path.join(tmpDir, `${id}.pdf`);
    await fs.writeFile(inPath, req.file.buffer);

    const outName = `${id}.docx`;
    const outPath = path.join(tmpDir, outName);

    // Example using LibreOffice headless conversion:
    // soffice --headless --convert-to docx --outdir tmp tmp/<id>.pdf
    await execCmd('soffice', ['--headless', '--convert-to', 'docx', '--outdir', tmpDir, inPath]);

    // Optional: run OCR step beforehand if req.body.ocr === '1' (e.g., ocrmypdf)
    // Optional: layout handling would be implemented via your chosen toolchain.

    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${suggestName(req.file.originalname)}"`);
    res.sendFile(path.join(tmpDir, suggestName(req.file.originalname)), (err) => {
      // Cleanup after send
      fs.rm(inPath, { force: true });
      fs.rm(outPath, { force: true });
    });
  } catch (e) {
    console.error(e);
    res.status(500).send('Conversion failed.');
  }
});

function execCmd(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let stderr = '';
    p.stderr.on('data', d => stderr += d.toString());
    p.on('close', code => code === 0 ? resolve() : reject(new Error(stderr || `${cmd} exited ${code}`)));
  });
}

function suggestName(pdfName) {
  return pdfName.replace(/\.pdf$/i, '.docx');
}

app.listen(3000, () => console.log('Server on http://localhost:3000'));
