# Use official Node.js image
FROM node:18-alpine

# Set working directory inside container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy all source files
COPY . .

# Copy .env file into container
COPY .env .env

# Build the Next.js app
RUN npm run build

# Expose the port Next.js will run on
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
