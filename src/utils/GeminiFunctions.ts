import { GoogleGenerativeAI } from "@google/generative-ai";

const api_key = process.env.GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(api_key as string);

console.log("API Key:", process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({ model: "gemini-pro" });

export const getResponseForGivenPrompt = async (prompt) => {
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    return text;
  } catch (error) {
    console.error("Error generating response:", error);
    throw error;
  }
};

