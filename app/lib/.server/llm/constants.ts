// see https://docs.anthropic.com/en/docs/about-claude/models
export const MAX_TOKENS = 8192;

// limits the number of model responses that can be returned in a single request
export const MAX_RESPONSE_SEGMENTS = 2;

// Default AI model configuration
export const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';

export const DEFAULT_PROVIDER = {
  name: 'anthropic',
  getModelInstance: (config: any) => {
    const { getAnthropicModel } = require('./model');
    const { getAPIKey } = require('./api-key');
    return getAnthropicModel(getAPIKey(config.serverEnv), config.model);
  }
};

export const PROVIDER_LIST = [DEFAULT_PROVIDER];
