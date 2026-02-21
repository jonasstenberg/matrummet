// Mock environment variables for tests — must run BEFORE module imports
process.env.JWT_SECRET = "test-secret-min-32-chars-long-enough";
process.env.PORT = "4006";
process.env.DATA_FILES_DIR = "/tmp/image-service-test-uploads";
