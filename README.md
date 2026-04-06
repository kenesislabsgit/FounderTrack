# Kenesis Vision - Founder Governance & Team Management

A high-performance team management and founder governance platform built with React, Vite, and Firebase.

## Tech Stack

### Frontend
- **React 19**: UI library.
- **Vite 6**: Build tool and dev server.
- **Tailwind CSS 4**: Utility-first styling.
- **Lucide React**: Icon library.
- **Motion (Framer Motion)**: Animations and transitions.
- **Recharts**: Data visualization for analytics.
- **Date-fns**: Date manipulation.
- **React Dropzone**: File upload handling.

### Backend & Services
- **Firebase (Firestore)**: Real-time NoSQL database.
- **Firebase Authentication**: Google Login integration.
- **Google Gemini API**: AI-powered performance analysis and chat bot.

## Local Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd react-example
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory and add the following:
   ```env
   VITE_DEV_MODE="true"
   GEMINI_API_KEY="your-gemini-api-key"
   APP_URL="http://localhost:3000"
   ```

4. **Firebase Configuration**:
   Ensure `firebase-applet-config.json` is present in the root with your Firebase project credentials.

5. **Run the development server**:
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

## Deployment

1. **Build the project**:
   ```bash
   npm run build
   ```
   This generates a `dist` folder with static assets.

2. **Deploy to Hosting**:
   You can deploy the `dist` folder to any static hosting service (Firebase Hosting, Vercel, Netlify, etc.).

3. **Firebase Security Rules**:
   Deploy the `firestore.rules` to your Firebase project to ensure data security.

## Features

- **Dashboard**: Real-time attendance and check-in/out with location and photo proof.
- **The Chopping Block**: A unique founder governance system with secret ballots, underperformer identification, and equity dilution logic.
- **Team Analytics**: AI-powered insights into team performance and attendance trends.
- **Kenesis Brainstorm**: A collaborative forum for ideas, to-dos, and discussions.
- **AI Analytics Bot**: A chat interface for querying team data and getting strategic advice.
