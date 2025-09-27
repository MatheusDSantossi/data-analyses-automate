import { GoogleGenerativeAI } from "@google/generative-ai";

const api_key = import.meta.env.VITE_GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(api_key as string);

const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

export const getResponseForGivenPrompt = async (prompt: string) => {
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
