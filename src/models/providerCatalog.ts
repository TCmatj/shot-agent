import type { ProviderConfig, ProviderModelConfig } from '../domain/provider';

type ProviderSeed = Omit<ProviderConfig, 'models'> & {
  models: Array<Omit<ProviderModelConfig, 'canonicalModelId'> & { canonicalModelId?: string }>;
};

const defaultChatModels: Record<string, ProviderSeed['models']> = {
  openai: [
    { id: 'model_openai_chat_gpt_5_4_mini', providerModelId: 'gpt-5.4-mini', enabled: true },
    { id: 'model_openai_chat_gpt_5_4', providerModelId: 'gpt-5.4', enabled: true },
  ],
  deepseek: [
    { id: 'model_deepseek_chat', providerModelId: 'deepseek-chat', enabled: true },
    { id: 'model_deepseek_reasoner', providerModelId: 'deepseek-reasoner', enabled: true },
  ],
  google: [
    { id: 'model_google_gemini_flash', providerModelId: 'gemini-2.5-flash', enabled: true },
    { id: 'model_google_gemini_pro', providerModelId: 'gemini-2.5-pro', enabled: true },
  ],
  mistral: [
    { id: 'model_mistral_medium', providerModelId: 'mistral-medium-latest', enabled: true },
    { id: 'model_mistral_large', providerModelId: 'mistral-large-latest', enabled: true },
  ],
  groq: [
    { id: 'model_groq_llama', providerModelId: 'llama-3.3-70b-versatile', enabled: true },
  ],
  openrouter: [
    { id: 'model_openrouter_auto', providerModelId: 'openrouter/auto', enabled: true },
  ],
  together: [
    { id: 'model_together_kimi', providerModelId: 'moonshotai/Kimi-K2.5', enabled: true },
  ],
  qwen: [
    { id: 'model_qwen_plus', providerModelId: 'qwen-plus', enabled: true },
    { id: 'model_qwen_max', providerModelId: 'qwen-max', enabled: true },
  ],
  xai: [
    { id: 'model_xai_grok', providerModelId: 'grok-4', enabled: true },
  ],
  azureOpenai: [
    { id: 'model_azure_gpt_5_4_mini', providerModelId: 'gpt-5.4-mini', enabled: true },
  ],
  ollama: [
    { id: 'model_ollama_llama', providerModelId: 'llama3.3', enabled: true },
  ],
};

const providerSeeds: ProviderSeed[] = [
  {
    id: 'provider_openai',
    name: 'OpenAI 官方',
    protocol: 'openai-compatible',
    baseURL: 'https://api.openai.com',
    apiTokenRef: 'secret_openai',
    enabled: true,
    models: [
      { id: 'model_openai_gpt_image_2', providerModelId: 'gpt-image-2', canonicalModelId: 'gpt-image-2', enabled: true },
      { id: 'model_openai_sora_2', providerModelId: 'sora-2', canonicalModelId: 'seedance-sora', enabled: true },
      ...defaultChatModels.openai,
    ],
  },
  {
    id: 'provider_seedance',
    name: '火山方舟',
    protocol: 'volcengine',
    baseURL: 'https://ark.cn-beijing.volces.com',
    apiTokenRef: 'secret_seedance',
    enabled: true,
    models: [
      { id: 'model_seedance_2_0', providerModelId: 'doubao-seedance-2-0-260128', canonicalModelId: 'seedance2.0', enabled: true },
      { id: 'model_seedance_2_0_fast', providerModelId: 'doubao-seedance-2-0-fast-260128', canonicalModelId: 'seedance2.0-fast', enabled: true },
    ],
  },
  {
    id: 'provider_anthropic',
    name: 'Anthropic 官方',
    protocol: 'anthropic-compatible',
    baseURL: 'https://api.anthropic.com/v1',
    apiTokenRef: 'secret_anthropic',
    enabled: true,
    models: [
      { id: 'model_anthropic_chat', providerModelId: 'claude-sonnet-4-5', enabled: true },
      { id: 'model_anthropic_opus', providerModelId: 'claude-opus-4-1', enabled: true },
    ],
  },
  {
    id: 'provider_deepseek',
    name: 'DeepSeek',
    protocol: 'openai-compatible',
    baseURL: 'https://api.deepseek.com',
    apiTokenRef: 'secret_deepseek',
    enabled: false,
    models: defaultChatModels.deepseek,
  },
  {
    id: 'provider_google',
    name: 'Google Gemini',
    protocol: 'openai-compatible',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiTokenRef: 'secret_google',
    enabled: false,
    models: defaultChatModels.google,
  },
  {
    id: 'provider_mistral',
    name: 'Mistral',
    protocol: 'openai-compatible',
    baseURL: 'https://api.mistral.ai',
    apiTokenRef: 'secret_mistral',
    enabled: false,
    models: defaultChatModels.mistral,
  },
  {
    id: 'provider_groq',
    name: 'Groq',
    protocol: 'openai-compatible',
    baseURL: 'https://api.groq.com/openai',
    apiTokenRef: 'secret_groq',
    enabled: false,
    models: defaultChatModels.groq,
  },
  {
    id: 'provider_openrouter',
    name: 'OpenRouter',
    protocol: 'openai-compatible',
    baseURL: 'https://openrouter.ai/api',
    apiTokenRef: 'secret_openrouter',
    enabled: false,
    models: defaultChatModels.openrouter,
  },
  {
    id: 'provider_together',
    name: 'Together.ai',
    protocol: 'openai-compatible',
    baseURL: 'https://api.together.xyz',
    apiTokenRef: 'secret_together',
    enabled: false,
    models: defaultChatModels.together,
  },
  {
    id: 'provider_qwen',
    name: '通义千问',
    protocol: 'openai-compatible',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode',
    apiTokenRef: 'secret_qwen',
    enabled: false,
    models: defaultChatModels.qwen,
  },
  {
    id: 'provider_xai',
    name: 'xAI',
    protocol: 'openai-compatible',
    baseURL: 'https://api.x.ai',
    apiTokenRef: 'secret_xai',
    enabled: false,
    models: defaultChatModels.xai,
  },
  {
    id: 'provider_azure_openai',
    name: 'Azure OpenAI',
    protocol: 'openai-compatible',
    baseURL: 'https://your-resource-name.openai.azure.com/openai',
    apiTokenRef: 'secret_azure_openai',
    enabled: false,
    models: defaultChatModels.azureOpenai,
  },
  {
    id: 'provider_ollama',
    name: 'Ollama',
    protocol: 'openai-compatible',
    baseURL: 'http://localhost:11434',
    apiTokenRef: '',
    enabled: false,
    models: defaultChatModels.ollama,
  },
];

export const initialProviders: ProviderConfig[] = providerSeeds.map((provider) => ({
  ...provider,
  models: provider.models.map((model) => ({
    ...model,
    canonicalModelId: model.canonicalModelId ?? model.providerModelId,
  })),
}));
