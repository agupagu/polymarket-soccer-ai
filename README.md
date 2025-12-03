# PolySoccer AI ⚽️🤖

A real-time market value analyzer for Polymarket soccer events, powered by Google Gemini AI.

## Overview

PolySoccer AI fetches live soccer markets from Polymarket and uses Google's Gemini 2.5 Flash model to analyze betting opportunities. It compares the market's implied probability against the AI's calculated probability to identify +EV (Positive Expected Value) trades.

## Features

- **Live Market Data**: Fetches real-time soccer markets from Polymarket.
- **AI Analysis**: Uses Gemini 2.5 to analyze team form, stats, and match context.
- **Value Detection**: Automatically flags markets as "Undervalued", "Overvalued", or "Fair".
- **Smart Filtering**: Focuses on binary markets (2 outcomes) and future events.
- **Search**: Filter markets by team or league name.

## Prerequisites

- **Node.js** (v18 or higher recommended)
- **npm** (comes with Node.js)
- **Google Gemini API Key** (Get one at [Google AI Studio](https://aistudio.google.com/))

## Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd polymarket-ai
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

## Configuration

1.  **Create a `.env` file** in the root directory:
    ```bash
    touch .env
    ```

2.  **Add your Gemini API Key** to the `.env` file:
    ```env
    VITE_GEMINI_API_KEY=your_actual_api_key_here
    ```

    > **Note:** The application is pre-configured to use the `gemini-2.5-flash-preview-09-2025` model.

## Running the App

1.  **Start the development server:**
    ```bash
    npm run dev
    ```

2.  **Open your browser:**
    Navigate to `http://localhost:5173` (or the URL shown in your terminal).

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS
- **AI**: Google Gemini API
- **Icons**: Lucide React

## Disclaimer

This application is for educational and entertainment purposes only. AI predictions are theoretical estimates and do not guarantee results. Betting involves financial risk. Please gamble responsibly.
