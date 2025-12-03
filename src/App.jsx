import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  BrainCircuit,
  Trophy,
  Calendar,
  ChevronDown,
  ChevronUp,
  DollarSign,
  BarChart3,
  ExternalLink,
  Wifi,
  WifiOff
} from 'lucide-react';

// --- Configuration ---
const GEMINI_MODEL = "gemini-2.5-flash-preview-09-2025";
const POLYMARKET_API = "https://gamma-api.polymarket.com/events";
const TAG_SLUG = "soccer";

// --- Mock Data for Fallback ---
const MOCK_MARKETS = [
  {
    id: "mock-1",
    title: "Manchester City vs Arsenal",
    description: "Premier League",
    startDate: new Date(Date.now() + 86400000).toISOString(),
    slug: "man-city-vs-arsenal",
    markets: [{
      id: "m1",
      question: "Winner: Man City vs Arsenal",
      outcomes: "[\"Man City\", \"Arsenal\", \"Draw\"]",
      outcomePrices: "[\"0.52\", \"0.24\", \"0.24\"]", // Note: Strings simulating API
      liquidity: "1500000",
      volume: "3500000"
    }]
  },
  {
    id: "mock-2",
    title: "Real Madrid vs Barcelona",
    description: "La Liga",
    startDate: new Date(Date.now() + 172800000).toISOString(),
    slug: "el-clasico",
    markets: [{
      id: "m2",
      question: "Winner: Real Madrid vs Barcelona",
      outcomes: "[\"Real Madrid\", \"Barcelona\", \"Draw\"]",
      outcomePrices: "[\"0.45\", \"0.30\", \"0.25\"]",
      liquidity: "2800000",
      volume: "5200000"
    }]
  }
];

// --- Helper Functions ---

const toPercent = (num) => {
  if (num === undefined || num === null) return "0.0";
  const parsed = parseFloat(num);
  if (isNaN(parsed)) return "0.0";
  return (parsed * 100).toFixed(1);
};

const formatMoney = (amount) => {
  if (!amount) return "$0";
  const num = parseFloat(amount);
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
  return `$${num.toFixed(0)}`;
};

const formatDate = (isoString) => {
  try {
    return new Date(isoString).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return isoString;
  }
};

// --- Components ---

const Badge = ({ children, className = "", variant = "neutral" }) => {
  const variants = {
    neutral: "bg-gray-700 text-gray-300",
    green: "bg-emerald-900/50 text-emerald-400 border border-emerald-800",
    red: "bg-rose-900/50 text-rose-400 border border-rose-800",
    yellow: "bg-amber-900/50 text-amber-400 border border-amber-800",
    blue: "bg-blue-900/50 text-blue-400 border border-blue-800",
  };
  return (
    <span className={`px-2 py-1 rounded-md text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

const ValueIndicator = ({ type, edge }) => {
  if (!type) return null;

  const config = {
    OVERVALUED: { color: "text-rose-400", bg: "bg-rose-950", icon: XCircle, text: "Overvalued" },
    UNDERVALUED: { color: "text-emerald-400", bg: "bg-emerald-950", icon: CheckCircle2, text: "Undervalued" },
    FAIR: { color: "text-amber-400", bg: "bg-amber-950", icon: AlertCircle, text: "Fair Value" }
  };

  const { color, bg, icon: Icon, text } = config[type] || config.FAIR;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-opacity-20 ${bg} border-${color.split('-')[1]}-500`}>
      <Icon className={`w-4 h-4 ${color}`} />
      <span className={`font-bold ${color}`}>{text}</span>
      {edge && <span className={`text-xs ml-auto ${color}`}>Edge: {edge}%</span>}
    </div>
  );
};

// --- Main Application Component ---

