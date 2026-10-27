/**
 * Request logging middleware
 */
export const requestLoggingMiddleware = (req, res, next) => {
  const start = Date.now();
  const { method, url, clientIP } = req;

  console.log(
    `[${new Date().toISOString()}] ${method} ${url} from ${clientIP}`
  );

  res.on("finish", () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    console.log(
      `[${new Date().toISOString()}] ${method} ${url} ${statusCode} ${duration}ms`
    );
  });

  next();
};

/**
 * Error handling middleware
 */
export const errorHandlingMiddleware = (err, req, res, next) => {
  console.error("Unhandled error:", err, req.url);

  const isDevelopment = process.env.NODE_ENV !== "production";

  res.status(err.status || 500).json({
    success: false,
    message: isDevelopment ? err.message : "Internal server error",
    stack: isDevelopment ? err.stack : undefined,
  });
};

/**
 * Async error wrapper
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
