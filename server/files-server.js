import express from "express";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const filesDir = path.join(rootDir, "files");
const manifestPath = path.join(filesDir, "manifest.json");
const app = express();
const port = Number(process.env.FILES_SERVER_PORT ?? 5174);

app.use(express.json({ limit: "50mb" }));

async function ensureFilesDir() {
  await mkdir(filesDir, { recursive: true });
}

async function readManifest() {
  await ensureFilesDir();

  try {
    const raw = await readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      files: Array.isArray(parsed.files) ? parsed.files : [],
    };
  } catch {
    return { files: [] };
  }
}

async function writeManifest(manifest) {
  await ensureFilesDir();
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
}

function sanitizeName(name) {
  const clean = String(name || "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return clean || "Canvas";
}

function fileNameFromDisplayName(name) {
  return `${sanitizeName(name).replace(/\s+/g, "-").toLowerCase()}.tldr`;
}

function getNextCanvasName(files) {
  const used = new Set(files.map((file) => file.name));
  let index = files.length + 1;
  while (used.has(`Canvas ${index}`)) index++;
  return `Canvas ${index}`;
}

function getUniqueFileName(files, displayName, currentId) {
  const used = new Set(
    files.filter((file) => file.id !== currentId).map((file) => file.fileName.toLowerCase())
  );
  const ext = ".tldr";
  const base = fileNameFromDisplayName(displayName).slice(0, -ext.length);
  let candidate = `${base}${ext}`;
  let index = 2;

  while (used.has(candidate.toLowerCase())) {
    candidate = `${base}-${index}${ext}`;
    index++;
  }

  return candidate;
}

function getFilePath(fileName) {
  const resolved = path.resolve(filesDir, fileName);
  if (!resolved.startsWith(filesDir)) {
    throw new Error("Invalid file path");
  }
  return resolved;
}

app.get("/api/files", async (_req, res, next) => {
  try {
    const manifest = await readManifest();
    res.json({ files: manifest.files });
  } catch (error) {
    next(error);
  }
});

app.post("/api/files", async (req, res, next) => {
  try {
    const manifest = await readManifest();
    const name = sanitizeName(req.body.name || getNextCanvasName(manifest.files));
    const id = `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const fileName = getUniqueFileName(manifest.files, name, id);
    const file = {
      id,
      name,
      fileName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await writeFile(getFilePath(fileName), String(req.body.content ?? ""), "utf8");
    manifest.files.push(file);
    await writeManifest(manifest);

    res.status(201).json({ file });
  } catch (error) {
    next(error);
  }
});

app.get("/api/files/:id", async (req, res, next) => {
  try {
    const manifest = await readManifest();
    const file = manifest.files.find((item) => item.id === req.params.id);
    if (!file) return res.status(404).json({ error: "File not found" });

    const content = await readFile(getFilePath(file.fileName), "utf8");
    res.json({ file, content });
  } catch (error) {
    next(error);
  }
});

app.put("/api/files/:id", async (req, res, next) => {
  try {
    const manifest = await readManifest();
    const file = manifest.files.find((item) => item.id === req.params.id);
    if (!file) return res.status(404).json({ error: "File not found" });

    file.updatedAt = new Date().toISOString();
    await writeFile(getFilePath(file.fileName), String(req.body.content ?? ""), "utf8");
    await writeManifest(manifest);

    res.json({ file });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/files/:id/rename", async (req, res, next) => {
  try {
    const manifest = await readManifest();
    const file = manifest.files.find((item) => item.id === req.params.id);
    if (!file) return res.status(404).json({ error: "File not found" });

    const nextName = sanitizeName(req.body.name);
    const nextFileName = getUniqueFileName(manifest.files, nextName, file.id);
    if (nextFileName !== file.fileName) {
      await rename(getFilePath(file.fileName), getFilePath(nextFileName));
    }

    file.name = nextName;
    file.fileName = nextFileName;
    file.updatedAt = new Date().toISOString();
    await writeManifest(manifest);

    res.json({ file });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/files/order", async (req, res, next) => {
  try {
    const manifest = await readManifest();
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    const byId = new Map(manifest.files.map((file) => [file.id, file]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
    const rest = manifest.files.filter((file) => !ids.includes(file.id));

    manifest.files = [...ordered, ...rest];
    await writeManifest(manifest);

    res.json({ files: manifest.files });
  } catch (error) {
    next(error);
  }
});

app.get("/api/files/:id/download", async (req, res, next) => {
  try {
    const manifest = await readManifest();
    const file = manifest.files.find((item) => item.id === req.params.id);
    if (!file) return res.status(404).json({ error: "File not found" });

    res.download(getFilePath(file.fileName), file.fileName);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/files/:id", async (req, res, next) => {
  try {
    const manifest = await readManifest();
    const index = manifest.files.findIndex((item) => item.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "File not found" });

    const [file] = manifest.files.splice(index, 1);
    await unlink(getFilePath(file.fileName)).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
    await writeManifest(manifest);

    res.json({ files: manifest.files });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Files server error" });
});

app.listen(port, () => {
  console.log(`Files server listening on http://localhost:${port}`);
});