export default function App() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [analyses, setAnalyses] = useState({});
  const [analyzing, setAnalyzing] = useState({});
  const [usingMockData, setUsingMockData] = useState(false);

  // --- API Integrations ---

  const fetchMarkets = async () => {
    setLoading(true);
    setError(null);
    setUsingMockData(false);

    // We request soccer markets
    const targetUrl = `${POLYMARKET_API}?tag_slug=${TAG_SLUG}&active=true&closed=false&limit=50&order=volume24hr&ascending=false`;

    try {
      let data = null;
      let fetchSuccess = false;

      // Strategy 1: Direct Fetch
      try {
        const res = await fetch(targetUrl);
        if (res.ok) {
          data = await res.json();
          fetchSuccess = true;
        }
      } catch (e) {
        console.warn("Direct fetch failed, trying proxy...");
      }

      // Strategy 2: corsproxy.io
      if (!fetchSuccess) {
        try {
          const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(targetUrl)}`);
          if (res.ok) {
            data = await res.json();
            fetchSuccess = true;
          }
        } catch (e) {
          console.warn("Proxy 1 failed, trying allorigins...");
        }
      }

      // Strategy 3: allorigins.win
      if (!fetchSuccess) {
        try {
          const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`);
          if (res.ok) {
            data = await res.json();
            fetchSuccess = true;
          }
        } catch (e) {
          console.warn("All proxies failed.");
        }
      }

      if (!fetchSuccess || !data || !Array.isArray(data)) {
        throw new Error("Network blocked");
      }

      // Filter logic: Ensure we have at least one valid market
      // AND filter for:
      // 1. Future events only (endDate > now)
      const now = new Date();
      const validEvents = data.filter(event => {
        if (!event.markets || event.markets.length === 0) return false;

        // Check date (must be in the future)
        // User requested to use endDate instead of startDate
        const eventDate = new Date(event.endDate);
        if (eventDate < now) return false;

        return true;
      });

      if (validEvents.length === 0) throw new Error("No active binary soccer markets found");

      setMarkets(validEvents);

    } catch (err) {
      console.error("Falling back to mock data:", err);
      setMarkets(MOCK_MARKETS);
      setUsingMockData(true);
      if (err.message !== "Network blocked") {
        setError("Could not reach Polymarket. Showing sample live data.");
      }
    } finally {
      setLoading(false);
    }
  };

  const analyzeMarketWithGemini = async (event, market, outcomes, prices) => {
    if (analyzing[market.id]) return;

    setAnalyzing(prev => ({ ...prev, [market.id]: true }));

    try {
      const outcomeStr = outcomes.map((outcome, idx) => {
        const price = prices ? prices[idx] : 0;
        return `${outcome}: ${toPercent(price)}%`;
      }).join(", ");

      const systemPrompt = `
      You are an elite Sports Handicapper and Quantitative Data Scientist specializing in football (soccer) markets.
      
      YOUR OBJECTIVE:
      Identify strictly +EV (Positive Expected Value) betting opportunities by comparing your proprietary "True Odds" against the "Bookmaker Implied Probabilities."
      
      YOUR ANALYTICAL FRAMEWORK:
      Before generating the JSON output, you must internally process the following variables. If specific data is missing, make reasonable estimates based on team tier and historical norms, but prioritize recent data.

      1. RECENT FORM & MOMENTUM (High Priority):
        - Analyze the last 5 matches for both teams, applying a time-decay weight (most recent matches matter most).
        - Compare Home vs. Away performance splits (e.g., Is the home team a fortress? Is the away team poor on the road?).
        - Look for variance in scoring: Are they winning consistently or relying on lucky late goals?

      2. ADVANCED METRICS (If data available or inferred):
        - xG (Expected Goals) vs. Actual Goals: Identify regression to the mean candidates (e.g., a team overperforming their xG is likely to cool off).
        - Defensive Solidity: Clean sheets, Shots Conceded per game.

      3. TACTICAL & SQUAD CONTEXT:
        - Injuries/Suspensions: Impact of missing key players (Star strikers or Captain CBs).
        - Motivation: Title race vs. Relegation battle vs. "Dead Rubber" (mid-table match with nothing to play for).
        - Schedule Congestion: Did they play a cup game 3 days ago?

      4. MARKET ANALYSIS:
        - Convert provided odds to Implied Probability (1 / Decimal Odds).
        - Compare Implied Probability to your Calculated Probability.

      OUTPUT INSTRUCTIONS:
      You must output ONLY valid JSON. Do not include markdown formatting or conversational filler outside the JSON object.

      JSON SCHEMA:
      {
        "match_analysis": {
          "home_team_form": "string (Summary of recent performance, e.g., 'W-D-W-L-W, strong home attack')",
          "away_team_form": "string (Summary of recent performance, e.g., 'L-L-D-L-W, weak away defense')",
          "tactical_matchup": "string (1 sentence on how styles clash, e.g., 'High press vs. Low block')"
        },
        "prediction": {
          "outcome": "string (e.g., 'Arsenal Win' or 'Over 2.5 Goals')",
          "predicted_scoreline": "string (e.g., '2-1')"
        },
        "value_assessment": {
          "market_status": "UNDERVALUED" | "OVERVALUED" | "FAIR",
          "market_implied_probability": "number (0-100, derived from odds)",
          "my_calculated_probability": "number (0-100, your true odds)",
          "edge_percentage": "number (Your Prob - Market Prob)",
          "kelly_criterion_suggestion": "number (0-1, suggested stake size fraction, optional)"
        },
        "confidence_rating": "number (1-10, based on data availability and volatility)",
        "primary_reasoning": "string (Concise, data-driven explanation focusing on the discrepancy between recent form and current odds)",
        "risk_factors": ["string", "string"]
      }
    `;

      const userPrompt = `
        Analyze this Soccer Market:
        Event: ${event.title}
        League/Category: ${event.description || "Soccer"}
        Date: ${event.startDate}
        Market Question: ${market.question}
        
        The possible outcomes and their current market probabilities (implied odds) are:
        ${outcomeStr}
        
        Which SPECIFIC outcome from the list above is mispriced? Focus on value.
      `;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userPrompt }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { responseMimeType: "application/json" }
          })
        }
      );

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error.message);
      }

      const aiText = result.candidates[0].content.parts[0].text;
      const analysisData = JSON.parse(aiText);

      setAnalyses(prev => ({
        ...prev,
        [market.id]: analysisData
      }));

    } catch (err) {
      console.error("Gemini Error:", err);
      alert(`Analysis failed: ${err.message}. Please try again.`);
    } finally {
      setAnalyzing(prev => ({ ...prev, [market.id]: false }));
    }
  };

  useEffect(() => {
    fetchMarkets();
  }, []);

  const filteredMarkets = useMemo(() => {
    return markets.filter(event =>
      event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.markets[0].question.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [markets, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-700 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 p-2 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                PolySoccer AI
              </h1>
              <span className="text-xs text-slate-400 hidden sm:inline-block">Market Value Analyzer</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search teams or leagues..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-full pl-10 pr-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64 transition-all"
              />
            </div>
            <button
              onClick={fetchMarkets}
              className="p-2 hover:bg-slate-800 rounded-full transition-colors relative group"
              title="Refresh Markets"
            >
              <RefreshCw className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Mobile Search */}
        <div className="mb-6 md:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search teams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Status & Stats Bar */}
        <div className="mb-8 space-y-4">
          {/* Connection Status Banner */}
          {usingMockData && (
            <div className="bg-amber-900/30 border border-amber-800/50 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <WifiOff className="w-4 h-4 text-amber-500" />
                <span className="text-sm text-amber-200">
                  Live connection blocked. Showing <strong>Sample Data</strong>.
                </span>
              </div>
              <button
                onClick={fetchMarkets}
                className="text-xs bg-amber-900 hover:bg-amber-800 text-white px-2 py-1 rounded transition-colors"
              >
                Retry Connection
              </button>
            </div>
          )}
          {!usingMockData && markets.length > 0 && (
            <div className="bg-emerald-900/20 border border-emerald-800/30 rounded-lg p-2 px-3 flex items-center gap-2 w-fit">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs text-emerald-400 font-medium">Live Feed Active</span>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
              <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Markets</p>
              <p className="text-2xl font-bold text-white">{markets.length}</p>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
              <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">AI Analyses</p>
              <p className="text-2xl font-bold text-indigo-400">{Object.keys(analyses).length}</p>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
              <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Value Found</p>
              <p className="text-2xl font-bold text-emerald-400">
                {Object.values(analyses).filter(a => a.value_assessment?.market_status === 'UNDERVALUED').length}
              </p>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 hidden md:block">
              <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Model</p>
              <p className="text-lg font-bold text-slate-200 truncate">{GEMINI_MODEL}</p>
            </div>
          </div>
        </div>

        {/* Content Area */}
        {loading && markets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 animate-pulse">Scanning Polymarket Chain...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-950/30 border border-rose-900 rounded-xl p-6 text-center max-w-lg mx-auto">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-rose-200 mb-2">Data Fetch Error</h3>
            <p className="text-rose-300/80 mb-4">{error}</p>
            <button onClick={fetchMarkets} className="px-4 py-2 bg-rose-900 hover:bg-rose-800 text-white rounded-lg transition-colors">
              Try Again
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredMarkets.map((event) => {
              const market = event.markets[0];

              // --- PARSING LOGIC START ---
              // 1. Parse Outcomes Labels
              let outcomes = [];
              try {
                outcomes = JSON.parse(market.outcomes);
                if (!Array.isArray(outcomes)) outcomes = ["Yes", "No"];
              } catch (e) {
                // If parsing fails, fall back to "Yes"/"No" or the group item title
                outcomes = ["Yes", "No"];
              }

              // 2. Parse Outcome Prices
              // IMPORTANT: The API returns outcomePrices as a JSON STRING, NOT an Array.
              let prices = [];
              try {
                if (typeof market.outcomePrices === 'string') {
                  prices = JSON.parse(market.outcomePrices);
                } else if (Array.isArray(market.outcomePrices)) {
                  prices = market.outcomePrices;
                }
              } catch (e) {
                console.warn("Error parsing prices", e);
                prices = [];
              }
              // --- PARSING LOGIC END ---

              const analysis = analyses[market.id];
              const isAnalyzing = analyzing[market.id];
              const outcomeCount = outcomes.length;

              // Grid Class Logic
              let gridClass = "grid-cols-2";
              if (outcomeCount === 3) gridClass = "grid-cols-3";
              if (outcomeCount > 3) gridClass = "grid-cols-2 sm:grid-cols-3";

              return (
                <div key={event.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden hover:border-indigo-500/50 transition-all duration-300 shadow-lg group">
                  {/* Event Header */}
                  <div className="p-5 border-b border-slate-700 bg-slate-800/50">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex gap-2 items-center text-xs font-medium text-slate-400 mb-1">
                        <Trophy className="w-3 h-3" />
                        <span className="truncate max-w-[150px]">{event.description || "Soccer"}</span>
                      </div>
                      <Badge variant="blue">Liquid: {formatMoney(market.liquidity)}</Badge>
                    </div>
                    <h3 className="text-lg font-bold text-white leading-tight mb-2 group-hover:text-indigo-300 transition-colors">
                      {/* If the question is more descriptive than title, use it, otherwise use title */}
                      {event.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Calendar className="w-3 h-3" />
                      {formatDate(event.endDate)}
                    </div>
                    {/* If we have a group item title (e.g. for Winner markets), show it */}
                    {market.groupItemTitle && market.groupItemTitle !== event.title && (
                      <div className="mt-2 text-sm text-indigo-300 font-medium">
                        {market.groupItemTitle}
                      </div>
                    )}
                  </div>

                  {/* Market Odds */}
                  <div className="p-5 space-y-4">
                    <div className={`grid ${gridClass} gap-2`}>
                      {outcomes.map((outcome, idx) => {
                        const price = prices && prices[idx] ? prices[idx] : 0;
                        const percent = toPercent(price);
                        return (
                          <div key={idx} className="bg-slate-900 rounded-lg p-2 text-center border border-slate-700 hover:border-slate-600 transition-colors flex flex-col justify-center min-h-[70px]">
                            <div className="text-xs text-slate-400 mb-1 line-clamp-2 leading-tight" title={outcome}>
                              {outcome}
                            </div>
                            <div className="text-lg font-bold text-indigo-400">{percent}%</div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Analysis Section */}
                    {analysis ? (
                      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-700 space-y-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Assessment</span>
                            <div className="flex gap-1">
                              {[...Array(5)].map((_, i) => (
                                <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < (analysis.confidence_rating / 2) ? 'bg-indigo-500' : 'bg-slate-700'}`} />
                              ))}
                            </div>
                          </div>

                          <ValueIndicator type={analysis.value_assessment?.market_status} edge={analysis.value_assessment?.edge_percentage} />

                          <div className="flex justify-between items-center text-sm border-t border-slate-700/50 pt-2 mt-2">
                            <div className="text-slate-400">Target: <span className="text-slate-200">{analysis.prediction?.outcome}</span></div>
                            <div className="text-slate-400">Est: <span className="text-slate-200">{analysis.value_assessment?.my_calculated_probability}%</span></div>
                          </div>

                          <div className="bg-slate-800/50 p-3 rounded-lg text-xs text-slate-300 leading-relaxed italic border border-slate-700/30">
                            "{analysis.primary_reasoning}"
                          </div>

                          <div className="flex flex-wrap gap-1 mt-2">
                            {analysis.risk_factors?.map((factor, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700">
                                {factor}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <button
                          onClick={() => analyzeMarketWithGemini(event, market, outcomes, prices)}
                          disabled={isAnalyzing}
                          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2
                            ${isAnalyzing
                              ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                              : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-900/20"
                            }`}
                        >
                          {isAnalyzing ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Analyzing Market...
                            </>
                          ) : (
                            <>
                              <BrainCircuit className="w-4 h-4" />
                              Analyze with Gemini AI
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="px-5 py-3 bg-slate-900/50 border-t border-slate-700 flex justify-between items-center text-xs">
                    <span className="text-slate-500">Volume: {formatMoney(market.volume)}</span>
                    <a
                      href={`https://polymarket.com/event/${event.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                    >
                      Trade on Polymarket <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900 mt-12 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-slate-500 text-sm mb-2">
            Powered by <span className="text-slate-300 font-semibold">Google Gemini</span> & <span className="text-slate-300 font-semibold">Polymarket Gamma API</span>
          </p>
          <p className="text-slate-600 text-xs max-w-2xl mx-auto">
            Disclaimer: This application is for educational and entertainment purposes only.
            AI predictions are theoretical estimates and do not guarantee results.
            Betting involves financial risk. Please gamble responsibly.
          </p>
        </div>
      </footer>
    </div>
  );
}