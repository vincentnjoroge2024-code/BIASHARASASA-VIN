# BiasharaSasa

BiasharaSasa is a React and TypeScript business management app with a point of sale, inventory, reporting, and optional finance, tax, production, and HR modules. An Express server provides the API and serves the built React app.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. To make a production build and run it locally:

```bash
npm run build
npm run start
```

## Deploy to Railway

Railway builds the frontend and backend with `npm run build`, then starts the Express server with `npm run start`. The Railway configuration is in `railway.json`; the server listens on Railway's assigned `PORT` and serves the React files from `dist`. Set any required database and authentication environment variables in Railway's service settings; do not commit secrets.

`app.py` is a separate Flask dashboard and is not the application entry point for the Railway deployment.
