const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");

class UploadService {
  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });
    this.bucketName = process.env.AWS_S3_BUCKET;
  }

  async uploadFile(file, folder, entityId) {
    const fileExt = file.originalname.split(".").pop();
    const key = `uploads/${folder}/${entityId}/${uuidv4()}.${fileExt}`;

    const params = {
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    try {
      const data = await this.s3.upload(params).promise();
      return {
        url: data.Location,
        key: data.Key,
        fileName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      };
    } catch (error) {
      console.error("S3 Upload Error:", error);
      throw error;
    }
  }

  async deleteFile(key) {
    if (!key) {
      console.warn("No S3 key provided for deletion");
      return;
    }

    const params = {
      Bucket: this.bucketName,
      Key: key,
    };

    try {
      await this.s3.deleteObject(params).promise();
      console.log(`Successfully deleted file: ${key}`);
      return true;
    } catch (error) {
      console.error("S3 Deletion Error:", error);
      throw error;
    }
  }

  async deleteMultipleFiles(keys) {
    if (!keys || keys.length === 0) return;

    const params = {
      Bucket: this.bucketName,
      Delete: {
        Objects: keys.map((key) => ({ Key: key })),
        Quiet: false,
      },
    };

    try {
      const data = await this.s3.deleteObjects(params).promise();
      if (data.Errors && data.Errors.length > 0) {
        console.error("Some files failed to delete:", data.Errors);
      }
      return data;
    } catch (error) {
      console.error("S3 Bulk Deletion Error:", error);
      throw error;
    }
  }
}

module.exports = new UploadService();
