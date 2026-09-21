import { GeminiConfig, Message, Attachment } from "../types";

/**
 * Generates content using the server-side Gemini API endpoint (/api/chat)
 * with full token streaming, Agent Mode, and Long-Term Memory support.
 */
export const generateContentStream = async function* (
  prompt: string, 
  attachments: Attachment[], 
  history: Message[], 
  config: GeminiConfig
): AsyncGenerator<string, void, unknown> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      attachments,
      history,
      thinkingBudget: config.thinkingBudget || 0,
      isAgentMode: config.isAgentMode || false,
      agentSpecialty: config.agentSpecialty || 'general',
      memories: config.memories || [],
      customApiKey: config.customApiKey || undefined,
    }),
    signal: config.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Hatası (${response.status}): ${errorText || response.statusText}`);
  }

  if (!response.body) {
    throw new Error("Sunucudan veri akışı alınamadı.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');

  try {
    while (true) {
      if (config.signal?.aborted) {
        reader.cancel();
        break;
      }

      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const textChunk = decoder.decode(value, { stream: true });
      if (textChunk) {
        yield textChunk;
      }
    }
  } finally {
    reader.releaseLock();
  }
};

/**
 * Validates a user-provided Gemini API key via the backend verification endpoint.
 */
export const verifyApiKey = async (apiKey: string): Promise<{ valid: boolean; message?: string; error?: string }> => {
  try {
    const res = await fetch('/api/verify-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });
    const data = await res.json();
    if (!res.ok || !data.valid) {
      return { valid: false, error: data.error || 'API anahtarı doğrulanamadı.' };
    }
    return { valid: true, message: data.message || 'API anahtarı geçerli ve çalışıyor.' };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Doğrulama isteği sırasında bağlantı hatası oluştu.' };
  }
};
