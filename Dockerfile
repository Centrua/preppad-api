FROM node:18

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy all app code (including Prisma schema)
COPY . .

# Expose server port
EXPOSE 5000

# Start the app
CMD ["node", "index.js"]
