# Use Node.js LTS version
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Bundle app source
COPY . .

# Create logs directory
RUN mkdir -p logs

# Create volume for logs and data persistence
VOLUME [ "/usr/src/app/logs" ]

# Expose port
EXPOSE 3000

# Start the application
CMD [ "npm", "start" ]
