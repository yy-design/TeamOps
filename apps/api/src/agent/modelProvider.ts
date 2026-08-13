import { createOpenAI } from '@ai-sdk/openai';

export function getAgentModelConfig() {
  const apiKey = process.env.MODEL_API_KEY ?? process.env.DEEPSEEK_API_KEY;
  const baseURL = process.env.MODEL_BASE_URL ?? 'https://api.deepseek.com/v1';
  const modelName = process.env.MODEL_NAME ?? 'deepseek-chat';
  if (!apiKey || apiKey === 'replace-with-your-deepseek-api-key') {
    throw new Error('AI Copilot 尚未配置 MODEL_API_KEY 或 DEEPSEEK_API_KEY');
  }
  const provider = createOpenAI({ baseURL, apiKey });
  return {
    model: provider.chat(modelName),
    modelName,
    baseURL
  };
}