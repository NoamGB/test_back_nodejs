const { Types, mongo } = require('mongoose');
const { mongoose } = require('../../config/database');

const getBucket = () => new mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'pdfs' });

const uploadPdfStream = async (pdfStream, filename, metadata = {}) => {
  const bucket = getBucket();
  const uploadStream = bucket.openUploadStream(filename, { metadata });

  await new Promise((resolve, reject) => {
    pdfStream.pipe(uploadStream).on('finish', resolve).on('error', reject);
  });

  return uploadStream.id.toString();
};

const downloadPdfStreamById = (fileId) => {
  const bucket = getBucket();
  return bucket.openDownloadStream(new Types.ObjectId(fileId));
};

module.exports = {
  uploadPdfStream,
  downloadPdfStreamById
};
