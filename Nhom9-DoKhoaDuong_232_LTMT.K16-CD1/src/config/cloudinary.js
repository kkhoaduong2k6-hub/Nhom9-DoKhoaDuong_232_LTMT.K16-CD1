// Tùy chọn: đặt CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name> để lưu ảnh lên Cloudinary
const enabled = !!process.env.CLOUDINARY_URL;
let cloudinary = null;
if (enabled) {
  cloudinary = require('cloudinary').v2; // npm i cloudinary (đã có trong package.json)
  cloudinary.config({ secure: true });
}
const FOLDER = 'phongtro';

exports.enabled = enabled;

exports.uploadBuffer = (buffer) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(
    { folder: FOLDER, resource_type: 'image', transformation: [{ width: 1600, crop: 'limit', quality: 'auto' }] },
    (err, result) => (err ? reject(err) : resolve(result.secure_url))
  );
  stream.end(buffer);
});

// https://res.cloudinary.com/<cloud>/image/upload/v123/phongtro/abc.jpg => phongtro/abc
exports.destroyByUrl = async (url) => {
  if (!enabled || !url.includes('res.cloudinary.com')) return;
  const m = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i);
  if (m) await cloudinary.uploader.destroy(m[1]);
};
