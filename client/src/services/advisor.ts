import { request } from './api';

export type AdvisorLanguage = 'en' | 'te' | 'hi';

interface AdvisorResponse {
  success: boolean;
  provider: string;
  language: AdvisorLanguage;
  response: string;
  fallback: boolean;
}

export async function askAdvisor(prompt: string, language: AdvisorLanguage): Promise<AdvisorResponse> {
  return request<AdvisorResponse>('/ai/advisor', {
    method: 'POST',
    body: JSON.stringify({ prompt, language }),
  });
}
