FROM node:18

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Install nodemon globally for hot reloading
RUN npm install -g nodemon

# Copy all app code (including Sequelize models/migrations)
COPY . .

# Expose server port
EXPOSE 5000

# Run migrations, then start server
CMD npx sequelize-cli db:migrate && nodemon index.js
