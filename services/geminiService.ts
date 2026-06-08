
import { GoogleGenAI, Type } from "@google/genai";
import { ArbitrageOpportunity } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export class QuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaError";
  }
}

export const scanImbalances = async (
  activeChain: string, 
  baseAsset: string, 
  targetTokens: string
): Promise<ArbitrageOpportunity[]> => {
  const chainPrompt = activeChain === 'ALL' || activeChain === 'Global Radar'
    ? "across ALL major EVM blockchains: Ethereum, BSC, Polygon, Arbitrum, Optimism, Base, Avalanche, and Linea."
    : `specifically on the ${activeChain} blockchain ecosystem.`;

  const tokenConstraint = targetTokens.trim() 
    ? `CRITICAL: Prioritize these specific tokens: ${targetTokens}.`
    : "Focus on high-volume assets like ETH, WBTC, LINK, and stablecoin pairs.";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Perform a deep scan for real-time crypto imbalances ${chainPrompt}
      ${tokenConstraint}
      Calculate the Profit Opportunity (PO) for each route.
      
      CRITICAL RULES:
      1. Each opportunity MUST be Atomic (Buy and Sell on the same chain) to ensure 100% execution success.
      2. Return a realistic spread (imbalancePercentage) between 0.05% and 12.0%.
      3. Identify DEXs like Uniswap V3, PancakeSwap, Curve, Balancer, and Sushi.
      4. Estimate Gas based on current network congestion levels.

      Format as a JSON array with: id, token, symbol, chain, buyDex, sellDex, buyPrice, sellPrice, imbalancePercentage, liquidity, gasEstimate.`,
      config: {
        thinkingConfig: { thinkingBudget: 15000 }, // Reduced slightly to save tokens
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              token: { type: Type.STRING },
              symbol: { type: Type.STRING },
              chain: { type: Type.STRING },
              buyDex: { type: Type.STRING },
              sellDex: { type: Type.STRING },
              buyPrice: { type: Type.NUMBER },
              sellPrice: { type: Type.NUMBER },
              imbalancePercentage: { type: Type.NUMBER },
              liquidity: { type: Type.STRING },
              gasEstimate: { type: Type.STRING }
            },
            required: ["id", "token", "symbol", "chain", "buyDex", "sellDex", "buyPrice", "sellPrice", "imbalancePercentage"]
          }
        }
      }
    });

    const data = JSON.parse(response.text || '[]');
    return data.map((item: any) => ({
      ...item,
      timestamp: new Date().toISOString()
    }));
  } catch (error: any) {
    const errorStr = JSON.stringify(error);
    if (errorStr.includes("429") || errorStr.toLowerCase().includes("quota") || errorStr.toLowerCase().includes("exhausted")) {
      throw new QuotaError("API Quota Exhausted. Please wait a moment or upgrade your plan.");
    }
    console.error("Gemini Scan Error:", error);
    return [];
  }
};

export const analyzeTradeRisk = async (opp: ArbitrageOpportunity, amountUSD: string, mode: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Institutional Analysis (PO Check):
      Target: ${opp.symbol} on ${opp.chain}.
      Strike Amount: $${amountUSD}. 
      Route: ${opp.buyDex} -> ${opp.sellDex}.
      Spread: ${opp.imbalancePercentage}%.
      Verify if PO covers Gas ($${opp.gasEstimate}) and 0.09% Flash Loan fees. Provide a professional 'GO' or 'NO-GO' summary.`,
      config: {
        thinkingConfig: { thinkingBudget: 5000 }
      }
    });
    return response.text || "Risk analysis unavailable.";
  } catch (error: any) {
    const errorStr = JSON.stringify(error);
    if (errorStr.includes("429")) throw new QuotaError("Quota Exhausted during risk analysis.");
    return "Error calculating real-time risk.";
  }
};
