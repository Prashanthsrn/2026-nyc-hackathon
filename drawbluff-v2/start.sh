#!/bin/bash
set -e

echo "Installing server dependencies..."
cd "$(dirname "$0")/server"
npm install

echo "Installing client dependencies..."
cd "../client"
npm install

echo "Building client..."
npx vite build

echo "Starting server..."
cd "../server"
node index.js
