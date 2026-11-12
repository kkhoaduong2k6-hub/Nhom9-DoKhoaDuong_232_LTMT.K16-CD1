const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const ApiError = require('../utils/ApiError');
const cloud = require('../config/cloudinary');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!cloud.enabled) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Có CLOUDINARY_URL => giữ file trong RAM rồi đẩy lên cloud; ngược lại lưu đĩa cục bộ
const storage = cloud.enabled
  ? multer.memoryStorage()
  : multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  });

const fileFilter = (req, file, cb) => {
  if (/^image\/(jpe?g|png|webp)$/.test(file.mimetype)) return cb(null, true);
  cb(ApiError.badRequest('Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP'));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024, files: 10 } });

// Đẩy các file trong RAM lên Cloudinary, gán f.url
const toCloud = async (req, res, next) => {
  try {
    if (!cloud.enabled) return next();
    const files = req.files || (req.file ? [req.file] : []);
    await Promise.all(files.map(async (f) => { f.url = await cloud.uploadBuffer(f.buffer); }));
    next();
  } catch (e) { next(e); }
};

exports.uploadRoomImages = [upload.array('images', 10), toCloud];
exports.UPLOAD_DIR = UPLOAD_DIR;

// Đường dẫn/URL lưu vào DB cho một file vừa upload
exports.fileUrl = (f) => f.url || `/uploads/${f.filename}`;

// Xóa ảnh (file cục bộ hoặc ảnh Cloudinary)
exports.removeFiles = (paths = []) => {
  paths.forEach((p) => {
    if (/^https?:\/\//.test(p)) { cloud.destroyByUrl(p).catch(() => {}); return; }
    fs.unlink(path.join(UPLOAD_DIR, path.basename(p)), () => {});
  });
};
