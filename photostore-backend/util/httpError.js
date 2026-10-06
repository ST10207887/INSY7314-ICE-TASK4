// Small helper to throw errors that carry an HTTP status code
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

module.exports = HttpError;
