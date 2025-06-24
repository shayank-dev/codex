# Pigeon Marketplace

This is a small Flask web app for buying and selling pigeons. Listings are stored in a local SQLite database with optional images. Data persists between restarts and you can edit or delete existing pigeons.

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the application:
   ```bash
   python app.py
   ```

The app will create a `db.sqlite3` file in the project directory on first run. Images uploaded for listings are saved in `static/uploads`.

For production, set the `SECRET_KEY` environment variable to a strong value before starting the server.

Visit `http://localhost:5000` in your browser to see the marketplace.
