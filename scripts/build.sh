#!/bin/bash

# Build script for Universities package
# This script handles TypeScript compilation, linting, testing, and packaging

set -e

echo "🏗️  Building Universities Package..."

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist/
rm -rf coverage/

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Run linting
echo "🔍 Running ESLint..."
npm run lint

# Run Prettier formatting check
echo "✨ Checking code formatting..."
npm run format:check

# Run TypeScript compilation
echo "🔨 Compiling TypeScript..."
npm run build:tsc

# Run tests with coverage
echo "🧪 Running tests with coverage..."
npm run test:coverage

# Generate documentation
echo "📚 Generating documentation..."
npm run docs:generate

# Package for distribution
echo "📦 Packaging for distribution..."
npm pack --pack-destination "$(mktemp -d)"

echo "✅ Build completed successfully!"
echo "📊 Coverage report available in coverage/"
echo "📚 Documentation available in docs/"
echo "📦 Package ready for publishing"