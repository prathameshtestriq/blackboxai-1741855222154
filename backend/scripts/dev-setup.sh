#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print with color
print_color() {
    color=$1
    message=$2
    printf "${color}${message}${NC}\n"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_color $YELLOW "Checking prerequisites..."
    
    if ! command_exists node; then
        print_color $RED "Node.js is not installed. Please install Node.js first."
        exit 1
    fi

    if ! command_exists npm; then
        print_color $RED "npm is not installed. Please install npm first."
        exit 1
    fi

    if ! command_exists docker; then
        print_color $RED "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! command_exists docker-compose; then
        print_color $RED "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    print_color $GREEN "All prerequisites are met!"
}

# Install dependencies
install_dependencies() {
    print_color $YELLOW "Installing dependencies..."
    npm install
    print_color $GREEN "Dependencies installed successfully!"
}

# Create necessary directories
create_directories() {
    print_color $YELLOW "Creating necessary directories..."
    mkdir -p logs
    mkdir -p data
    print_color $GREEN "Directories created successfully!"
}

# Setup environment variables
setup_env() {
    print_color $YELLOW "Setting up environment variables..."
    if [ ! -f .env ]; then
        cp .env.example .env
        print_color $GREEN "Created .env file from template"
    else
        print_color $YELLOW ".env file already exists, skipping..."
    fi
}

# Start development environment
start_dev() {
    print_color $YELLOW "Starting development environment..."
    docker-compose up -d
    print_color $GREEN "Development environment started!"
    print_color $YELLOW "Services available at:"
    echo "- API: http://localhost:3000"
    echo "- MongoDB Express: http://localhost:8081"
    echo "- MailHog: http://localhost:8025"
}

# Stop development environment
stop_dev() {
    print_color $YELLOW "Stopping development environment..."
    docker-compose down
    print_color $GREEN "Development environment stopped!"
}

# Run database seed
run_seed() {
    print_color $YELLOW "Seeding database..."
    node src/scripts/seedData.js
    print_color $GREEN "Database seeded successfully!"
}

# Run tests
run_tests() {
    print_color $YELLOW "Running tests..."
    npm test
}

# Clean up development environment
cleanup() {
    print_color $YELLOW "Cleaning up development environment..."
    docker-compose down -v
    rm -rf node_modules
    rm -rf logs/*
    rm -rf data/*
    print_color $GREEN "Cleanup completed!"
}

# Show help message
show_help() {
    echo "Usage: ./scripts/dev-setup.sh [command]"
    echo ""
    echo "Commands:"
    echo "  install    - Install dependencies"
    echo "  setup      - Setup development environment (create directories, setup env)"
    echo "  start      - Start development environment"
    echo "  stop       - Stop development environment"
    echo "  seed       - Run database seed"
    echo "  test       - Run tests"
    echo "  cleanup    - Clean up development environment"
    echo "  help       - Show this help message"
}

# Main script
case "$1" in
    "install")
        check_prerequisites
        install_dependencies
        ;;
    "setup")
        create_directories
        setup_env
        ;;
    "start")
        start_dev
        ;;
    "stop")
        stop_dev
        ;;
    "seed")
        run_seed
        ;;
    "test")
        run_tests
        ;;
    "cleanup")
        cleanup
        ;;
    "help")
        show_help
        ;;
    *)
        print_color $YELLOW "Running complete setup..."
        check_prerequisites
        install_dependencies
        create_directories
        setup_env
        start_dev
        run_seed
        print_color $GREEN "Setup completed successfully!"
        ;;
esac

exit 0
