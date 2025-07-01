export const databaseConfig = {
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudnest',
    options: {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
      retryWrites: true,
      w: 'majority',
    },
  },
  // GridFS configuration for file storage fallback
  gridfs: {
    bucketName: 'files',
    chunkSizeBytes: 255 * 1024, // 255KB chunks
  },
} as const;
