FROM node:18

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy all app code (including Sequelize models/migrations)
COPY . .

# Expose server port
EXPOSE 5000

CMD node index.js
