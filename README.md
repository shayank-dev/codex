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

## Weather Check

`weather/` contains a separate, self-contained weather app: search any city (or use your location) for current conditions, a 24-hour forecast and a 7-day outlook, with a °C/°F toggle. It uses the free [Open-Meteo](https://open-meteo.com/) API, so it needs no API key and no backend.

Open `weather/index.html` directly in a browser, or serve it:

```bash
python -m http.server 8000 --directory weather
```

Then visit `http://localhost:8000`.
