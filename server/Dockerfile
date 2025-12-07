# Stage 1: Build stage
FROM python:3.13-slim as builder

# Set working directory
WORKDIR /app

# Install build dependencies (compilers & tools needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc gfortran libgomp1 python3-dev libpq-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Stage 2: Final stage
FROM python:3.13-slim

# Set environment variables for Flask
ENV FLASK_APP=main.py
ENV FLASK_ENV=production

# Install necessary system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy installed dependencies from the builder stage
COPY --from=builder /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages

# Copy application code
COPY . .

# Copy the .env file
COPY .env .env

# Expose the Flask default port
EXPOSE 5000

# Command to run the Flask application using Python
CMD ["python", "-m", "flask", "run", "--host=0.0.0.0"]
