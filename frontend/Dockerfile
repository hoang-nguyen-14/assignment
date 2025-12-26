FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose the Vite default port
EXPOSE 5173

# Run the dev server
# --host is required to expose the app outside the container
CMD ["npm", "run", "dev", "--", "--host"]