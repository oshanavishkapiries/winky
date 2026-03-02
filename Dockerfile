FROM node:20-bookworm

# Set the working directory inside the container
WORKDIR /usr/src/winky

# Copy package management files
COPY package*.json ./

# Install application dependencies
RUN npm install

# Install Playwright OS Dependencies and Chromium specifically
# This downloads the necessary browser binaries directly into the container
RUN npx playwright install --with-deps chromium

# Copy the rest of the application source code
COPY . .

# Inform Winky it is running inside Docker to enforce headless mode and bypass TUI
ENV DOCKER_ENV=true

# Expose the internal REST API port
EXPOSE 3000

# Start Winky
CMD ["npm", "run", "dev"]
