'use server';

// import type { ChatCompletionMessageParam } from 'openai/resources/chat';
// import OpenAI from 'openai';
import GPT4js from 'gpt4js';
import { LLMPredictionFunctionParams } from './types';

export async function predict({
  systemPrompt,
  userPrompt,
  nbMaxNewTokens,
  llmVendorConfig,
}: LLMPredictionFunctionParams): Promise<string> {
  console.log(nbMaxNewTokens);
  // const openaiApiKey = `${
  //   llmVendorConfig.apiKey || process.env.AUTH_OPENAI_API_KEY || ''
  // }`;
  const openaiApiKey = `${
    llmVendorConfig.apiKey || process.env.AUTH_OPENAI_API_KEY || ''
  }`;
  // const openaiApiModel = `${
  //   llmVendorConfig.modelId || process.env.LLM_OPENAI_API_MODEL || 'gpt-4-turbo'
  // }`;

  if (!openaiApiKey) {
    throw new Error(`cannot call OpenAI without an API key`);
  }

  // const openaiApiBaseUrl = `${process.env.LLM_OPENAI_API_BASE_URL || 'https://api.openai.com/v1'}`;

  // const openai = new OpenAI({
  //   apiKey: openaiApiKey,
  //   baseURL: openaiApiBaseUrl,
  // });

  // const messages: ChatCompletionMessageParam[] = [
  //   { role: 'system', content: systemPrompt },
  //   { role: 'user', content: userPrompt },
  // ];

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
  const options = {
    provider: 'BlackBox',
  };

  const provider = GPT4js.createProvider(options.provider);

  try {
    // const res = await openai.chat.completions.create({
    //   messages: messages,
    //   stream: false,
    //   model: openaiApiModel,
    //   temperature: 0.8,
    //   max_tokens: nbMaxNewTokens,

    //   // TODO: use the nbPanels to define a max token limit
    // });
    const text = await provider.chatCompletion(messages, options, (data) => {
      console.log(data);
    });

    return text || '';
  } catch (err) {
    console.error(`error during generation: ${err}`);
    return '';
  }
}
