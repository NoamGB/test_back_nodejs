require( 'dotenv' ).config();

const server = require( './app' );
const { connectDB, mongoose } = require( './src/config/database' );
const documentQueue = require( './src/modules/queues/document.queue' );
const logger = require( './src/config/logger' );
const { redis } = require( './src/config/redis' );

const port = process.env.PORT || 3000;
let httpServer = null;

const start = async () => {
  try {
    await connectDB();
    await redis.connect().catch(() => undefined);
    httpServer = server.listen(port, () => {
      logger.info({ message: `Server is running on port ${port}` });
    });
  } catch (error) {
    logger.error({ message: 'Error starting server', error: error.message });
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  logger.info({ message: 'Graceful shutdown started', signal });
  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve));
  }
  await documentQueue.close().catch(() => undefined);
  await redis.quit().catch(() => undefined);
  await mongoose.connection.close().catch(() => undefined);
  logger.info({ message: 'Graceful shutdown finished' });
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
